import { 
  users, bookings, students, tutors, tutorShifts, studentTickets, paymentTransactions, lessonReports,
  type User, type InsertUser, type Booking, type InsertBooking, 
  type Student, type InsertStudent, type Tutor, type InsertTutor,
  type TutorShift, type InsertTutorShift, type InsertPaymentTransaction, type PaymentTransaction,
  type LessonReport, type InsertLessonReport
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { hashPassword } from "./auth";
import { db, pool } from "./db";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // ユーザー関連
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateTicketCount(userId: number, ticketCount: number): Promise<User>;
  updateUserSettings(userId: number, settings: Partial<User>): Promise<User>;
  updateUserProfile(
    userId: number,
    parentName: string,
    phone: string, 
    postalCode: string,
    prefecture: string,
    city: string,
    address: string
  ): Promise<User>;
  updateUsername(userId: number, username: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  
  // 生徒関連
  getStudentsByUserId(userId: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<Student>): Promise<Student>;
  deleteStudent(id: number): Promise<void>;
  
  // 生徒チケット関連
  getStudentTickets(studentId: number): Promise<number>; // 特定の生徒のチケット数取得
  addStudentTickets(studentId: number, userId: number, quantity: number): Promise<void>; // 生徒にチケットを追加
  useStudentTicket(studentId: number): Promise<boolean>; // 生徒のチケットを1枚使用
  calculateUserTotalTickets(userId: number): Promise<number>; // ユーザーの全生徒のチケット合計を計算
  
  // 講師関連
  getTutorByUserId(userId: number): Promise<Tutor | undefined>;
  getTutor(id: number): Promise<Tutor | undefined>;
  createTutor(tutor: InsertTutor): Promise<Tutor>;
  updateTutor(id: number, tutor: Partial<Tutor>): Promise<Tutor>;
  
  // 講師シフト関連
  getTutorShiftsByTutorId(tutorId: number): Promise<TutorShift[]>;
  getTutorShiftsByDate(tutorId: number, date: string): Promise<TutorShift[]>;
  createTutorShift(shift: InsertTutorShift): Promise<TutorShift>;
  updateTutorShift(id: number, shift: Partial<TutorShift>): Promise<TutorShift>;
  deleteTutorShift(id: number): Promise<void>;
  getTutorShift(id: number): Promise<TutorShift | undefined>;
  getAvailableTutorsBySubject(subject: string, date: string, timeSlot: string): Promise<any[]>;
  
  // 予約関連
  getBookingsByUserId(userId: number): Promise<Booking[]>;
  getBookingsByTutorId(tutorId: number): Promise<Booking[]>;
  getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string, studentId?: number): Promise<Booking | undefined>;
  getBookingByDateAndTimeSlotOnly(date: string, timeSlot: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingById(id: number): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<void>;
  
  // 支払い取引関連
  createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction>;
  getPaymentTransactionByTransactionId(transactionId: string): Promise<PaymentTransaction | undefined>;
  getUserPaymentTransactions(userId: number): Promise<PaymentTransaction[]>;
  
  // レッスンレポート関連
  createLessonReport(report: InsertLessonReport): Promise<LessonReport>;
  updateLessonReport(id: number, report: Partial<InsertLessonReport>): Promise<LessonReport>;
  getLessonReportById(id: number): Promise<LessonReport | undefined>;
  getLessonReportByBookingId(bookingId: number): Promise<LessonReport | undefined>;
  getLessonReportsByTutorId(tutorId: number): Promise<LessonReport[]>;
  getLessonReportsByStudentId(studentId: number): Promise<LessonReport[]>;
  
  sessionStore: any; // sessionエラー回避のためany型を使用
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bookings: Map<number, Booking>;
  private students: Map<number, Student>;
  private tutors: Map<number, Tutor>;
  private tutorShifts: Map<number, TutorShift>;
  private studentTicketRecords: Map<number, { studentId: number, userId: number, quantity: number, date: Date }>;
  private paymentTransactions: Map<number, PaymentTransaction>;
  private lessonReports: Map<number, LessonReport>;
  sessionStore: any; // session.SessionStore型を回避するためにany型を使用
  currentUserId: number;
  currentBookingId: number;
  currentStudentId: number;
  currentTutorId: number;
  currentTutorShiftId: number;
  currentTicketRecordId: number;
  currentPaymentTransactionId: number;
  currentLessonReportId: number;
  
  // 科目、日付、時間帯に基づいて利用可能な講師を取得
  async getAvailableTutorsBySubject(subject: string, date: string, timeSlot: string): Promise<any[]> {
    const results = [];
    
    for (const tutor of this.tutors.values()) {
      // 講師の担当科目に指定された科目が含まれているか確認
      if (tutor.subjects.includes(subject) && tutor.isActive) {
        // 講師のシフトを確認
        const shifts = Array.from(this.tutorShifts.values()).filter(
          shift => 
            shift.tutorId === tutor.id && 
            shift.date === date && 
            shift.timeSlot === timeSlot && 
            shift.isAvailable === true &&
            shift.subject === subject
        );
        
        // 利用可能なシフトがある場合は結果に追加
        for (const shift of shifts) {
          const user = this.users.get(tutor.userId);
          if (user) {
            results.push({
              tutor_id: tutor.id,
              last_name: tutor.lastName,
              first_name: tutor.firstName,
              university: tutor.university,
              subjects: tutor.subjects,
              user_id: user.id,
              shift_id: shift.id,
              date: shift.date,
              time_slot: shift.timeSlot,
              shift_subject: shift.subject,
              is_available: shift.isAvailable
            });
          }
        }
      }
    }
    
    return results;
  }
  
  // 予約IDで予約を取得
  async getBookingById(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
  
  // 予約をキャンセル（削除）
  async deleteBooking(id: number): Promise<void> {
    if (!this.bookings.has(id)) {
      throw new Error("Booking not found");
    }
    this.bookings.delete(id);
  }

  constructor() {
    this.users = new Map();
    this.bookings = new Map();
    this.students = new Map();
    this.tutors = new Map();
    this.tutorShifts = new Map();
    this.studentTicketRecords = new Map();
    this.paymentTransactions = new Map();
    this.lessonReports = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.currentUserId = 1;
    this.currentBookingId = 1;
    this.currentStudentId = 1;
    this.currentTutorId = 1;
    this.currentTutorShiftId = 1;
    this.currentTicketRecordId = 1;
    this.currentPaymentTransactionId = 1;
    this.currentLessonReportId = 1;
  }
  
  // レッスンレポート関連のメソッド
  async createLessonReport(report: InsertLessonReport): Promise<LessonReport> {
    const id = this.currentLessonReportId++;
    const now = new Date();
    
    const lessonReport: LessonReport = {
      id,
      bookingId: report.bookingId,
      tutorId: report.tutorId,
      studentId: report.studentId || null,
      unitContent: report.unitContent,
      messageContent: report.messageContent || null,
      goalContent: report.goalContent || null,
      createdAt: now,
      updatedAt: now
    };
    
    this.lessonReports.set(id, lessonReport);
    
    // 対応する予約のreportStatusも更新する (レガシー互換性のため)
    const booking = await this.getBookingById(report.bookingId);
    if (booking) {
      const updatedBooking = {
        ...booking,
        reportStatus: `completed:${now.toISOString()}`,
        reportContent: this.formatReportContentFromLessonReport(lessonReport)
      };
      this.bookings.set(booking.id, updatedBooking);
    }
    
    return lessonReport;
  }
  
  // レポートの内容をbookings.reportContentの形式にフォーマットする
  private formatReportContentFromLessonReport(report: LessonReport): string {
    return `【単元】\n${report.unitContent}\n\n【伝言事項】\n${report.messageContent || ""}\n\n【来週までの目標(課題)】\n${report.goalContent || ""}`;
  }
  
  async updateLessonReport(id: number, reportUpdate: Partial<InsertLessonReport>): Promise<LessonReport> {
    const existingReport = this.lessonReports.get(id);
    if (!existingReport) {
      throw new Error("Lesson report not found");
    }
    
    const now = new Date();
    const updatedReport: LessonReport = {
      ...existingReport,
      unitContent: reportUpdate.unitContent !== undefined ? reportUpdate.unitContent : existingReport.unitContent,
      messageContent: reportUpdate.messageContent !== undefined ? reportUpdate.messageContent : existingReport.messageContent,
      goalContent: reportUpdate.goalContent !== undefined ? reportUpdate.goalContent : existingReport.goalContent,
      updatedAt: now
    };
    
    this.lessonReports.set(id, updatedReport);
    
    // 対応する予約のreportContentも更新する (レガシー互換性のため)
    const booking = await this.getBookingById(existingReport.bookingId);
    if (booking) {
      const updatedBooking = {
        ...booking,
        reportStatus: `completed:${now.toISOString()}`,
        reportContent: this.formatReportContentFromLessonReport(updatedReport)
      };
      this.bookings.set(booking.id, updatedBooking);
    }
    
    return updatedReport;
  }
  
  async getLessonReportById(id: number): Promise<LessonReport | undefined> {
    return this.lessonReports.get(id);
  }
  
  async getLessonReportByBookingId(bookingId: number): Promise<LessonReport | undefined> {
    return Array.from(this.lessonReports.values()).find(
      report => report.bookingId === bookingId
    );
  }
  
  async getLessonReportsByTutorId(tutorId: number): Promise<LessonReport[]> {
    return Array.from(this.lessonReports.values()).filter(
      report => report.tutorId === tutorId
    );
  }
  
  async getLessonReportsByStudentId(studentId: number): Promise<LessonReport[]> {
    return Array.from(this.lessonReports.values()).filter(
      report => report.studentId === studentId
    );
  }
  
  // 支払い取引関連のメソッド
  async createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const id = this.currentPaymentTransactionId++;
    const paymentTransaction: PaymentTransaction = {
      id,
      userId: transaction.userId,
      transactionId: transaction.transactionId,
      paymentMethod: transaction.paymentMethod || "paypal",
      amount: transaction.amount,
      currency: transaction.currency || "JPY",
      status: transaction.status,
      createdAt: new Date(),
      metadata: transaction.metadata || null
    };
    
    this.paymentTransactions.set(id, paymentTransaction);
    return paymentTransaction;
  }
  
  async getPaymentTransactionByTransactionId(transactionId: string): Promise<PaymentTransaction | undefined> {
    return Array.from(this.paymentTransactions.values()).find(
      transaction => transaction.transactionId === transactionId
    );
  }
  
  async getUserPaymentTransactions(userId: number): Promise<PaymentTransaction[]> {
    return Array.from(this.paymentTransactions.values()).filter(
      transaction => transaction.userId === userId
    );
  }
  
  // 生徒チケット関連のメソッド
  async getStudentTickets(studentId: number): Promise<number> {
    // 生徒のチケット記録を取得して合計を計算
    let total = 0;
    for (const record of this.studentTicketRecords.values()) {
      if (record.studentId === studentId) {
        total += record.quantity;
      }
    }
    return total;
  }
  
  async addStudentTickets(studentId: number, userId: number, quantity: number): Promise<void> {
    // 新しいチケット追加記録を作成
    const id = this.currentTicketRecordId++;
    this.studentTicketRecords.set(id, {
      studentId,
      userId,
      quantity,
      date: new Date()
    });
  }
  
  async useStudentTicket(studentId: number): Promise<boolean> {
    // 現在のチケット数を確認
    const currentTickets = await this.getStudentTickets(studentId);
    
    if (currentTickets <= 0) {
      return false; // チケットが不足
    }
    
    // 生徒に関連するユーザーIDを取得
    const student = await this.getStudent(studentId);
    if (!student) {
      return false;
    }
    
    // 負のチケットとして記録（使用）
    const id = this.currentTicketRecordId++;
    this.studentTicketRecords.set(id, {
      studentId,
      userId: student.userId,
      quantity: -1,
      date: new Date()
    });
    
    return true;
  }
  
  async calculateUserTotalTickets(userId: number): Promise<number> {
    // ユーザーの全生徒のチケット合計を計算
    let total = 0;
    for (const record of this.studentTicketRecords.values()) {
      if (record.userId === userId) {
        total += record.quantity;
      }
    }
    return total;
  }
  


  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      id, 
      username: insertUser.username,
      password: insertUser.password,
      ticketCount: insertUser.ticketCount !== undefined ? insertUser.ticketCount : 0, 
      displayName: insertUser.displayName || null,
      email: insertUser.email || null,
      phone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      profileCompleted: false,
      tutorProfileCompleted: false,
      studentId: insertUser.studentId || null,
      parentId: insertUser.parentId || null,
      emailNotifications: true, 
      smsNotifications: false,
      role: insertUser.role || "parent", // "parent", "student", "tutor"
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateTicketCount(userId: number, ticketCount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ticketCount };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getBookingsByUserId(userId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.userId === userId
    );
  }

  async getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string, studentId?: number): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(
      (booking) => {
        // ユーザーIDと日付、時間が一致し、かつ生徒IDが指定されている場合はその生徒のみをチェック
        return booking.userId === userId && 
               booking.date === date && 
               booking.timeSlot === timeSlot && 
               (studentId ? booking.studentId === studentId : true);
      }
    );
  }
  
  // 日付と時間のみで予約をチェックする（生徒IDは無視）
  async getBookingByDateAndTimeSlotOnly(date: string, timeSlot: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.date === date && booking.timeSlot === timeSlot
    );
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    // tutorIdとtutorShiftIdが必須なので、未指定の場合はエラー
    if (!insertBooking.tutorId) {
      throw new Error("tutorId is required");
    }
    if (!insertBooking.tutorShiftId) {
      throw new Error("tutorShiftId is required");
    }
    
    const id = this.currentBookingId++;
    const now = new Date();
    
    // 対応するシフトを取得
    const shift = await this.getTutorShift(insertBooking.tutorShiftId);
    if (!shift) {
      throw new Error("Tutor shift not found");
    }
    
    const booking: Booking = {
      ...insertBooking,
      id,
      // studentIdはnullable
      studentId: insertBooking.studentId || null,
      // tutorIdとsubjectはrequired
      tutorId: insertBooking.tutorId,
      tutorShiftId: insertBooking.tutorShiftId,
      subject: insertBooking.subject, // シフト管理の簡素化に伴い、ユーザーが選択した科目を使用
      status: insertBooking.status || "confirmed",
      createdAt: now
    };
    this.bookings.set(id, booking);
    return booking;
  }
  
  // 追加: シフトIDによるシフト情報取得
  async getTutorShift(id: number): Promise<TutorShift | undefined> {
    return this.tutorShifts.get(id);
  }

  async updateUserSettings(userId: number, settings: Partial<User>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ...settings };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserProfile(
    userId: number,
    parentName: string,
    phone: string, 
    postalCode: string,
    prefecture: string,
    city: string,
    address: string
  ): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { 
      ...user,
      displayName: parentName,
      phone, 
      postalCode,
      prefecture,
      city,
      address, 
      profileCompleted: true 
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // 生徒関連のメソッド
  async getStudentsByUserId(userId: number): Promise<Student[]> {
    return Array.from(this.students.values()).filter(
      (student) => student.userId === userId && student.isActive
    );
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = this.currentStudentId++;
    const now = new Date();
    const student: Student = {
      ...insertStudent,
      id,
      isActive: true,
      createdAt: now
    };
    this.students.set(id, student);
    return student;
  }

  async updateStudent(id: number, studentUpdate: Partial<Student>): Promise<Student> {
    const student = await this.getStudent(id);
    if (!student) {
      throw new Error("Student not found");
    }
    
    const updatedStudent = { ...student, ...studentUpdate };
    this.students.set(id, updatedStudent);
    return updatedStudent;
  }
  
  async deleteStudent(id: number): Promise<void> {
    try {
      // 生徒情報を取得
      const student = await this.getStudent(id);
      if (!student) {
        throw new Error("Student not found");
      }
      
      // 1. 生徒のチケット記録をフィルタリング（削除対象の生徒のものを除外）
      this.studentTicketRecords = new Map(
        Array.from(this.studentTicketRecords.entries())
          .filter(([_, record]) => record.studentId !== id)
      );
      
      // 2. 生徒のレッスンレポートの生徒IDをnullに更新
      for (const [reportId, report] of this.lessonReports.entries()) {
        if (report.studentId === id) {
          const updatedReport = { ...report, studentId: null };
          this.lessonReports.set(reportId, updatedReport);
        }
      }
      
      // 3. 完全に削除する（物理削除）
      this.students.delete(id);
    } catch (error) {
      console.error("Error deleting student:", error);
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  }
  
  // ユーザー名の更新
  async updateUsername(userId: number, username: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, username };
    this.users.set(userId, updatedUser);
  }
  
  // パスワードの更新
  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, password: hashedPassword };
    this.users.set(userId, updatedUser);
  }

  // 講師関連のメソッド
  async getTutorByUserId(userId: number): Promise<Tutor | undefined> {
    return Array.from(this.tutors.values()).find(
      (tutor) => tutor.userId === userId && tutor.isActive
    );
  }

  async getTutor(id: number): Promise<Tutor | undefined> {
    return this.tutors.get(id);
  }

  async createTutor(insertTutor: InsertTutor): Promise<Tutor> {
    const id = this.currentTutorId++;
    const now = new Date();
    const tutor: Tutor = {
      ...insertTutor,
      id,
      isActive: true,
      profileCompleted: true,
      bio: insertTutor.bio || null,
      createdAt: now
    };
    this.tutors.set(id, tutor);

    // ユーザーのプロフィール完了状態を更新
    const user = await this.getUser(insertTutor.userId);
    if (user) {
      await this.updateUserSettings(user.id, { 
        profileCompleted: true,
        tutorProfileCompleted: true 
      });
    }

    return tutor;
  }

  async updateTutor(id: number, tutorUpdate: Partial<Tutor>): Promise<Tutor> {
    const tutor = await this.getTutor(id);
    if (!tutor) {
      throw new Error("Tutor not found");
    }
    
    const updatedTutor = { ...tutor, ...tutorUpdate };
    this.tutors.set(id, updatedTutor);
    return updatedTutor;
  }

  // 講師シフト関連のメソッド
  async getTutorShiftsByTutorId(tutorId: number): Promise<TutorShift[]> {
    return Array.from(this.tutorShifts.values()).filter(
      (shift) => shift.tutorId === tutorId
    );
  }

  async getTutorShiftsByDate(tutorId: number, date: string): Promise<TutorShift[]> {
    return Array.from(this.tutorShifts.values()).filter(
      (shift) => shift.tutorId === tutorId && shift.date === date
    );
  }

  async createTutorShift(insertShift: InsertTutorShift): Promise<TutorShift> {
    const id = this.currentTutorShiftId++;
    const now = new Date();
    const shift: TutorShift = {
      ...insertShift,
      id,
      isAvailable: insertShift.isAvailable !== undefined ? insertShift.isAvailable : true,
      createdAt: now
    };
    this.tutorShifts.set(id, shift);
    return shift;
  }

  async updateTutorShift(id: number, shiftUpdate: Partial<TutorShift>): Promise<TutorShift> {
    const shift = this.tutorShifts.get(id);
    if (!shift) {
      throw new Error("Tutor shift not found");
    }
    
    const updatedShift = { ...shift, ...shiftUpdate };
    this.tutorShifts.set(id, updatedShift);
    return updatedShift;
  }

  async deleteTutorShift(id: number): Promise<void> {
    this.tutorShifts.delete(id);
  }

  async getBookingsByTutorId(tutorId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.tutorId === tutorId
    );
  }
  
  // 予約IDで予約を取得
  async getBookingById(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
  
  // 予約を削除
  async deleteBooking(id: number): Promise<void> {
    this.bookings.delete(id);
  }
  
  // レポート状態と内容の更新（インメモリ実装）
  async updateBookingReport(id: number, reportStatus: string, reportContent: string): Promise<Booking> {
    const booking = await this.getBookingById(id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    
    const updatedBooking = {
      ...booking,
      reportStatus,
      reportContent
    };
    
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // レッスンレポート関連のメソッド
  async createLessonReport(report: InsertLessonReport): Promise<LessonReport> {
    const now = new Date();
    
    // 対応する予約から日付と時間情報を取得
    const booking = await this.getBookingById(report.bookingId);
    if (!booking) {
      throw new Error("対応する予約が見つかりません");
    }
    
    // レポートを挿入（日付と時間情報を予約から取得して設定）
    const [lessonReport] = await db.insert(lessonReports)
      .values({
        ...report,
        date: booking.date,           // 予約の日付情報をセット
        timeSlot: booking.timeSlot,   // 予約の時間情報をセット
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    // 対応する予約のreportStatusも更新する (レガシー互換性のため)
    if (lessonReport) {
      await db.update(bookings)
        .set({
          reportStatus: `completed:${now.toISOString()}`,
          reportContent: this.formatReportContentFromLessonReport(lessonReport)
        })
        .where(eq(bookings.id, report.bookingId));
    }
    
    return lessonReport;
  }
  
  // レポートの内容をbookings.reportContentの形式にフォーマットする
  private formatReportContentFromLessonReport(report: LessonReport): string {
    return `【単元】\n${report.unitContent}\n\n【伝言事項】\n${report.messageContent || ""}\n\n【来週までの目標(課題)】\n${report.goalContent || ""}`;
  }
  
  async updateLessonReport(id: number, reportUpdate: Partial<InsertLessonReport>): Promise<LessonReport> {
    const now = new Date();
    
    // 既存のレポートを取得
    const [existingReport] = await db.select()
      .from(lessonReports)
      .where(eq(lessonReports.id, id));
    
    if (!existingReport) {
      throw new Error("Lesson report not found");
    }
    
    // 必要に応じて日付と時間情報を取得・更新
    let dateInfo = existingReport.date;
    let timeSlot = existingReport.timeSlot;
    
    // 日付や時間情報が無い場合、予約から取得
    if (!dateInfo || !timeSlot) {
      const booking = await this.getBookingById(existingReport.bookingId);
      if (booking) {
        dateInfo = booking.date;
        timeSlot = booking.timeSlot;
      }
    }
    
    // レポートを更新
    const [updatedReport] = await db.update(lessonReports)
      .set({
        ...reportUpdate,
        date: dateInfo,           // 日付情報を維持または更新
        timeSlot: timeSlot,       // 時間情報を維持または更新
        updatedAt: now
      })
      .where(eq(lessonReports.id, id))
      .returning();
    
    if (!updatedReport) {
      throw new Error("Lesson report update failed");
    }
    
    // 対応する予約のreportContentも更新する (レガシー互換性のため)
    await db.update(bookings)
      .set({
        reportStatus: `completed:${now.toISOString()}`,
        reportContent: this.formatReportContentFromLessonReport(updatedReport)
      })
      .where(eq(bookings.id, updatedReport.bookingId));
    
    return updatedReport;
  }
  
  async getLessonReportById(id: number): Promise<LessonReport | undefined> {
    try {
      const [report] = await db.select()
        .from(lessonReports)
        .where(eq(lessonReports.id, id));
      
      return report;
    } catch (error) {
      console.error("Error getting lesson report by ID:", error);
      return undefined;
    }
  }

  async getLessonReportByBookingId(bookingId: number): Promise<LessonReport | undefined> {
    try {
      const [report] = await db.select()
        .from(lessonReports)
        .where(eq(lessonReports.bookingId, bookingId));
      
      return report;
    } catch (error) {
      console.error("Error getting lesson report by booking ID:", error);
      return undefined;
    }
  }
  
  async getLessonReportsByTutorId(tutorId: number): Promise<LessonReport[]> {
    const reports = await db.select()
      .from(lessonReports)
      .where(eq(lessonReports.tutorId, tutorId));
    
    return reports;
  }
  
  async getLessonReportsByStudentId(studentId: number): Promise<LessonReport[]> {
    const reports = await db.select()
      .from(lessonReports)
      .where(eq(lessonReports.studentId, studentId));
    
    return reports;
  }
  
  // 生徒チケット関連のメソッド
  async getStudentTickets(studentId: number): Promise<number> {
    try {
      // 特定の生徒のチケット数を取得
      const [result] = await db
        .select({ quantity: sql`COALESCE(SUM(quantity), 0)` })
        .from(studentTickets)
        .where(eq(studentTickets.studentId, studentId));
      
      return parseInt(result.quantity.toString() || "0", 10);
    } catch (error) {
      console.error("Error getting student tickets:", error);
      return 0;
    }
  }
  
  async addStudentTickets(studentId: number, userId: number, quantity: number): Promise<void> {
    try {
      // シンプルに新しいチケットを追加（チケット履歴としての機能を維持）
      await db.insert(studentTickets).values({
        studentId,
        userId,
        quantity
      });
    } catch (error) {
      console.error("Error adding student tickets:", error);
      throw new Error("Failed to add tickets to student");
    }
  }
  
  async useStudentTicket(studentId: number): Promise<boolean> {
    try {
      // 現在のチケット数を確認
      const currentTickets = await this.getStudentTickets(studentId);
      
      if (currentTickets <= 0) {
        return false; // チケットが不足
      }
      
      // 負のチケットとして記録（使用）
      await db.insert(studentTickets).values({
        studentId,
        userId: (await db.select().from(students).where(eq(students.id, studentId)))[0].userId,
        quantity: -1
      });
      
      return true;
    } catch (error) {
      console.error("Error using student ticket:", error);
      return false;
    }
  }
  
  async calculateUserTotalTickets(userId: number): Promise<number> {
    try {
      // ユーザーの全生徒のチケット合計を計算
      const [result] = await db
        .select({ total: sql`COALESCE(SUM(quantity), 0)` })
        .from(studentTickets)
        .where(eq(studentTickets.userId, userId));
      
      return parseInt(result.total.toString() || "0", 10);
    } catch (error) {
      console.error("Error calculating total tickets:", error);
      return 0;
    }
  }
  
  // 科目、日付、時間帯に基づいて利用可能な講師を取得
  async getAvailableTutorsBySubject(subject: string, date: string, timeSlot: string): Promise<any[]> {
    // 1. 指定した科目を教えられる講師を探す（講師のsubjectsフィールドで検索）
    // 2. その講師の中から、指定した日時に利用可能なシフトを持つ講師を探す
    
    try {
      console.log(`[API] 対象時間帯のシフト検索: 日付=${date}, 時間枠=${timeSlot}, 検索キーワード=${subject}`);
      
      // SQLクエリを実行
      const query = sql`
        SELECT 
          t.id AS tutor_id,
          t.last_name,
          t.first_name,
          t.university,
          t.subjects,
          u.id AS user_id,
          u.display_name,
          ts.id AS shift_id,
          ts.date,
          ts.time_slot,
          ts.is_available
        FROM tutor_shifts ts
        JOIN tutors t ON ts.tutor_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE 
          ts.date = ${date} AND
          ts.time_slot = ${timeSlot} AND
          ts.is_available = true AND
          t.is_active = true AND
          t.subjects LIKE ${`%${subject}%`}
      `;
      
      const result = await db.execute(query);
      console.log(`[API] 対象時間帯のシフト: ${result.rows?.length || 0}件`);
      return result.rows || [];
    } catch (error) {
      console.error("講師検索エラー:", error);
      return [];
    }
  }

  // ユーザー関連
  async getUser(id: number): Promise<User | undefined> {
    // データベースからユーザー情報を取得 (columns() を使用して必要なカラムのみを選択)
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        displayName: users.displayName,
        email: users.email,
        phone: users.phone,
        postalCode: users.postalCode,
        prefecture: users.prefecture,
        city: users.city,
        address: users.address,
        profileCompleted: users.profileCompleted,
        tutorProfileCompleted: users.tutorProfileCompleted,
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
        ticketCount: users.ticketCount,
        role: users.role,
        studentId: users.studentId,
        parentId: users.parentId,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, id));
    
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        displayName: users.displayName,
        email: users.email,
        phone: users.phone,
        postalCode: users.postalCode,
        prefecture: users.prefecture,
        city: users.city,
        address: users.address,
        profileCompleted: users.profileCompleted,
        tutorProfileCompleted: users.tutorProfileCompleted,
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
        ticketCount: users.ticketCount,
        role: users.role,
        studentId: users.studentId,
        parentId: users.parentId,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          password: users.password,
          displayName: users.displayName,
          email: users.email,
          phone: users.phone,
          postalCode: users.postalCode,
          prefecture: users.prefecture,
          city: users.city,
          address: users.address,
          profileCompleted: users.profileCompleted,
          tutorProfileCompleted: users.tutorProfileCompleted,
          emailNotifications: users.emailNotifications,
          smsNotifications: users.smsNotifications,
          ticketCount: users.ticketCount,
          role: users.role,
          studentId: users.studentId,
          parentId: users.parentId,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateTicketCount(userId: number, ticketCount: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ticketCount })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateUserSettings(userId: number, settings: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(settings)
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateUserProfile(
    userId: number,
    parentName: string,
    phone: string, 
    postalCode: string,
    prefecture: string,
    city: string,
    address: string
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        displayName: parentName,
        phone, 
        postalCode, 
        prefecture, 
        city, 
        address, 
        profileCompleted: true 
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // 生徒関連
  async getStudentsByUserId(userId: number): Promise<Student[]> {
    return await db
      .select()
      .from(students)
      .where(and(eq(students.userId, userId), eq(students.isActive, true)));
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, id));
    return student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db
      .insert(students)
      .values(student)
      .returning();
    return newStudent;
  }

  async updateStudent(id: number, studentUpdate: Partial<Student>): Promise<Student> {
    const [student] = await db
      .update(students)
      .set(studentUpdate)
      .where(eq(students.id, id))
      .returning();
    
    if (!student) {
      throw new Error("Student not found");
    }
    return student;
  }

  async deleteStudent(id: number): Promise<void> {
    try {
      // トランザクションを開始
      await db.transaction(async (tx) => {
        // 1. 生徒のチケットデータを削除
        await tx
          .delete(studentTickets)
          .where(eq(studentTickets.studentId, id));
        
        // 2. 生徒のレッスンレポートの生徒IDをnullに更新
        await tx
          .update(lessonReports)
          .set({ studentId: null })
          .where(eq(lessonReports.studentId, id));
          
        // 3. 生徒を完全に削除（物理削除）
        await tx
          .delete(students)
          .where(eq(students.id, id));
      });
    } catch (error) {
      console.error("Error deleting student:", error);
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  }

  // 講師関連
  async getTutorByUserId(userId: number): Promise<Tutor | undefined> {
    const [tutor] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.userId, userId));
    return tutor;
  }

  async getTutor(id: number): Promise<Tutor | undefined> {
    const [tutor] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.id, id));
    return tutor;
  }

  async createTutor(tutor: InsertTutor): Promise<Tutor> {
    const [newTutor] = await db
      .insert(tutors)
      .values(tutor)
      .returning();
    return newTutor;
  }

  async updateTutor(id: number, tutorUpdate: Partial<Tutor>): Promise<Tutor> {
    const [tutor] = await db
      .update(tutors)
      .set(tutorUpdate)
      .where(eq(tutors.id, id))
      .returning();
    
    if (!tutor) {
      throw new Error("Tutor not found");
    }
    return tutor;
  }

  // 講師シフト関連
  async getTutorShiftsByTutorId(tutorId: number): Promise<TutorShift[]> {
    return await db
      .select()
      .from(tutorShifts)
      .where(eq(tutorShifts.tutorId, tutorId));
  }

  async getTutorShiftsByDate(tutorId: number, date: string): Promise<TutorShift[]> {
    return await db
      .select()
      .from(tutorShifts)
      .where(and(
        eq(tutorShifts.tutorId, tutorId),
        eq(tutorShifts.date, date)
      ));
  }

  async createTutorShift(shift: InsertTutorShift): Promise<TutorShift> {
    const [newShift] = await db
      .insert(tutorShifts)
      .values(shift)
      .returning();
    return newShift;
  }

  async updateTutorShift(id: number, shiftUpdate: Partial<TutorShift>): Promise<TutorShift> {
    const [shift] = await db
      .update(tutorShifts)
      .set(shiftUpdate)
      .where(eq(tutorShifts.id, id))
      .returning();
    
    if (!shift) {
      throw new Error("Tutor shift not found");
    }
    return shift;
  }

  async deleteTutorShift(id: number): Promise<void> {
    await db
      .delete(tutorShifts)
      .where(eq(tutorShifts.id, id));
  }
  
  async getTutorShift(id: number): Promise<TutorShift | undefined> {
    const [shift] = await db
      .select()
      .from(tutorShifts)
      .where(eq(tutorShifts.id, id));
    return shift;
  }

  // 予約関連
  async getBookingsByUserId(userId: number): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.userId, userId));
  }

  async getBookingsByTutorId(tutorId: number): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.tutorId, tutorId));
  }

  async getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string, studentId?: number): Promise<Booking | undefined> {
    const query = studentId
      ? and(
          eq(bookings.userId, userId),
          eq(bookings.date, date),
          eq(bookings.timeSlot, timeSlot),
          eq(bookings.studentId, studentId)
        )
      : and(
          eq(bookings.userId, userId),
          eq(bookings.date, date),
          eq(bookings.timeSlot, timeSlot)
        );

    const [booking] = await db
      .select()
      .from(bookings)
      .where(query);
    
    return booking;
  }

  async getBookingByDateAndTimeSlotOnly(date: string, timeSlot: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.date, date),
        eq(bookings.timeSlot, timeSlot)
      ));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    // tutorIdとtutorShiftIdが必須なので、未指定の場合はエラー
    if (!booking.tutorId) {
      throw new Error("tutorId is required");
    }
    if (!booking.tutorShiftId) {
      throw new Error("tutorShiftId is required");
    }
    
    // 対応するシフトを取得
    const shift = await this.getTutorShift(booking.tutorShiftId);
    if (!shift) {
      throw new Error("Tutor shift not found");
    }
    
    // シフト管理の簡素化に伴い、ユーザーが選択した科目をそのまま使用
    const bookingData = {
      ...booking
    };
    
    const [newBooking] = await db
      .insert(bookings)
      .values(bookingData)
      .returning();
    return newBooking;
  }

  async getBookingById(id: number): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));
    return booking;
  }

  async deleteBooking(id: number): Promise<void> {
    await db
      .delete(bookings)
      .where(eq(bookings.id, id));
  }
  

  
  // ユーザー名の更新
  async updateUsername(userId: number, username: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({ username })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("ユーザー名変更エラー:", error);
      throw new Error("Failed to update username");
    }
  }
  
  // パスワードの更新
  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("パスワード変更エラー:", error);
      throw new Error("Failed to update password");
    }
  }
  
  // レポート状態と内容の更新
  async updateBookingReport(id: number, reportStatus: string, reportContent: string): Promise<Booking> {
    try {
      // 予約が存在するか確認
      const booking = await this.getBookingById(id);
      if (!booking) {
        throw new Error("Booking not found");
      }
      
      // 予約情報を更新
      const [updatedBooking] = await db
        .update(bookings)
        .set({
          reportStatus,
          reportContent
        })
        .where(eq(bookings.id, id))
        .returning();
        
      if (!updatedBooking) {
        throw new Error("Failed to update booking report");
      }
      
      return updatedBooking;
    } catch (error) {
      console.error("レポート更新エラー:", error);
      throw new Error("Failed to update booking report");
    }
  }
  
  // 科目、日付、時間帯に基づいて利用可能な講師を取得
  async getAvailableTutorsBySubject(subject: string, date: string, timeSlot: string, schoolLevel?: string): Promise<any[]> {
    try {
      console.log(`[API] 利用可能な講師検索: 科目=${subject}, 日付=${date}, 時間=${timeSlot}, 学校区分=${schoolLevel || '未指定'}`);
      
      // まず対象の講師をsubjectsフィールドから検索
      const tutorsWithSubject = await db
        .select({
          tutor_id: tutors.id,
          last_name: tutors.lastName,
          first_name: tutors.firstName,
          university: tutors.university,
          subjects: tutors.subjects
        })
        .from(tutors)
        .where(and(
          eq(tutors.isActive, true),
          sql`${tutors.subjects} LIKE ${`%${subject}%`}`
        ));
      
      console.log(`[API] 科目「${subject}」に対応する講師: ${tutorsWithSubject.length}件`);
      
      if (tutorsWithSubject.length === 0) {
        return [];
      }
      
      // 講師IDの配列を作成
      const tutorIds = tutorsWithSubject.map(t => t.tutor_id);
      
      // 該当講師の利用可能なシフトを取得
      const availableShifts = await db
        .select({
          shift_id: tutorShifts.id,
          tutor_id: tutorShifts.tutorId
        })
        .from(tutorShifts)
        .where(and(
          inArray(tutorShifts.tutorId, tutorIds),
          eq(tutorShifts.date, date),
          eq(tutorShifts.timeSlot, timeSlot),
          eq(tutorShifts.isAvailable, true)
        ));
      
      console.log(`[API] 対象講師の利用可能なシフト: ${availableShifts.length}件`);
      
      if (availableShifts.length === 0) {
        return [];
      }
      
      // 予約済みシフトを取得
      const bookedShifts = await db
        .select({ shiftId: bookings.tutorShiftId })
        .from(bookings)
        .where(and(
          eq(bookings.date, date),
          eq(bookings.timeSlot, timeSlot)
        ));
      
      const bookedShiftIds = new Set(bookedShifts.map(b => b.shiftId));
      console.log(`[API] 予約済みシフト: ${bookedShiftIds.size}件`);
      
      // 予約可能なシフトをフィルタリング
      const availableShiftsByTutor = availableShifts
        .filter(shift => !bookedShiftIds.has(shift.shift_id));
      
      console.log(`[API] 予約可能なシフト: ${availableShiftsByTutor.length}件`);
      
      if (availableShiftsByTutor.length === 0) {
        return [];
      }
      
      // 結果の組み立て
      const results = [];
      
      for (const shift of availableShiftsByTutor) {
        const tutorInfo = tutorsWithSubject.find(t => t.tutor_id === shift.tutor_id);
        if (tutorInfo) {
          results.push({
            shift_id: shift.shift_id,
            tutor_id: tutorInfo.tutor_id,
            last_name: tutorInfo.last_name,
            first_name: tutorInfo.first_name,
            university: tutorInfo.university,
            subjects: tutorInfo.subjects
          });
        }
      }
      
      console.log(`[API] 最終的な検索結果: ${results.length}件の講師が見つかりました`);
      return results;
    } catch (error) {
      console.error("利用可能な講師検索エラー:", error);
      return [];
    }
  }
  
  // 支払い取引関連のメソッド
  async createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction> {
    try {
      const [result] = await db
        .insert(paymentTransactions)
        .values({
          userId: transaction.userId,
          transactionId: transaction.transactionId,
          paymentMethod: transaction.paymentMethod || "paypal",
          amount: transaction.amount,
          currency: transaction.currency || "JPY",
          status: transaction.status,
          metadata: transaction.metadata
        })
        .returning();
      return result;
    } catch (error) {
      console.error("支払い取引作成エラー:", error);
      throw new Error("Failed to create payment transaction");
    }
  }
  
  async getPaymentTransactionByTransactionId(transactionId: string): Promise<PaymentTransaction | undefined> {
    try {
      const [result] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.transactionId, transactionId));
      return result;
    } catch (error) {
      console.error("支払い取引検索エラー:", error);
      return undefined;
    }
  }
  
  async getUserPaymentTransactions(userId: number): Promise<PaymentTransaction[]> {
    try {
      return db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.userId, userId))
        .orderBy(sql`${paymentTransactions.createdAt} DESC`);
    } catch (error) {
      console.error("ユーザー支払い取引履歴取得エラー:", error);
      return [];
    }
  }
}

// MemStorageからDatabaseStorageに変更
export const storage = new DatabaseStorage();
