import { users, bookings, students, type User, type InsertUser, type Booking, type InsertBooking, type Student, type InsertStudent } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // ユーザー関連
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateTicketCount(userId: number, ticketCount: number): Promise<User>;
  updateUserSettings(userId: number, settings: Partial<User>): Promise<User>;
  updateUserProfile(userId: number, phone: string, address: string): Promise<User>;
  
  // 生徒関連
  getStudentsByUserId(userId: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<Student>): Promise<Student>;
  
  // 予約関連
  getBookingsByUserId(userId: number): Promise<Booking[]>;
  getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  
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

  async getBookingByDateAndTimeSlot(userId: number, date: string, timeSlot: string): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(
      (booking) => booking.userId === userId && booking.date === date && booking.timeSlot === timeSlot
    );
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const now = new Date();
    const booking: Booking = {
      ...insertBooking,
      id,
      studentId: insertBooking.studentId || null,
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

  async updateUserProfile(userId: number, phone: string, address: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { 
      ...user, 
      phone, 
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
