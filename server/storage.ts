import { users, bookings, students, type User, type InsertUser, type Booking, type InsertBooking, type Student, type InsertStudent } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { hashPassword } from "./auth";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // ユーザー関連
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateTicketCount(userId: number, ticketCount: number): Promise<User>;
  updateUserSettings(userId: number, settings: Partial<User>): Promise<User>;
  updateUserProfile(
    userId: number, 
    phone: string, 
    postalCode: string,
    prefecture: string,
    city: string,
    address: string
  ): Promise<User>;
  
  // 生徒関連
  getStudentsByUserId(userId: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<Student>): Promise<Student>;
  
  // 予約関連
  getBookingsByUserId(userId: number): Promise<Booking[]>;
  getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string, studentId?: number): Promise<Booking | undefined>;
  getBookingByDateAndTimeSlotOnly(date: string, timeSlot: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingById(id: number): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<void>;
  
  sessionStore: any; // sessionエラー回避のためany型を使用
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bookings: Map<number, Booking>;
  private students: Map<number, Student>;
  sessionStore: any; // session.SessionStore型を回避するためにany型を使用
  currentUserId: number;
  currentBookingId: number;
  currentStudentId: number;
  
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
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.currentUserId = 1;
    this.currentBookingId = 1;
    this.currentStudentId = 1;
    
    // テストユーザーを自動作成
    this.createInitialTestData();
  }
  
  // テストデータを作成
  private async createInitialTestData() {
    try {
      // パスワードをハッシュ化
      const hashedPassword = await hashPassword("password123");
      
      // テストユーザーを作成
      const testUser = await this.createUser({
        username: "testuser",
        password: hashedPassword,
        displayName: "テストユーザー",
        email: "test@example.com"
      });
      
      // プロフィール情報を更新
      await this.updateUserProfile(
        testUser.id,
        "090-1234-5678",
        "100-0001",
        "東京都",
        "千代田区",
        "千代田1-1-1"
      );
      
      // 通知設定を更新
      await this.updateUserSettings(testUser.id, {
        emailNotifications: true,
        smsNotifications: false
      });
      
      // チケットを追加
      await this.updateTicketCount(testUser.id, 10);
      
      // テスト用の生徒を作成
      const student1 = await this.createStudent({
        userId: testUser.id,
        lastName: "テスト",
        firstName: "太郎",
        lastNameFurigana: "てすと",
        firstNameFurigana: "たろう",
        gender: "male",
        school: "テスト小学校",
        grade: "5年生",
        birthDate: "2013-05-15"
      });
      
      const student2 = await this.createStudent({
        userId: testUser.id,
        lastName: "テスト",
        firstName: "花子",
        lastNameFurigana: "てすと",
        firstNameFurigana: "はなこ",
        gender: "female",
        school: "テスト小学校",
        grade: "3年生",
        birthDate: "2015-08-23"
      });
      
      console.log("テストユーザーとテストデータを作成しました:", {
        user: testUser.username,
        students: [
          `${student1.lastName} ${student1.firstName}`,
          `${student2.lastName} ${student2.firstName}`
        ]
      });
    } catch (error) {
      console.error("テストデータの作成に失敗しました:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      ticketCount: 0, 
      displayName: insertUser.displayName || null,
      email: insertUser.email || null,
      phone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      profileCompleted: false,
      emailNotifications: true, 
      smsNotifications: false
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
    const id = this.currentBookingId++;
    const now = new Date();
    const booking: Booking = {
      ...insertBooking,
      id,
      studentId: insertBooking.studentId || null,
      subject: insertBooking.subject || null,
      createdAt: now
    };
    this.bookings.set(id, booking);
    return booking;
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
}

export const storage = new MemStorage();
