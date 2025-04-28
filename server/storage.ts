import { 
  users, bookings, students, tutors, tutorShifts,
  type User, type InsertUser, type Booking, type InsertBooking, 
  type Student, type InsertStudent, type Tutor, type InsertTutor,
  type TutorShift, type InsertTutorShift
} from "@shared/schema";
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
  deleteStudent(id: number): Promise<void>;
  
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
  
  // 予約関連
  getBookingsByUserId(userId: number): Promise<Booking[]>;
  getBookingsByTutorId(tutorId: number): Promise<Booking[]>;
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
  private tutors: Map<number, Tutor>;
  private tutorShifts: Map<number, TutorShift>;
  sessionStore: any; // session.SessionStore型を回避するためにany型を使用
  currentUserId: number;
  currentBookingId: number;
  currentStudentId: number;
  currentTutorId: number;
  currentTutorShiftId: number;
  
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
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.currentUserId = 1;
    this.currentBookingId = 1;
    this.currentStudentId = 1;
    this.currentTutorId = 1;
    this.currentTutorShiftId = 1;
    
    // テストユーザーを自動作成
    this.createInitialTestData();
  }
  
  // テストデータを作成
  private async createInitialTestData() {
    try {
      // パスワードをハッシュ化
      const hashedPassword = await hashPassword("password123");
      
      // テストユーザー（保護者）を作成
      const testUser = await this.createUser({
        username: "testuser",
        password: hashedPassword,
        displayName: "テストユーザー",
        email: "test@example.com",
        role: "user"
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
      
      // テスト用の生徒を作成（高校生と小学生）
      const student1 = await this.createStudent({
        userId: testUser.id,
        lastName: "テスト",
        firstName: "太郎",
        lastNameFurigana: "てすと",
        firstNameFurigana: "たろう",
        gender: "male",
        school: "テスト高等学校",
        grade: "高校2年生",
        birthDate: "2008-05-15"
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
      
      // テスト講師ユーザーを作成
      const tutorUser = await this.createUser({
        username: "testutor",
        password: await hashPassword("tutor123"),
        displayName: "テスト講師",
        email: "tutor@example.com",
        role: "tutor"
      });
      
      // テスト講師プロフィールを作成
      const tutor = await this.createTutor({
        userId: tutorUser.id,
        lastName: "講師",
        firstName: "太郎",
        lastNameFurigana: "こうし",
        firstNameFurigana: "たろう",
        university: "東京大学",
        birthDate: "1995-01-15",
        subjects: "小学国語,小学算数,中学数学,高校数学",
        bio: "数学が得意な講師です。分かりやすい授業を心がけています。"
      });
      
      // テスト講師のシフトを追加（翌日から1週間分）
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const timeSlot of ["16:00-17:30", "18:00-19:30", "20:00-21:30"]) {
          await this.createTutorShift({
            tutorId: tutor.id,
            date: dateStr,
            timeSlot: timeSlot,
            isAvailable: Math.random() > 0.3 // ランダムに空き状況を設定
          });
        }
      }
      
      console.log("テストユーザーとテストデータを作成しました:", {
        user: testUser.username,
        students: [
          `${student1.lastName} ${student1.firstName}`,
          `${student2.lastName} ${student2.firstName}`
        ],
        tutor: `${tutor.lastName} ${tutor.firstName}`
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
      id, 
      username: insertUser.username,
      password: insertUser.password,
      ticketCount: 0, 
      displayName: insertUser.displayName || null,
      email: insertUser.email || null,
      phone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      profileCompleted: false,
      tutorProfileCompleted: false,
      emailNotifications: true, 
      smsNotifications: false,
      role: insertUser.role || "user", // "user" または "tutor"
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
    const id = this.currentBookingId++;
    const now = new Date();
    const booking: Booking = {
      ...insertBooking,
      id,
      studentId: insertBooking.studentId || null,
      tutorId: insertBooking.tutorId || null,
      subject: insertBooking.subject || null,
      status: insertBooking.status || "confirmed",
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
  
  async deleteStudent(id: number): Promise<void> {
    // 生徒情報を取得
    const student = await this.getStudent(id);
    if (!student) {
      throw new Error("Student not found");
    }
    
    // 物理削除ではなく、isActiveフラグをfalseに設定する（論理削除）
    const updatedStudent = { ...student, isActive: false };
    this.students.set(id, updatedStudent);
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
}

export const storage = new MemStorage();
