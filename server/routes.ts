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
      
      // 予約チェック：同じ生徒を同じ日時に予約できないようにする
      if (bookingData.studentId) {
        // 既存の予約の中から、同じ生徒IDで同じ日時に予約されているものを検索
        const existingBookings = await storage.getBookingsByUserId(userId);
        const duplicateBooking = existingBookings.find(booking => 
          booking.date === bookingData.date && 
          booking.timeSlot === bookingData.timeSlot && 
          booking.studentId === bookingData.studentId
        );
        
        if (duplicateBooking) {
          return res.status(400).json({ message: "この生徒は既にこの日時に予約があります" });
        }
      } else {
        // 生徒IDがない場合（レガシーサポート）
        const existingBooking = await storage.getBookingByDateAndTimeSlot(
          userId, 
          bookingData.date, 
          bookingData.timeSlot
        );
        
        if (existingBooking) {
          return res.status(400).json({ message: "この日時には既に予約があります" });
        }
      }
      
      // Create booking and deduct one ticket
      const booking = await storage.createBooking(bookingData);
      await storage.updateTicketCount(userId, user.ticketCount - 1);
      
      res.status(201).json(booking);
    } catch (error) {
      res.status(400).json({ message: "Invalid booking data", error });
    }
  });
  
  // 予約キャンセルエンドポイント
  app.delete("/api/bookings/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }
    
    try {
      // 予約情報の取得
      const booking = await storage.getBookingById(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // 予約が現在のユーザーのものか確認
      if (booking.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to cancel this booking" });
      }
      
      // ユーザー情報の取得
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // 予約の削除
      await storage.deleteBooking(bookingId);
      
      // チケットの返却（1枚）
      const updatedUser = await storage.updateTicketCount(userId, user.ticketCount + 1);
      
      res.json({ 
        message: "Booking cancelled successfully", 
        ticketCount: updatedUser.ticketCount 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel booking", error });
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
    const { phone, postalCode, prefecture, city, address } = req.body;
    
    try {
      // バリデーション
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      
      if (!postalCode || postalCode.length < 7) {
        return res.status(400).json({ message: "Valid postal code is required" });
      }
      
      if (!prefecture || prefecture.length < 2) {
        return res.status(400).json({ message: "Valid prefecture is required" });
      }
      
      if (!city || city.length < 2) {
        return res.status(400).json({ message: "Valid city is required" });
      }
      
      if (!address || address.length < 2) {
        return res.status(400).json({ message: "Valid address is required" });
      }
      
      const updatedUser = await storage.updateUserProfile(
        userId, 
        phone, 
        postalCode, 
        prefecture, 
        city, 
        address
      );
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
    const { 
      lastName, 
      firstName, 
      lastNameFurigana, 
      firstNameFurigana,
      gender,
      school, 
      grade, 
      birthDate 
    } = req.body;
    
    try {
      // バリデーション
      if (!lastName || !firstName || !lastNameFurigana || !firstNameFurigana || !gender || !school || !grade || !birthDate) {
        return res.status(400).json({ message: "All student fields are required" });
      }
      
      const student = await storage.createStudent({
        userId,
        lastName,
        firstName,
        lastNameFurigana,
        firstNameFurigana,
        gender,
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
  
  // 生徒情報の削除（論理削除）
  app.delete("/api/students/:id", async (req, res) => {
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
        return res.status(403).json({ message: "Not authorized to delete this student" });
      }
      
      // 生徒に関連する予約を取得
      const userBookings = await storage.getBookingsByUserId(userId);
      const studentBookings = userBookings.filter(booking => booking.studentId === studentId);
      
      // ユーザー情報を取得
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // 生徒の予約をすべてキャンセルし、チケットを返却
      let cancelledBookings = 0;
      let returnedTickets = 0;
      
      for (const booking of studentBookings) {
        await storage.deleteBooking(booking.id);
        cancelledBookings++;
      }
      
      // 返却されるチケット数を予約数分加算
      if (cancelledBookings > 0) {
        const newTicketCount = user.ticketCount + cancelledBookings;
        await storage.updateTicketCount(userId, newTicketCount);
        returnedTickets = cancelledBookings;
      }
      
      // 生徒を削除（論理削除）
      await storage.deleteStudent(studentId);
      
      res.json({ 
        message: "Student deleted successfully", 
        cancelledBookings,
        returnedTickets, 
        newTicketCount: user.ticketCount + returnedTickets
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete student", error });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
