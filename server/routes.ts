import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { insertBookingSchema, insertLessonReportSchema, timeSlots, type Student, type LessonReport, bookings } from "@shared/schema";
import { emailService } from "./email-service";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // すべての講師情報を取得するAPIエンドポイント
  app.get("/api/tutors", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const tutors = await db.query.tutors.findMany();
      res.json(tutors);
    } catch (error) {
      console.error("すべての講師情報取得エラー:", error);
      res.status(500).json({ error: "講師情報の取得に失敗しました" });
    }
  });
  
  // 科目、日付、時間帯、学校区分に基づいて利用可能な講師を取得するAPIエンドポイント
  app.get("/api/tutors/available", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { subject, date, timeSlot, schoolLevel } = req.query;
    
    if (!subject || !date || !timeSlot) {
      return res.status(400).json({ 
        error: "Missing required query parameters: subject, date, and timeSlot are required" 
      });
    }
    
    if (!timeSlots.includes(timeSlot as string)) {
      return res.status(400).json({ error: "Invalid time slot" });
    }
    
    try {
      // 学校区分と科目を組み合わせた検索用文字列を作成（例：「小学算数」）
      let combinedSubject = "";
      if (schoolLevel === "elementary") {
        combinedSubject = `小学${subject}`;
      } else if (schoolLevel === "junior_high") {
        combinedSubject = `中学${subject}`;
      } else if (schoolLevel === "high_school") {
        combinedSubject = `高校${subject}`;
      } else {
        combinedSubject = subject as string;
      }
      
      console.log(`[API] 利用可能な講師検索: 科目=${subject}, 日付=${date}, 時間=${timeSlot}, 学校区分=${schoolLevel}, 検索キーワード=${combinedSubject}`);
      
      // 利用可能な講師を検索（講師のsubjects列から検索）
      const tutors = await storage.getAvailableTutorsBySubject(
        combinedSubject, 
        date as string, 
        timeSlot as string
      );
      
      console.log(`[API] 検索結果: ${tutors.length}件の講師が見つかりました`);
      
      // レスポンスを整形
      const formattedTutors = tutors.map(tutor => ({
        tutorId: tutor.tutor_id,
        name: `${tutor.last_name} ${tutor.first_name}`,
        university: tutor.university,
        shiftId: tutor.shift_id,
        subject: combinedSubject
      }));
      
      res.json(formattedTutors);
    } catch (error) {
      console.error("Error fetching available tutors:", error);
      res.status(500).json({ error: "Failed to fetch available tutors" });
    }
  });

  // Get bookings for a user
  app.get("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const role = req.user!.role;
    
    // 生徒アカウントの場合、studentIdと一致する予約のみ取得
    let bookings;
    if (role === 'student' && req.user!.studentId) {
      // 保護者に紐づく予約を取得した後、生徒IDでフィルタリング
      const allBookings = await storage.getBookingsByUserId(userId);
      bookings = allBookings.filter(booking => booking.studentId === req.user!.studentId);
    } else {
      // 保護者アカウントまたは講師アカウントの場合は全ての予約を表示
      bookings = await storage.getBookingsByUserId(userId);
    }
    
    // 講師情報を追加
    const bookingsWithTutorNames = await Promise.all(
      bookings.map(async (booking) => {
        let tutorName = null;
        if (booking.tutorId) {
          const tutor = await storage.getTutor(booking.tutorId);
          if (tutor) {
            tutorName = `${tutor.lastName} ${tutor.firstName}`;
          }
        }
        return {
          ...booking,
          tutorName
        };
      })
    );
    
    res.json(bookingsWithTutorNames);
  });
  
  // 授業の詳細情報取得
  app.get("/api/bookings/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const role = req.user!.role;
    const bookingId = parseInt(req.params.id);
    
    try {
      const booking = await storage.getBookingById(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // 生徒または保護者アカウントは自分の予約のみ確認可能
      if (role === 'student' || role === 'parent') {
        // studentIdを持つ生徒アカウントの場合は、自分の予約のみアクセス可能
        if (role === 'student' && req.user!.studentId) {
          if (booking.studentId !== req.user!.studentId) {
            return res.status(403).json({ message: "Not authorized to view this booking" });
          }
        } 
        // 保護者アカウントの場合は、子供の予約のみアクセス可能
        else if (booking.userId !== userId) {
          return res.status(403).json({ message: "Not authorized to view this booking" });
        }
      }
      // 講師アカウントは自分の担当授業のみ確認可能
      else if (role === 'tutor') {
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (!tutorProfile || booking.tutorId !== tutorProfile.id) {
          return res.status(403).json({ message: "Not authorized to view this booking" });
        }
      }
      
      // 生徒情報を取得してレスポンスに追加
      let studentName = undefined;
      let tutorName = undefined;
      let studentDetails = null;
      let previousReport = null;
      
      if (booking.studentId) {
        const student = await storage.getStudent(booking.studentId);
        if (student) {
          studentName = `${student.lastName} ${student.firstName}`;
          
          // 前回の授業レポートを取得
          previousReport = await getPreviousReport(booking.studentId, booking.date, booking.tutorId);
          
          // 講師の場合は生徒の詳細情報も提供
          if (role === 'tutor') {
            studentDetails = {
              lastName: student.lastName,
              firstName: student.firstName,
              school: student.school,
              grade: student.grade,
              address: student.userId ? await getParentAddress(student.userId) : null,
              phone: student.userId ? await getParentPhone(student.userId) : null
            };
          }
        }
      }
      
      // 講師情報を取得
      if (booking.tutorId) {
        const tutor = await storage.getTutor(booking.tutorId);
        if (tutor) {
          tutorName = `${tutor.lastName} ${tutor.firstName}`;
        }
      }
      
      // lesson_reportsテーブルから授業レポート情報を取得
      const lessonReport = await storage.getLessonReportByBookingId(bookingId);
      
      // reportStatusとreportContentを更新
      let reportStatus = booking.reportStatus;
      let reportContent = booking.reportContent;
      
      // lesson_reportsテーブルにデータがあれば、そちらを優先して使用
      if (lessonReport) {
        reportStatus = "completed:" + lessonReport.createdAt.toISOString();
        
        // レポート内容をフォーマット
        reportContent = `【単元】\n${lessonReport.unitContent || ""}\n\n【伝言事項】\n${lessonReport.messageContent || ""}\n\n【来週までの目標(課題)】\n${lessonReport.goalContent || ""}`;
        
        console.log("lesson_reportsから取得したレポート:", lessonReport);
      }
      
      res.json({
        ...booking,
        reportStatus,
        reportContent,
        studentName,
        tutorName,
        studentDetails,
        previousReport,
        lessonReport // 生のレポートデータも含める
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to get booking details", error });
    }
  });

  // Create a new booking
  app.post("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const role = req.user!.role;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // 生徒アカウントの場合、生徒IDとして自分のIDを使う
    let studentId = req.body.studentId;
    if (role === 'student' && req.user!.studentId) {
      studentId = req.user!.studentId;
    }
    
    // チケット数のチェック
    // 生徒アカウントの場合は生徒のチケット、保護者アカウントの場合は生徒または全体のチケットをチェック
    if (studentId) {
      // 特定の生徒のチケットをチェック
      const ticketCount = await storage.getStudentTickets(studentId);
      if (ticketCount <= 0) {
        return res.status(400).json({ message: "生徒のチケットが不足しています" });
      }
    } else if (user.ticketCount <= 0) {
      // ユーザー全体のチケット数をチェック
      return res.status(400).json({ message: "チケットが不足しています" });
    }
    
    try {
      // 生徒アカウントの場合はstudentIdを強制的に設定
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        userId,
        studentId: studentId || req.body.studentId
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
      
      // 講師のシフトをチェック
      if (!bookingData.tutorShiftId) {
        return res.status(400).json({ message: "講師シフトIDが必要です" });
      }
      
      // シフト情報を取得
      const shift = await storage.getTutorShift(bookingData.tutorShiftId);
      if (!shift) {
        return res.status(400).json({ message: "指定されたシフトが見つかりません" });
      }
      
      // シフトが利用可能かチェック
      if (!shift.isAvailable) {
        return res.status(400).json({ message: "選択したシフトは利用できません" });
      }
      
      // 指定された講師が本当にそのシフトを持っているかチェック
      if (shift.tutorId !== bookingData.tutorId) {
        return res.status(400).json({ message: "選択したシフトとチューターが一致しません" });
      }
      
      // シフト管理をシンプル化し、subject="available"にしたので、
      // 科目のチェックをスキップし、bookingDataの科目をそのまま使用する
      if (!bookingData.subject) {
        // 科目が指定されていない場合は適切な科目を設定
        return res.status(400).json({ message: "予約には科目の指定が必要です" });
      }
      
      // Create booking and deduct one ticket
      const booking = await storage.createBooking(bookingData);
      
      // 生徒ごとのチケット管理を使用する場合
      if (bookingData.studentId) {
        // 生徒からチケットを1枚使用
        const success = await storage.useStudentTicket(bookingData.studentId);
        if (!success) {
          // チケット使用に失敗した場合は、ユーザー全体のチケットから使用（過去との互換性のため）
          await storage.updateTicketCount(userId, user.ticketCount - 1);
        } else {
          // 全体のチケット数も更新（全生徒の合計を計算して設定）
          const totalTickets = await storage.calculateUserTotalTickets(userId);
          await storage.updateTicketCount(userId, totalTickets);
        }
      } else {
        // 生徒IDが指定されていない場合は、従来通りユーザー全体のチケットから使用
        await storage.updateTicketCount(userId, user.ticketCount - 1);
      }
      
      // 予約完了後にメール送信
      try {
        if (bookingData.studentId) {
          // 生徒情報を取得
          const student = await storage.getStudent(bookingData.studentId);
          // 講師情報を取得
          const tutor = bookingData.tutorId ? await storage.getTutor(bookingData.tutorId) : undefined;
          // 保護者のメールアドレスを取得
          const parentUser = await storage.getUser(userId);
          const parentEmail = parentUser?.email || null;
          
          if (student) {
            // メール送信
            await emailService.sendBookingConfirmation(booking, student, tutor, parentEmail);
            console.log("予約完了メール送信に成功しました");
          }
        }
      } catch (emailError) {
        // メール送信に失敗しても予約自体は成功として扱う
        console.error("メール送信エラー:", emailError);
      }
      
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
      
      // チケットの返却処理
      if (booking.studentId) {
        // 生徒ごとのチケット管理を使用している場合
        // 生徒にチケットを1枚追加
        await storage.addStudentTickets(booking.studentId, userId, 1);
        
        // 全体のチケット数も更新（全生徒の合計を計算して設定）
        const totalTickets = await storage.calculateUserTotalTickets(userId);
        await storage.updateTicketCount(userId, totalTickets);
      } else {
        // 従来の方式（ユーザー全体のチケットに返却）
        await storage.updateTicketCount(userId, user.ticketCount + 1);
      }
      
      // 最新のユーザー情報を取得
      const updatedUser = await storage.getUser(userId);
      
      // キャンセル完了後にメール送信
      try {
        if (booking.studentId) {
          // 生徒情報を取得
          const student = await storage.getStudent(booking.studentId);
          // 講師情報を取得
          const tutor = booking.tutorId ? await storage.getTutor(booking.tutorId) : undefined;
          // 保護者のメールアドレスを取得
          const parentUser = await storage.getUser(userId);
          const parentEmail = parentUser?.email || null;
          
          if (student) {
            // メール送信
            await emailService.sendBookingCancellation(booking, student, tutor, parentEmail);
            console.log("キャンセル完了メール送信に成功しました");
          }
        }
      } catch (emailError) {
        // メール送信に失敗してもキャンセル自体は成功として扱う
        console.error("メール送信エラー:", emailError);
      }
      
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
    const { items, quantity } = req.body;
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // 新しいフォーマット: items: [{studentId: number, quantity: number}]
      if (items && Array.isArray(items) && items.length > 0) {
        // 各生徒のチケットを更新
        for (const item of items) {
          const { studentId, quantity: itemQuantity } = item;
          
          if (!studentId || typeof studentId !== 'number' || !itemQuantity || typeof itemQuantity !== 'number' || itemQuantity <= 0) {
            return res.status(400).json({ message: "Invalid item format. Expected studentId and quantity." });
          }
          
          // 生徒が存在し、このユーザーに属していることを確認
          const student = await storage.getStudent(studentId);
          if (!student || student.userId !== userId) {
            return res.status(404).json({ message: `Student with ID ${studentId} not found or does not belong to this user.` });
          }
          
          // student_ticketsテーブルを使って生徒ごとのチケットを管理
          await storage.addStudentTickets(studentId, userId, itemQuantity);
        }
        
        // 古いシステムとの互換性のため、ユーザーの合計チケット数も更新
        // 生徒ごとの合計を計算してユーザーに設定
        const totalTickets = await storage.calculateUserTotalTickets(userId);
        await storage.updateTicketCount(userId, totalTickets);
      }
      // 旧式の購入方法サポート（下位互換性のため）
      else if (quantity && typeof quantity === 'number' && quantity > 0) {
        const newTicketCount = user.ticketCount + quantity;
        await storage.updateTicketCount(userId, newTicketCount);
      } 
      else {
        return res.status(400).json({ message: "Invalid request format. Expected items array or quantity." });
      }
      
      // 新しいチケット数で応答
      const updatedUser = await storage.getUser(userId);
      
      res.json({ 
        ticketCount: updatedUser!.ticketCount,
        message: "Tickets purchased successfully" 
      });
    } catch (error) {
      console.error("Error purchasing tickets:", error);
      res.status(500).json({ 
        message: "Failed to purchase tickets", 
        error: (error as Error).message 
      });
    }
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
      
      // 生徒一覧を取得
      const students = await storage.getStudentsByUserId(userId);
      console.log(`[API] ${students.length}人の生徒にチケットを追加します`);
      
      // 生徒ごとにチケットを追加
      if (students.length > 0) {
        for (const student of students) {
          console.log(`[API] 生徒ID: ${student.id} (${student.lastName} ${student.firstName})にチケットを追加`);
          await storage.addStudentTickets(student.id, userId, quantity);
        }
        
        // ユーザーの全体チケット数を計算して更新
        const totalTickets = await storage.calculateUserTotalTickets(userId);
        console.log(`[API] 計算された総チケット数: ${totalTickets}`);
        await storage.updateTicketCount(userId, totalTickets);
        
        const response = { 
          ticketCount: totalTickets,
          message: `${quantity} チケットを各生徒に追加しました`
        };
        console.log("[API] レスポンス:", response);
        res.json(response);
      } else {
        // 生徒がいない場合は従来通りユーザーに直接チケットを追加
        const newTicketCount = user.ticketCount + quantity;
        console.log("[API] 新しいチケット数:", newTicketCount);
        await storage.updateTicketCount(userId, newTicketCount);
        
        const response = { 
          ticketCount: newTicketCount,
          message: `${quantity} チケットを追加しました`
        };
        console.log("[API] レスポンス:", response);
        res.json(response);
      }
    } catch (error) {
      console.error("[API] チケット追加エラー:", error);
      res.status(500).json({ message: "Internal server error", error: String(error) });
    }
  });
  
  // 開発用：テストチケットをリセット（0にする）するエンドポイント
  app.post("/api/tickets/reset", async (req, res) => {
    try {
      console.log("[API] /api/tickets/reset リクエスト受信");
      
      if (!req.isAuthenticated()) {
        console.log("[API] 認証エラー: 未ログイン");
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      const userId = req.user!.id;
      console.log("[API] ユーザーID:", userId);
      
      // ユーザーの全生徒を取得
      const students = await storage.getStudentsByUserId(userId);
      console.log(`[API] ${students.length}人の生徒のチケットをリセットします`);
      
      // 各生徒のチケットを0にリセット
      for (const student of students) {
        // 現在のチケット数を取得
        const currentTickets = await storage.getStudentTickets(student.id);
        console.log(`[API] 生徒ID: ${student.id} の現在のチケット数: ${currentTickets}`);
        
        if (currentTickets > 0) {
          // 減らすチケット数（負の値）
          const ticketsToRemove = -currentTickets;
          console.log(`[API] ${Math.abs(ticketsToRemove)}枚のチケットを削除します`);
          await storage.addStudentTickets(student.id, userId, ticketsToRemove);
        }
      }
      
      // ユーザーの全体チケット数も0にリセット
      console.log(`[API] ユーザーID: ${userId} のチケット数を0にリセットします`);
      await storage.updateTicketCount(userId, 0);
      
      const response = { 
        ticketCount: 0,
        message: "すべてのチケットを0にリセットしました"
      };
      console.log("[API] レスポンス:", response);
      
      res.json(response);
    } catch (error) {
      console.error("[API] チケットリセットエラー:", error);
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
    const role = req.user!.role;
    
    try {
      let students: Student[] = [];
      
      // 生徒アカウントの場合は自分の情報のみを取得
      if (role === 'student' && req.user!.studentId) {
        const studentId = req.user!.studentId;
        const student = await storage.getStudent(studentId);
        if (student) {
          students = [student];
        }
      } else if (role === 'tutor') {
        // 講師の場合は予約に関連する生徒情報を取得
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (tutorProfile) {
          const bookings = await storage.getBookingsByTutorId(tutorProfile.id);
          
          // 予約から生徒IDを抽出（重複を除去）
          const studentIds = new Set<number>();
          bookings.forEach(booking => {
            if (booking.studentId !== null) {
              studentIds.add(booking.studentId);
            }
          });
          
          // 生徒情報を取得
          students = await Promise.all(
            Array.from(studentIds).map(async (id) => {
              const student = await storage.getStudent(id);
              return student!;
            })
          ).then(results => results.filter(Boolean) as Student[]);
        }
      } else {
        // 保護者または通常アカウントの場合は全ての生徒情報を取得
        students = await storage.getStudentsByUserId(userId);
      }
      
      // 生徒ごとのチケット残数を取得して追加
      const studentsWithTickets = await Promise.all(
        students.map(async (student) => {
          const ticketCount = await storage.getStudentTickets(student.id);
          return {
            ...student,
            ticketCount
          };
        })
      );
      
      res.json(studentsWithTickets);
    } catch (error) {
      res.status(400).json({ message: "Failed to get students", error });
    }
  });
  
  // 生徒の詳細情報取得
  app.get("/api/students/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const studentId = parseInt(req.params.id);
    
    try {
      // 生徒の存在チェック
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // 権限チェック（講師の場合は生徒情報を見ることができる）
      const canViewStudent = 
        student.userId === userId || // 親
        req.user!.role === 'tutor' || // 講師
        (req.user!.role === 'student' && req.user!.studentId === studentId); // 自分自身
      
      if (!canViewStudent) {
        return res.status(403).json({ message: "Not authorized to view this student" });
      }
      
      // チケット残数を取得
      const ticketCount = await storage.getStudentTickets(studentId);
      
      // 詳細情報を返す
      res.json({
        id: student.id,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameFurigana: student.lastNameFurigana,
        firstNameFurigana: student.firstNameFurigana,
        gender: student.gender,
        school: student.school,
        grade: student.grade,
        ticketCount,
        // 保護者の住所情報を取得（講師表示用）
        address: student.userId ? await getParentAddress(student.userId) : null
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get student details", error });
    }
  });
  
  // 親の住所情報を取得するヘルパー関数
  async function getParentAddress(userId: number): Promise<string | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.address) return null;
      
      // 郵便番号・都道府県・市区町村・番地を組み合わせて住所を作成
      let address = '';
      if (user.postalCode) address += `〒${user.postalCode} `;
      if (user.prefecture) address += `${user.prefecture}`;
      if (user.city) address += `${user.city}`;
      if (user.address) address += `${user.address}`;
      
      return address || null;
    } catch (error) {
      console.error("Failed to get parent address:", error);
      return null;
    }
  }
  
  // 親の電話番号を取得するヘルパー関数
  async function getParentPhone(userId: number): Promise<string | null> {
    try {
      const user = await storage.getUser(userId);
      return user?.phone || null;
    } catch (error) {
      console.error("Failed to get parent phone:", error);
      return null;
    }
  }
  
  // 生徒の前回の授業レポートを取得するヘルパー関数
  async function getPreviousReport(studentId: number, currentDate: string, tutorId: number): Promise<{date: string, content: string} | null> {
    try {
      // 現在の日付より前の、同じ生徒と講師の授業を取得
      const bookings = await storage.getBookingsByTutorId(tutorId);
      
      // 現在の授業以前の、同じ生徒のレポート作成済み授業をフィルタリング
      const previousBookings = bookings.filter(b => 
        b.studentId === studentId && 
        b.date < currentDate && 
        b.reportStatus === 'completed' &&
        b.reportContent
      );
      
      // 日付で降順ソート（最新のものを先頭に）
      previousBookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // 直近の授業レポートを返す
      if (previousBookings.length > 0) {
        const mostRecent = previousBookings[0];
        return {
          date: mostRecent.date,
          content: mostRecent.reportContent || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to get previous report:", error);
      return null;
    }
  }
  
  // 生徒のチケット残数取得
  app.get("/api/students/:id/tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const studentId = parseInt(req.params.id);
    
    try {
      // 生徒の存在チェック
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // 権限チェック（生徒が自分の子供か、または自分自身の情報かどうか）
      if (student.userId !== userId && !(req.user!.role === 'student' && req.user!.studentId === studentId)) {
        return res.status(403).json({ message: "Not authorized to view this student's tickets" });
      }
      
      // チケット残数を取得
      const ticketCount = await storage.getStudentTickets(studentId);
      
      res.json({ 
        studentId, 
        ticketCount,
        studentName: `${student.lastName} ${student.firstName}`
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get student tickets", error });
    }
  });
  
  // 全生徒のチケット残数一覧取得
  app.get("/api/student-tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    try {
      // ユーザーの全生徒を取得
      const students = await storage.getStudentsByUserId(userId);
      
      // 各生徒のチケット残数を取得
      const studentTickets = await Promise.all(
        students.map(async (student) => {
          const ticketCount = await storage.getStudentTickets(student.id);
          return {
            studentId: student.id,
            name: `${student.lastName} ${student.firstName}`,
            ticketCount
          };
        })
      );
      
      res.json(studentTickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to get student tickets", error });
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

  // 講師関連のAPI
  
  // 講師プロフィール情報の取得
  app.get("/api/tutor/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      
      res.json(tutor);
    } catch (error) {
      res.status(400).json({ message: "Failed to fetch tutor profile", error });
    }
  });
  
  // 講師プロフィールの作成・更新
  app.post("/api/tutor/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      // 必須フィールドの確認
      const { 
        lastName, 
        firstName, 
        lastNameFurigana, 
        firstNameFurigana, 
        university, 
        birthDate,
        subjects,
        bio,
        email
      } = req.body;
      
      if (!lastName || !firstName || !lastNameFurigana || !firstNameFurigana || !university || !birthDate || !subjects) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }
      
      // メールアドレスが指定されている場合は、ユーザー情報を更新
      if (email) {
        await storage.updateUserSettings(userId, { email });
      }
      
      // 既存の講師プロフィールを確認
      let tutor = await storage.getTutorByUserId(userId);
      
      if (tutor) {
        // 更新
        tutor = await storage.updateTutor(tutor.id, {
          lastName,
          firstName,
          lastNameFurigana,
          firstNameFurigana,
          university,
          birthDate,
          subjects,
          email, // メールアドレスを追加
          // bio field removed as requested
          profileCompleted: true
        });
      } else {
        // 新規作成
        tutor = await storage.createTutor({
          userId,
          lastName,
          firstName,
          lastNameFurigana,
          firstNameFurigana,
          university,
          birthDate,
          subjects,
          email, // メールアドレスを追加
          // bio field removed as requested
        });
      }
      
      // ユーザーのtutorProfileCompletedフラグを更新
      await storage.updateUserSettings(userId, { tutorProfileCompleted: true });
      
      res.json(tutor);
    } catch (error) {
      res.status(400).json({ message: "Failed to save tutor profile", error });
    }
  });
  
  // 講師のシフト一覧取得
  app.get("/api/tutor/shifts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      
      const shifts = await storage.getTutorShiftsByTutorId(tutor.id);
      res.json(shifts);
    } catch (error) {
      res.status(400).json({ message: "Failed to fetch tutor shifts", error });
    }
  });
  
  // 講師のシフト登録・更新
  app.post("/api/tutor/shifts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      const { date, timeSlot, isAvailable } = req.body;
      
      if (!date || !timeSlot) {
        return res.status(400).json({ message: "Date and timeSlot are required" });
      }
      
      // 講師情報の取得
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      
      // 既存のシフトを確認
      const existingShifts = await storage.getTutorShiftsByDate(tutor.id, date);
      const existingShift = existingShifts.find(shift => shift.timeSlot === timeSlot);
      
      let shift;
      
      if (existingShift) {
        // 既存のシフトを更新
        shift = await storage.updateTutorShift(existingShift.id, {
          isAvailable: isAvailable ?? existingShift.isAvailable,
          subject: "available" // シフト更新時にsubjectも強制的に上書き
        });
      } else {
        // 新しいシフトを作成
        shift = await storage.createTutorShift({
          tutorId: tutor.id,
          date,
          timeSlot,
          subject: "available", // デフォルト値として "available" を設定
          isAvailable: isAvailable ?? false
        });
      }
      
      res.json(shift);
    } catch (error) {
      res.status(400).json({ message: "Failed to update tutor shift", error });
    }
  });
  
  // 特定日の講師シフト取得
  app.get("/api/tutor/shifts/:date", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      
      const date = req.params.date;
      // 日付形式のバリデーション (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const shifts = await storage.getTutorShiftsByDate(tutor.id, date);
      res.json(shifts);
    } catch (error) {
      res.status(400).json({ message: "Failed to fetch tutor shifts for date", error });
    }
  });
  

  
  // 講師の予約一覧取得
  app.get("/api/tutor/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    
    // ユーザーが講師かどうかチェック
    if (req.user!.role !== "tutor") {
      return res.status(403).json({ message: "Access denied. User is not a tutor" });
    }
    
    try {
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      
      console.log(`講師ID: ${tutor.id} の予約を取得します`);
      
      // 予約データを取得
      let bookingsList = [];
      try {
        // storage経由で取得
        bookingsList = await storage.getBookingsByTutorId(tutor.id);
      } catch (dbErr) {
        console.error("予約取得エラー:", dbErr);
      }
      
      console.log(`取得された予約データ: ${JSON.stringify(bookingsList)}`);
      
      if (!bookingsList || bookingsList.length === 0) {
        console.log("講師の予約が見つかりませんでした");
        
        // データベース内の全予約を確認
        try {
          console.log("データベース内の全予約を確認します...");
          const allBookings = await db.query.bookings.findMany();
          console.log(`全予約データが見つかりました`);
          
          // tutorIdに問題があるか確認
          console.log(`検索している講師ID: ${tutor.id}`);
          const matchingBookings = allBookings.filter(b => b.tutorId === tutor.id);
          console.log(`一致する予約が見つかりました`);
          
          if (matchingBookings.length > 0) {
            console.log("一致する予約が見つかりましたが、クエリ結果に含まれていません");
            bookingsList = matchingBookings;
          }
        } catch (err) {
          console.error("データベース検索エラー:", err);
        }
      }
      
      // 生徒名を付加した予約情報を作成
      const bookingsWithStudentInfo = await Promise.all(
        bookingsList.map(async (booking) => {
          let studentName = undefined;
          
          if (booking.studentId) {
            const student = await storage.getStudent(booking.studentId);
            if (student) {
              studentName = `${student.lastName} ${student.firstName}`;
            }
          }
          
          return {
            ...booking,
            studentName
          };
        })
      );
      
      console.log(`返却する予約データ (${bookingsWithStudentInfo.length}件)を準備しました`);
      
      res.json(bookingsWithStudentInfo);
    } catch (error) {
      console.error("講師の予約取得エラー:", error);
      res.status(400).json({ message: "Failed to fetch tutor bookings", error: String(error) });
    }
  });

  // 生徒用アカウントの作成
  app.post("/api/students/:id/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const studentId = parseInt(req.params.id);
    
    try {
      // 生徒情報の取得
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // 権限チェック（親アカウントと生徒の紐付け確認）
      if (student.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to create account for this student" });
      }
      
      // ランダムなユーザー名を生成（生徒ID + ランダムな4桁の数字）
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const username = `student${student.id}_${randomDigits}`;
      
      // ランダムなパスワードを生成
      const password = `pass${Math.floor(100000 + Math.random() * 900000)}`;
      
      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(password);
      
      // 生徒アカウントの作成
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        role: "student",
        studentId: studentId,
        parentId: userId,
        displayName: `${student.lastName} ${student.firstName}`,
        email: req.user!.email || "",
        ticketCount: 0 // 生徒アカウントにはチケットは不要
      });
      
      // 生徒情報を更新して関連アカウントIDを設定
      // 注意: ここではuserId（親ID）をそのままにして、studentAccountIdを設定
      await storage.updateStudent(studentId, { 
        studentAccountId: newUser.id,
        isActive: true
      });
      
      res.status(201).json({ 
        message: "Student account created successfully",
        student: {
          id: student.id,
          name: `${student.lastName} ${student.firstName}`,
          username: newUser.username
        }
      });
    } catch (error) {
      console.error("Failed to create student account:", error);
      res.status(500).json({ message: "Failed to create student account", error });
    }
  });

  // 生徒アカウント情報を取得（親アカウントのみ）
  app.get("/api/students/account/:accountId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accountId } = req.params;
    const userId = req.user!.id;

    try {
      // アカウントIDがない場合
      if (!accountId) {
        return res.status(400).json({ message: "Account ID is required" });
      }

      console.log(`Fetching account info for accountId: ${accountId}`);
      
      // 当該studentId実際の生徒情報を取得
      const allStudents = await storage.getStudentsByUserId(userId);
      const student = allStudents.find(s => s.studentAccountId === parseInt(accountId));
      
      if (!student) {
        // 生徒が見つからない場合はユーザー情報から直接取得する方法を試みる
        const studentUser = await storage.getUser(parseInt(accountId));
        
        if (!studentUser || studentUser.parentId !== userId) {
          return res.status(404).json({ message: "Student account not found or you don't have permission" });
        }
        
        // 生徒ユーザーのstudentIdから生徒情報を取得
        const studentInfo = await storage.getStudent(studentUser.studentId!);
        if (!studentInfo) {
          return res.status(404).json({ message: "Student information not found" });
        }
        
        // フルネーム作成
        const fullName = `${studentInfo.lastName} ${studentInfo.firstName}`;
        
        // 生徒アカウント情報を返す
        return res.json({
          username: studentUser.username,
          password: "••••••••", // パスワードはマスクする
          fullName,
          email: studentUser.email,
          accountId: studentUser.id,
          passwordLastUpdated: new Date().toISOString() // パスワード更新時刻を追加
        });
      }
      
      // studentAccountIdを持つ生徒情報を基に、ユーザーアカウント情報を取得
      if (!student.studentAccountId) {
        return res.status(404).json({ message: "No student account found" });
      }
      const studentUser = await storage.getUser(student.studentAccountId);
      if (!studentUser) {
        return res.status(404).json({ message: "Student user account not found" });
      }
      
      // フルネーム作成
      const fullName = `${student.lastName} ${student.firstName}`;
      
      // 生徒アカウント情報を返す
      res.json({
        username: studentUser.username,
        password: "••••••••", // パスワードはマスクする
        fullName,
        email: studentUser.email,
        accountId: studentUser.id,
        passwordLastUpdated: new Date().toISOString() // パスワード更新時刻を追加
      });
    } catch (error) {
      console.error("Failed to get student account:", error);
      res.status(500).json({ message: "Failed to get student account information", error: String(error) });
    }
  });
  
  // 生徒アカウントのパスワードリセット
  app.post("/api/students/account/:accountId/reset-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accountId } = req.params;
    const userId = req.user!.id;

    try {
      // アカウントID存在チェック
      if (!accountId) {
        return res.status(400).json({ message: "Account ID is required" });
      }
      
      // 対象ユーザーが存在するか確認
      const studentUser = await storage.getUser(parseInt(accountId));
      if (!studentUser) {
        return res.status(404).json({ message: "Student account not found" });
      }
      
      // 権限チェック（親アカウントIDが現在のユーザーIDと一致するか確認）
      if (studentUser.parentId !== userId) {
        return res.status(403).json({ message: "You do not have permission to reset this password" });
      }
      
      // 新しいパスワードを生成（単純化のため固定文字列 + ランダム数字）
      const newPassword = `student${Math.floor(1000 + Math.random() * 9000)}`;
      
      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(newPassword);
      
      // ユーザー情報を更新
      await storage.updateUserPassword(parseInt(accountId), hashedPassword);
      
      res.json({
        success: true,
        password: newPassword
      });
    } catch (error) {
      console.error("Failed to reset password:", error);
      res.status(500).json({ message: "Failed to reset password", error: String(error) });
    }
  });
  
  // 生徒アカウントのユーザー名変更
  app.patch("/api/students/account/:accountId/username", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accountId } = req.params;
    const { username } = req.body;
    const userId = req.user!.id;

    try {
      // 入力チェック
      if (!accountId) {
        return res.status(400).json({ message: "Account ID is required" });
      }
      
      if (!username || username.length < 4) {
        return res.status(400).json({ message: "Username must be at least 4 characters long" });
      }
      
      // 対象ユーザーが存在するか確認
      const studentUser = await storage.getUser(parseInt(accountId));
      if (!studentUser) {
        return res.status(404).json({ message: "Student account not found" });
      }
      
      // 権限チェック（親アカウントIDが現在のユーザーIDと一致するか確認）
      if (studentUser.parentId !== userId) {
        return res.status(403).json({ message: "You do not have permission to change this username" });
      }
      
      // ユーザー名の重複チェック
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== parseInt(accountId)) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // ユーザー名を更新
      await storage.updateUsername(parseInt(accountId), username);
      
      res.json({
        success: true,
        username
      });
    } catch (error) {
      console.error("Failed to update username:", error);
      res.status(500).json({ message: "Failed to update username", error: String(error) });
    }
  });
  
  // 生徒アカウントのパスワード変更
  app.patch("/api/students/account/:accountId/password", async (req, res) => {
    res.type('application/json'); // 明示的にContent-Typeを設定
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accountId } = req.params;
    const { password } = req.body;
    const userId = req.user!.id;

    try {
      // 入力チェック
      if (!accountId) {
        return res.status(400).json({ message: "Account ID is required" });
      }
      
      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      
      // 対象ユーザーが存在するか確認
      const studentUser = await storage.getUser(parseInt(accountId));
      if (!studentUser) {
        return res.status(404).json({ message: "Student account not found" });
      }
      
      // 権限チェック（親アカウントIDが現在のユーザーIDと一致するか確認）
      if (studentUser.parentId !== userId) {
        return res.status(403).json({ message: "You do not have permission to change this password" });
      }
      
      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(password);
      
      // パスワードを更新
      await storage.updateUserPassword(parseInt(accountId), hashedPassword);
      
      // Express.jsのjson()メソッドを使用して正しいContent-Typeを設定
      return res.json({
        success: true,
        message: "Password updated successfully"
      });
    } catch (error) {
      console.error("Failed to update password:", error);
      res.status(500).json({ message: "Failed to update password", error: String(error) });
    }
  });

  // レポート更新エンドポイント - 新しいlesson_reportsテーブルを使用
  app.post("/api/bookings/:id/report", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "認証が必要です" });
      
      const userId = req.user!.id;
      const bookingId = parseInt(req.params.id);
      
      // 新しいフォーマット（unit, message, goal）を取得
      const { unit, message, goal, reportContent: oldFormatContent } = req.body;
      
      if (isNaN(bookingId)) {
        return res.status(400).json({ message: "予約IDが無効です" });
      }
      
      // 入力フィールドの検証
      let unitContent = '';
      let messageContent = '';
      let goalContent = '';
      
      // 新しいフォーマットの場合
      if (unit !== undefined || message !== undefined || goal !== undefined) {
        // 最低でも1つのフィールドに内容があるか確認
        if ((!unit || unit.trim() === '') && 
            (!message || message.trim() === '') && 
            (!goal || goal.trim() === '')) {
          return res.status(400).json({ message: "少なくとも1つのフィールドに内容を入力してください" });
        }
        
        unitContent = unit || '';
        messageContent = message || '';
        goalContent = goal || '';
      } 
      // 旧式形式の場合、内容を解析して新しい形式に変換
      else if (oldFormatContent) {
        const parts = oldFormatContent.split('\n\n');
        if (parts.length >= 3) {
          unitContent = parts[0].replace('【単元】\n', '');
          messageContent = parts[1].replace('【伝言事項】\n', '');
          goalContent = parts[2].replace('【来週までの目標(課題)】\n', '');
        } else {
          // 旧式形式が期待の形式でない場合は全体をunitContentに格納
          unitContent = oldFormatContent;
        }
      }
      else {
        return res.status(400).json({ message: "レポート内容が必要です" });
      }
      
      // 予約情報を取得
      const booking = await storage.getBookingById(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      
      // 講師情報を取得
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(403).json({ message: "講師情報が見つかりません" });
      }
      
      // 予約が講師のものか確認（講師のみがレポートを作成可能）
      if (booking.tutorId !== tutor.id) {
        return res.status(403).json({ message: "この予約のレポートを作成する権限がありません" });
      }
      
      // 既存のレポートを確認
      const existingReport = await storage.getLessonReportByBookingId(bookingId);
      let report;
      
      if (existingReport) {
        // 既存のレポートを更新
        report = await storage.updateLessonReport(existingReport.id, {
          unitContent,
          messageContent,
          goalContent
        });
      } else {
        // 新しいレポートを作成
        report = await storage.createLessonReport({
          tutorId: tutor.id,
          studentId: booking.studentId,
          bookingId: bookingId,
          unitContent,
          messageContent,
          goalContent,
          date: booking.date,
          timeSlot: booking.timeSlot
        });
      }
      
      res.status(200).json({
        message: "レポートが正常に保存されました",
        report,
        booking
      });
    } catch (error) {
      console.error("レポート更新エラー:", error);
      res.status(500).json({ message: "レポート更新中にエラーが発生しました" });
    }
  });

  // レッスンレポート関連のエンドポイント - 特定の予約に紐づくレポートを取得
  
  // 講師のすべてのレポートを取得
  app.get("/api/lesson-reports/tutor/:tutorId?", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      const userId = req.user!.id;
      
      // 講師情報を取得
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(403).json({ message: "講師情報が見つかりません" });
      }
      
      // URLパラメータのtutorIdが指定されている場合はそれを使用
      // そうでない場合は認証済みユーザーの講師IDを使用
      const targetTutorId = req.params.tutorId ? parseInt(req.params.tutorId) : tutor.id;
      
      // tutorIdが数値でない場合はエラー
      if (isNaN(targetTutorId)) {
        return res.status(400).json({ message: "不正な講師IDです" });
      }
      
      // 自分以外の講師のレポートを取得しようとした場合は拒否
      if (targetTutorId !== tutor.id) {
        return res.status(403).json({ message: "他の講師のレポートを閲覧する権限がありません" });
      }
      
      // レッスンレポート一覧を取得
      const reports = await storage.getLessonReportsByTutorId(targetTutorId);
      
      res.status(200).json(reports);
    } catch (error) {
      console.error("レポート一覧取得エラー:", error);
      res.status(500).json({ message: "レポート一覧取得中にエラーが発生しました" });
    }
  });
  
  // 生徒のすべてのレポートを取得
  app.get("/api/lesson-reports/student/:studentId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      const userId = req.user!.id;
      const studentId = parseInt(req.params.studentId);
      
      if (isNaN(studentId)) {
        return res.status(400).json({ message: "不正な生徒IDです" });
      }
      
      // 生徒情報を取得して権限チェック
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "生徒が見つかりません" });
      }
      
      // 親ユーザーまたは講師のみアクセス可能
      if (student.userId !== userId) {
        // 講師の場合は担当する生徒のレポートのみ閲覧可能
        const tutor = await storage.getTutorByUserId(userId);
        if (!tutor) {
          return res.status(403).json({ message: "このレポートを閲覧する権限がありません" });
        }
        
        // さらなる権限チェックが必要な場合はここに追加
      }
      
      // レッスンレポート一覧を取得
      const reports = await storage.getLessonReportsByStudentId(studentId);
      
      res.status(200).json(reports);
    } catch (error) {
      console.error("生徒レポート一覧取得エラー:", error);
      res.status(500).json({ message: "生徒レポート一覧取得中にエラーが発生しました" });
    }
  });
  
  // レッスンレポートを新規作成または更新
  app.post("/api/lesson-reports", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      const userId = req.user!.id;
      const { bookingId, unitContent, messageContent, goalContent, id } = req.body;
      
      if (!bookingId || isNaN(parseInt(bookingId))) {
        return res.status(400).json({ message: "不正な予約IDです" });
      }
      
      // 最低でも1つのフィールドに内容があるか確認
      if ((!unitContent || unitContent.trim() === '') && 
          (!messageContent || messageContent.trim() === '') && 
          (!goalContent || goalContent.trim() === '')) {
        return res.status(400).json({ message: "少なくとも1つのフィールドに内容を入力してください" });
      }
      
      // 予約情報を取得
      const booking = await storage.getBookingById(parseInt(bookingId));
      if (!booking) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      
      // 講師情報を取得
      const tutor = await storage.getTutorByUserId(userId);
      if (!tutor) {
        return res.status(403).json({ message: "講師情報が見つかりません" });
      }
      
      // 予約が講師のものか確認（講師のみがレポートを作成可能）
      if (booking.tutorId !== tutor.id) {
        return res.status(403).json({ message: "この予約のレポートを作成する権限がありません" });
      }
      
      let result;
      
      // idが指定されていれば更新、そうでなければ新規作成
      if (id) {
        // 更新処理
        result = await storage.updateLessonReport(parseInt(id), {
          unitContent,
          messageContent,
          goalContent
        });
      } else {
        // 既存のレポートを確認
        const existingReport = await storage.getLessonReportByBookingId(parseInt(bookingId));
        
        if (existingReport) {
          // 既に存在する場合は更新
          result = await storage.updateLessonReport(existingReport.id, {
            unitContent,
            messageContent,
            goalContent
          });
        } else {
          // 新規作成
          result = await storage.createLessonReport({
            tutorId: tutor.id,
            studentId: booking.studentId,
            bookingId: parseInt(bookingId),
            unitContent,
            messageContent,
            goalContent,
            date: booking.date,
            timeSlot: booking.timeSlot
          });
        }
      }
      
      res.status(200).json({
        message: "レッスンレポートが正常に保存されました",
        report: result
      });
    } catch (error) {
      console.error("レッスンレポート保存エラー:", error);
      res.status(500).json({ message: "レッスンレポート保存中にエラーが発生しました" });
    }
  });

  // テスト用データ作成エンドポイント（開発環境でのみ使用）
  app.get("/api/test/create-test-booking", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証が必要です" });
      }
      
      // 誰でもテストデータを作成できるようにします
      const tutorId = 2; // テスト用講師ID
      const tutorShiftId = 3; // 適当なシフトID（本来はチェックが必要）
      const userId = 3; // テスト用生徒の親ユーザーID
      const studentId = 4; // テスト用生徒ID
      
      // 過去の授業データを作成 (5月1日)
      const testBooking1 = await storage.createBooking({
        userId: userId,
        studentId: studentId,
        tutorId: tutorId,
        tutorShiftId: tutorShiftId,
        date: "2025-05-01", // 5月1日
        timeSlot: "16:00-17:30",
        subject: "小学算数",
        status: "confirmed",
        reportStatus: "completed", // レポート作成済みに設定
        reportContent: "【単元】\n割り算の応用問題\n\n【伝言事項】\n基本的な計算はよくできています。\n\n【来週までの目標(課題)】\n教科書p.45-46の問題を解いてみましょう。"
      });
      
      // 過去の授業データを作成 (4月15日)
      const testBooking2 = await storage.createBooking({
        userId: userId,
        studentId: studentId,
        tutorId: tutorId,
        tutorShiftId: tutorShiftId,
        date: "2025-04-15", // 4月15日
        timeSlot: "18:00-19:30",
        subject: "小学算数",
        status: "confirmed",
        reportStatus: "completed", 
        reportContent: "【単元】\n分数の足し算と引き算\n\n【伝言事項】\n分母が同じ場合の計算はスムーズにできていました。分母が異なる場合は少し苦戦していましたが、最終的には理解できたようです。\n\n【来週までの目標(課題)】\n教科書p.32-33の練習問題を解いておいてください。"
      });
      
      // 過去の授業データを作成 (3月20日)
      const testBooking3 = await storage.createBooking({
        userId: userId,
        studentId: studentId,
        tutorId: tutorId,
        tutorShiftId: tutorShiftId,
        date: "2025-03-20", // 3月20日
        timeSlot: "16:00-17:30",
        subject: "小学算数",
        status: "confirmed",
        reportStatus: "completed",
        reportContent: "【単元】\n小数の掛け算\n\n【伝言事項】\n小数点の位置の移動について理解するのに時間がかかりましたが、最終的には概念を把握できました。\n\n【来週までの目標(課題)】\n小数の掛け算練習プリントを完成させてください。"
      });
      
      res.status(201).json({
        message: "テスト用の過去授業データが作成されました",
        bookings: [testBooking1, testBooking2, testBooking3]
      });
    } catch (error) {
      console.error("テストデータ作成エラー:", error);
      res.status(500).json({ message: "テストデータの作成に失敗しました", error: error.message });
    }
  });

  // レッスンレポート関連のエンドポイント
  // レポートIDで特定のレポートを取得
  app.get("/api/lesson-reports/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const reportId = parseInt(req.params.id);
    
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "無効なレポートIDです" });
    }
    
    try {
      // レポートを取得
      const report = await storage.getLessonReportById(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "レポートが見つかりません" });
      }
      
      // 権限チェック: 自分の予約または担当する授業のレポートのみアクセス可能
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // 予約情報を取得して詳細な権限チェックを行う
      const booking = await storage.getBookingById(report.bookingId);
      if (!booking) {
        return res.status(404).json({ message: "関連する予約が見つかりません" });
      }
      
      if (userRole === 'tutor') {
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (!tutorProfile || report.tutorId !== tutorProfile.id) {
          return res.status(403).json({ message: "このレポートへのアクセス権限がありません" });
        }
      } else {
        // 生徒または保護者の場合は自分の予約のみアクセス可能
        if (booking.userId !== userId && (!req.user!.studentId || booking.studentId !== req.user!.studentId)) {
          return res.status(403).json({ message: "このレポートへのアクセス権限がありません" });
        }
      }
      
      res.json(report);
    } catch (error) {
      console.error("レポート取得エラー:", error);
      res.status(500).json({ message: "レッスンレポートの取得に失敗しました", error: error.message });
    }
  });
  
  // 特定の予約に関連するレポートを取得
  app.get("/api/lesson-reports/booking/:bookingId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const bookingId = parseInt(req.params.bookingId);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({ message: "無効な予約IDです" });
    }
    
    try {
      // まず予約情報を取得して権限チェック
      const booking = await storage.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      
      // 権限チェック: 自分の予約または担当する授業のレポートのみアクセス可能
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      if (userRole === 'tutor') {
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (!tutorProfile || booking.tutorId !== tutorProfile.id) {
          return res.status(403).json({ message: "このレポートへのアクセス権限がありません" });
        }
      } else {
        // 生徒または保護者の場合は自分の予約のみアクセス可能
        if (booking.userId !== userId && (!req.user!.studentId || booking.studentId !== req.user!.studentId)) {
          return res.status(403).json({ message: "このレポートへのアクセス権限がありません" });
        }
      }
      
      // レポートを取得
      const report = await storage.getLessonReportByBookingId(bookingId);
      res.json(report || null);
    } catch (error) {
      console.error("レポート取得エラー:", error);
      res.status(500).json({ message: "レッスンレポートの取得に失敗しました", error: error.message });
    }
  });
  
  // レッスンレポートを作成
  app.post("/api/lesson-reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    // 講師のみレポート作成可能
    if (userRole !== 'tutor') {
      return res.status(403).json({ message: "講師のみレポート作成が可能です" });
    }
    
    try {
      // 講師IDを取得
      const tutorProfile = await storage.getTutorByUserId(userId);
      if (!tutorProfile) {
        return res.status(404).json({ message: "講師プロフィールが見つかりません" });
      }
      
      // リクエストデータをバリデーション
      const reportData = insertLessonReportSchema.parse({
        ...req.body,
        tutorId: tutorProfile.id
      });
      
      // 予約データを取得して権限チェック
      const booking = await storage.getBookingById(reportData.bookingId);
      if (!booking) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      
      // この講師がこの授業を担当しているか確認
      if (booking.tutorId !== tutorProfile.id) {
        return res.status(403).json({ message: "この授業のレポートを作成する権限がありません" });
      }
      
      // 既存のレポートがあるか確認
      const existingReport = await storage.getLessonReportByBookingId(reportData.bookingId);
      if (existingReport) {
        return res.status(400).json({ message: "この予約に対するレポートは既に存在します" });
      }
      
      // 予約から日付と時間情報を追加
      const reportDataWithDate = {
        ...reportData,
        date: booking.date,        // 予約から日付情報を取得
        timeSlot: booking.timeSlot // 予約から時間情報を取得
      };

      // レポートを作成
      const report = await storage.createLessonReport(reportDataWithDate);
      res.status(201).json(report);
    } catch (error) {
      console.error("レポート作成エラー:", error);
      res.status(400).json({ message: "レッスンレポートの作成に失敗しました", error: error.message });
    }
  });
  
  // レッスンレポートを更新
  app.put("/api/lesson-reports/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const reportId = parseInt(req.params.id);
    
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "無効なレポートIDです" });
    }
    
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    // 講師のみレポート更新可能
    if (userRole !== 'tutor') {
      return res.status(403).json({ message: "講師のみレポート更新が可能です" });
    }
    
    try {
      // 講師IDを取得
      const tutorProfile = await storage.getTutorByUserId(userId);
      if (!tutorProfile) {
        return res.status(404).json({ message: "講師プロフィールが見つかりません" });
      }
      
      // リクエストデータをバリデーション
      const reportUpdateData = {
        ...req.body
      };
      
      // レポートを取得して権限チェック
      const existingReports = await storage.getLessonReportsByTutorId(tutorProfile.id);
      const report = existingReports.find(r => r.id === reportId);
      
      if (!report) {
        return res.status(404).json({ message: "レポートが見つからないか、このレポートを編集する権限がありません" });
      }
      
      // レポートを更新
      const updatedReport = await storage.updateLessonReport(reportId, reportUpdateData);
      res.json(updatedReport);
    } catch (error) {
      console.error("レポート更新エラー:", error);
      res.status(400).json({ message: "レッスンレポートの更新に失敗しました", error: error.message });
    }
  });
  
  // 特定の生徒のレッスンレポート一覧を取得
  app.get("/api/lesson-reports/student/:studentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const studentId = parseInt(req.params.studentId);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "無効な生徒IDです" });
    }
    
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    try {
      // 権限チェック
      if (userRole === 'student') {
        // 生徒は自分のレポートのみ閲覧可能
        if (req.user!.studentId !== studentId) {
          return res.status(403).json({ message: "このレポート一覧へのアクセス権限がありません" });
        }
      } else if (userRole === 'parent') {
        // 保護者は自分の子供のレポートのみ閲覧可能
        const students = await storage.getStudentsByUserId(userId);
        const isMyStudent = students.some(student => student.id === studentId);
        if (!isMyStudent) {
          return res.status(403).json({ message: "このレポート一覧へのアクセス権限がありません" });
        }
      } else if (userRole !== 'admin') { // 管理者はすべてのレポートにアクセス可能
        // 講師は自分が担当した授業のレポートのみ閲覧可能
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (!tutorProfile) {
          return res.status(403).json({ message: "このレポート一覧へのアクセス権限がありません" });
        }
        // ここでは講師IDをチェックせず、レポート一覧取得時にフィルタリングされるため権限チェックは省略
      }
      
      // レポート一覧を取得
      const reports = await storage.getLessonReportsByStudentId(studentId);
      
      // 講師の場合は自分が担当したレポートのみフィルタリング
      if (userRole === 'tutor') {
        const tutorProfile = await storage.getTutorByUserId(userId);
        const filteredReports = reports.filter(report => report.tutorId === tutorProfile!.id);
        res.json(filteredReports);
      } else {
        res.json(reports);
      }
    } catch (error) {
      console.error("レポート一覧取得エラー:", error);
      res.status(500).json({ message: "レッスンレポート一覧の取得に失敗しました", error: error.message });
    }
  });
  
  // 講師のレッスンレポート一覧を取得
  app.get("/api/lesson-reports/tutor", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    // 講師のみ自分のレポート一覧を取得可能
    if (userRole !== 'tutor' && userRole !== 'admin') {
      return res.status(403).json({ message: "講師のみレポート一覧を取得できます" });
    }
    
    try {
      if (userRole === 'tutor') {
        // 講師IDを取得
        const tutorProfile = await storage.getTutorByUserId(userId);
        if (!tutorProfile) {
          return res.status(404).json({ message: "講師プロフィールが見つかりません" });
        }
        
        // レポート一覧を取得
        const reports = await storage.getLessonReportsByTutorId(tutorProfile.id);
        res.json(reports);
      } else {
        // 管理者の場合、講師IDをクエリパラメータで指定可能
        const tutorId = req.query.tutorId ? parseInt(req.query.tutorId as string) : null;
        
        if (tutorId) {
          const reports = await storage.getLessonReportsByTutorId(tutorId);
          res.json(reports);
        } else {
          // 講師IDが指定されていない場合は400エラー
          res.status(400).json({ message: "講師IDを指定してください" });
        }
      }
    } catch (error) {
      console.error("レポート一覧取得エラー:", error);
      res.status(500).json({ message: "レッスンレポート一覧の取得に失敗しました", error: error.message });
    }
  });

  // PayPal関連のAPIエンドポイント
  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });
  
  // 支払い取引の記録
  app.post("/api/payment-transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { transactionId, amount, currency, status, paymentMethod, metadata } = req.body;
      const userId = req.user!.id;
      
      if (!transactionId || !amount || !status) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // メタデータをJSON文字列に変換
      const metadataStr = metadata ? JSON.stringify(metadata) : null;
      
      const transaction = await storage.createPaymentTransaction({
        userId,
        transactionId,
        amount,
        currency: currency || "JPY",
        status,
        paymentMethod: paymentMethod || "paypal",
        metadata: metadataStr
      });
      
      // チケットの追加処理
      if (status === "completed" && metadata && metadata.ticketData) {
        const { studentId, quantity } = metadata.ticketData;
        if (studentId && quantity > 0) {
          await storage.addStudentTickets(studentId, userId, quantity);
        }
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("支払い取引記録エラー:", error);
      res.status(500).json({ error: "Failed to record payment transaction" });
    }
  });
  
  // ユーザーの支払い取引履歴を取得
  app.get("/api/payment-transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = req.user!.id;
      const transactions = await storage.getUserPaymentTransactions(userId);
      
      res.json(transactions);
    } catch (error) {
      console.error("支払い取引履歴取得エラー:", error);
      res.status(500).json({ error: "Failed to get payment transactions" });
    }
  });
  
  // 生徒別チケット情報を取得するAPIエンドポイント
  app.get("/api/student-tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user!.id;
    const role = req.user!.role;
    
    try {
      let result: Array<{studentId: number, name: string, ticketCount: number}> = [];
      
      // 生徒アカウントの場合
      if (role === 'student' && req.user!.studentId) {
        const studentId = req.user!.studentId;
        const student = await storage.getStudent(studentId);
        
        if (student) {
          const ticketCount = await storage.getStudentTickets(studentId);
          result = [{
            studentId: student.id,
            name: `${student.lastName} ${student.firstName}`,
            ticketCount
          }];
        }
      } 
      // 保護者アカウントの場合
      else {
        const students = await storage.getStudentsByUserId(userId);
        
        if (students && students.length > 0) {
          // 生徒ごとにチケット情報を取得
          result = await Promise.all(
            students.map(async (student) => {
              const ticketCount = await storage.getStudentTickets(student.id);
              return {
                studentId: student.id,
                name: `${student.lastName} ${student.firstName}`,
                ticketCount
              };
            })
          );
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("生徒別チケット情報取得エラー:", error);
      res.status(500).json({ error: "チケット情報の取得に失敗しました" });
    }
  });
  
  // すべてのレッスンレポート取得 (保護者/生徒向け)
  app.get("/api/lesson-reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      
      // 生徒アカウントの場合は自分のレポートのみ取得
      if (role === 'student' && req.user!.studentId) {
        const studentId = req.user!.studentId;
        const reports = await storage.getLessonReportsByStudentId(studentId);
        
        // 日付の降順でソート
        reports.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        return res.json(reports);
      }
      
      // 保護者に紐づく生徒のIDを取得
      const students = await storage.getStudentsByUserId(userId);
      
      if (!students || students.length === 0) {
        return res.json([]);
      }
      
      // すべての生徒のレポートを取得するためのプロミス配列
      const reportPromises = students.map(student => 
        storage.getLessonReportsByStudentId(student.id)
      );
      
      // すべてのプロミスを解決
      const reportsArrays = await Promise.all(reportPromises);
      
      // すべてのレポートを結合
      const allReports = reportsArrays.flat();
      
      // 日付の降順でソート
      allReports.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      res.json(allReports);
    } catch (error) {
      console.error("レッスンレポート一覧取得エラー:", error);
      res.status(500).json({ error: "レッスンレポートの取得に失敗しました" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
