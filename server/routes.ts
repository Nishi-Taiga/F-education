import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { insertBookingSchema, timeSlots, type Student } from "@shared/schema";
import { emailService } from "./email-service";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
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
    const bookings = await storage.getBookingsByUserId(userId);
    res.json(bookings);
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
      
      res.json({
        ...booking,
        studentName,
        tutorName,
        studentDetails,
        previousReport
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to get booking details", error });
    }
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
      
      const bookings = await storage.getBookingsByTutorId(tutor.id);
      
      // 生徒名を付加した予約情報を作成
      const bookingsWithStudentInfo = await Promise.all(
        bookings.map(async (booking) => {
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
      
      res.json(bookingsWithStudentInfo);
    } catch (error) {
      res.status(400).json({ message: "Failed to fetch tutor bookings", error });
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

  // レポート更新エンドポイント
  app.post("/api/bookings/:id/report", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "認証が必要です" });
      
      const userId = req.user!.id;
      const bookingId = parseInt(req.params.id);
      
      // 新しいフォーマット（unit, message, goal）をサポート
      // 旧式形式（reportContent）との互換性も維持
      const { unit, message, goal, reportContent: oldFormatContent } = req.body;
      
      if (isNaN(bookingId)) {
        return res.status(400).json({ message: "予約IDが無効です" });
      }
      
      let reportContent = '';
      
      // 新しいフォーマットの場合
      if (unit !== undefined || message !== undefined || goal !== undefined) {
        // 最低でも1つのフィールドに内容があるか確認
        if ((!unit || unit.trim() === '') && 
            (!message || message.trim() === '') && 
            (!goal || goal.trim() === '')) {
          return res.status(400).json({ message: "少なくとも1つのフィールドに内容を入力してください" });
        }
        
        // フォーマットされたレポート内容を作成
        reportContent = `【単元】\n${unit || ''}\n\n【伝言事項】\n${message || ''}\n\n【来週までの目標(課題)】\n${goal || ''}`;
      } 
      // 旧式形式の場合
      else if (oldFormatContent) {
        reportContent = oldFormatContent;
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
      
      // レポートステータスに現在のタイムスタンプを追加
      const reportStatus = `completed:${new Date().toISOString()}`;
      
      // レポートを更新
      const updatedBooking = await storage.updateBookingReport(bookingId, reportStatus, reportContent);
      
      res.status(200).json({
        message: "レポートが正常に保存されました",
        booking: updatedBooking
      });
    } catch (error) {
      console.error("レポート更新エラー:", error);
      res.status(500).json({ message: "レポート更新中にエラーが発生しました" });
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

  const httpServer = createServer(app);

  return httpServer;
}
