import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookingSchema, timeSlots } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Get bookings for a user
  app.get("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const bookings = await storage.getBookingsByUserId(userId);
    res.json(bookings);
  });

  // Create a new booking
  app.post("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.ticketCount <= 0) {
      return res.status(400).json({ message: "Insufficient tickets" });
    }
    
    try {
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        userId
      });
      
      // Validate timeSlot
      if (!timeSlots.includes(bookingData.timeSlot)) {
        return res.status(400).json({ message: "Invalid time slot" });
      }
      
      // Check if booking already exists
      const existingBooking = await storage.getBookingByDateAndTimeSlot(
        userId, 
        bookingData.date, 
        bookingData.timeSlot
      );
      
      if (existingBooking) {
        return res.status(400).json({ message: "Booking already exists for this date and time" });
      }
      
      // Create booking and deduct ticket
      const booking = await storage.createBooking(bookingData);
      await storage.updateTicketCount(userId, user.ticketCount - 1);
      
      res.status(201).json(booking);
    } catch (error) {
      res.status(400).json({ message: "Invalid booking data", error });
    }
  });

  // Purchase tickets
  app.post("/api/tickets/purchase", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const { quantity } = req.body;
    
    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ message: "Invalid ticket quantity" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const newTicketCount = user.ticketCount + quantity;
    await storage.updateTicketCount(userId, newTicketCount);
    
    res.json({ 
      ticketCount: newTicketCount,
      message: "Tickets purchased successfully" 
    });
  });

  // Update user settings
  app.patch("/api/user/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const {
      displayName,
      email,
      phone,
      grade,
      emailNotifications,
      smsNotifications
    } = req.body;
    
    try {
      const updatedUser = await storage.updateUserSettings(userId, {
        displayName,
        email,
        phone,
        grade,
        emailNotifications,
        smsNotifications
      });
      
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: "Failed to update settings", error });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
