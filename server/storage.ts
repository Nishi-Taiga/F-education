import { 
  users, bookings, students, tutors, tutorShifts,
  type User, type InsertUser, type Booking, type InsertBooking, 
  type Student, type InsertStudent, type Tutor, type InsertTutor,
  type TutorShift, type InsertTutorShift
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
          // 講師の担当科目からランダムに1つ選択
          const subjectList = tutor.subjects.split(',');
          const randomSubject = subjectList[Math.floor(Math.random() * subjectList.length)];
          
          await this.createTutorShift({
            tutorId: tutor.id,
            date: dateStr,
            timeSlot: timeSlot,
            subject: randomSubject, // 科目を設定
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
      subject: insertBooking.subject || shift.subject, // シフトの科目をデフォルトで使用
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

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // 科目、日付、時間帯に基づいて利用可能な講師を取得
  async getAvailableTutorsBySubject(subject: string, date: string, timeSlot: string): Promise<any[]> {
    // 1. 指定した科目を教えられる講師を探す
    // 2. その講師の中から、指定した日時に利用可能なシフトを持つ講師を探す
    
    try {
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
          ts.subject AS shift_subject,
          ts.is_available
        FROM tutor_shifts ts
        JOIN tutors t ON ts.tutor_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE 
          ts.date = ${date} AND
          ts.time_slot = ${timeSlot} AND
          ts.is_available = true AND
          ts.subject = ${subject} AND
          t.is_active = true AND
          t.subjects LIKE ${`%${subject}%`}
      `;
      
      const result = await db.execute(query);
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
    phone: string, 
    postalCode: string,
    prefecture: string,
    city: string,
    address: string
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
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
    // 論理削除: isActiveをfalseに設定
    await db
      .update(students)
      .set({ isActive: false })
      .where(eq(students.id, id));
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
    
    // シフトの科目をデフォルトで使用
    const bookingData = {
      ...booking,
      subject: booking.subject || shift.subject
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
}

// MemStorageからDatabaseStorageに変更
export const storage = new DatabaseStorage();
