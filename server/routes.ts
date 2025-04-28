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
    
    // Make sure user has enough tickets (at least 1)
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
      
      // Create booking and deduct one ticket
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
  
  // Add tickets directly to a user (for testing purposes)
  app.post("/api/tickets/add", async (req, res) => {
    try {
      console.log("[API] /api/tickets/add リクエスト受信:", req.body);
      
      if (!req.isAuthenticated()) {
        console.log("[API] 認証エラー: 未ログイン");
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      const userId = req.user!.id;
      console.log("[API] ユーザーID:", userId);
      
      const { quantity } = req.body;
      console.log("[API] リクエスト内容:", { quantity, type: typeof quantity });
      
      if (!quantity || typeof quantity !== 'number') {
        console.log("[API] バリデーションエラー: 不正なチケット数");
        return res.status(400).json({ message: "Invalid ticket quantity" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("[API] ユーザーが見つかりません:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("[API] 現在のチケット数:", user.ticketCount);
      const newTicketCount = user.ticketCount + quantity;
      console.log("[API] 新しいチケット数:", newTicketCount);
      
      await storage.updateTicketCount(userId, newTicketCount);
      
      const response = { 
        ticketCount: newTicketCount,
        message: `${quantity} tickets added successfully`
      };
      console.log("[API] レスポンス:", response);
      
      res.json(response);
    } catch (error) {
      console.error("[API] チケット追加エラー:", error);
      res.status(500).json({ message: "Internal server error", error: String(error) });
    }
  });

  // Update user settings
  app.patch("/api/user/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const {
      displayName,
      email,
      phone,
      emailNotifications,
      smsNotifications
    } = req.body;
    
    try {
      const updatedUser = await storage.updateUserSettings(userId, {
        displayName,
        email,
        phone,
        emailNotifications,
        smsNotifications
      });
      
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: "Failed to update settings", error });
    }
  });
  
  // 保護者情報の更新
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const { phone, address } = req.body;
    
    try {
      // バリデーション
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      
      if (!address || address.length < 5) {
        return res.status(400).json({ message: "Valid address is required" });
      }
      
      const updatedUser = await storage.updateUserProfile(userId, phone, address);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: "Failed to update profile", error });
    }
  });
  
  // 生徒情報の一覧取得
  app.get("/api/students", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    try {
      const students = await storage.getStudentsByUserId(userId);
      res.json(students);
    } catch (error) {
      res.status(400).json({ message: "Failed to get students", error });
    }
  });
  
  // 生徒情報の登録
  app.post("/api/students", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const { fullName, furigana, school, grade, birthDate } = req.body;
    
    try {
      // バリデーション
      if (!fullName || !furigana || !school || !grade || !birthDate) {
        return res.status(400).json({ message: "All student fields are required" });
      }
      
      const student = await storage.createStudent({
        userId,
        fullName,
        furigana,
        school,
        grade,
        birthDate
      });
      
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ message: "Failed to create student", error });
    }
  });
  
  // 生徒情報の更新
  app.patch("/api/students/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const studentId = parseInt(req.params.id);
    
    try {
      // 生徒の存在チェック
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // 権限チェック
      if (student.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this student" });
      }
      
      const updatedStudent = await storage.updateStudent(studentId, req.body);
      res.json(updatedStudent);
    } catch (error) {
      res.status(400).json({ message: "Failed to update student", error });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
