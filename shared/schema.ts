import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  postalCode: text("postal_code"),
  prefecture: text("prefecture"),
  city: text("city"),
  address: text("address"),
  profileCompleted: boolean("profile_completed").default(false),
  tutorProfileCompleted: boolean("tutor_profile_completed").default(false),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  ticketCount: integer("ticket_count").default(0).notNull(),
  role: text("role").default("user"), // "user", "tutor", "student"
  studentId: integer("student_id"), // 生徒アカウントの場合、関連する生徒ID
  parentId: integer("parent_id"), // 生徒アカウントの場合、親のユーザーID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  students: many(students),
  bookings: many(bookings),
  tutor: many(tutors),
}));

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  lastNameFurigana: text("last_name_furigana").notNull(),
  firstNameFurigana: text("first_name_furigana").notNull(),
  gender: text("gender").notNull(), // 性別: "男性" または "女性"
  school: text("school").notNull(),
  grade: text("grade").notNull(),
  birthDate: text("birth_date").notNull(), // in YYYY-MM-DD format
  isActive: boolean("is_active").default(true),
  studentAccountId: integer("student_account_id"), // 生徒用アカウントのID（アカウント発行済みの場合）
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

// 講師テーブル
export const tutors = pgTable("tutors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  lastNameFurigana: text("last_name_furigana").notNull(),
  firstNameFurigana: text("first_name_furigana").notNull(),
  university: text("university").notNull(), // 出身または在学中の大学名
  birthDate: text("birth_date").notNull(), // in YYYY-MM-DD format
  subjects: text("subjects").notNull(), // カンマ区切りの科目リスト（例：「小学算数,中学数学,高校数学」）
  email: text("email"), // 講師用メールアドレス（予約通知用）
  isActive: boolean("is_active").default(true),
  profileCompleted: boolean("profile_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tutorsRelations = relations(tutors, ({ one, many }) => ({
  user: one(users, {
    fields: [tutors.userId],
    references: [users.id],
  }),
  shifts: many(tutorShifts),
  bookings: many(bookings),
}));

// 講師シフトテーブル
export const tutorShifts = pgTable("tutor_shifts", {
  id: serial("id").primaryKey(),
  tutorId: integer("tutor_id").notNull().references(() => tutors.id),
  date: text("date").notNull(), // in YYYY-MM-DD format
  timeSlot: text("time_slot").notNull(), // format: "HH:MM-HH:MM"
  subject: text("subject").default("available").notNull(), // 指導可能状態を示す
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tutorShiftsRelations = relations(tutorShifts, ({ one, many }) => ({
  tutor: one(tutors, {
    fields: [tutorShifts.tutorId],
    references: [tutors.id],
  }),
  bookings: many(bookings),
}));

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  studentId: integer("student_id").references(() => students.id),
  tutorId: integer("tutor_id").notNull().references(() => tutors.id),
  tutorShiftId: integer("tutor_shift_id").notNull().references(() => tutorShifts.id),
  date: text("date").notNull(), // in YYYY-MM-DD format
  timeSlot: text("time_slot").notNull(), // format: "HH:MM-HH:MM"
  subject: text("subject").notNull(), // 科目（数学、英語など）
  status: text("status").default("confirmed"), // "confirmed", "cancelled"
  reportStatus: text("report_status").default("pending"), // "pending", "completed" - 互換性のために残す（レポートテーブル移行前のデータ用）
  reportContent: text("report_content"), // レポート内容 - 互換性のために残す（レポートテーブル移行前のデータ用）
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  student: one(students, {
    fields: [bookings.studentId],
    references: [students.id],
  }),
  tutor: one(tutors, {
    fields: [bookings.tutorId],
    references: [tutors.id],
  }),
  tutorShift: one(tutorShifts, {
    fields: [bookings.tutorShiftId],
    references: [tutorShifts.id],
  }),
}));

// 生徒チケットテーブル
export const studentTickets = pgTable("student_tickets", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: integer("user_id").notNull().references(() => users.id), // 親ユーザーID
  quantity: integer("quantity").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentTicketsRelations = relations(studentTickets, ({ one }) => ({
  student: one(students, {
    fields: [studentTickets.studentId],
    references: [students.id],
  }),
  user: one(users, {
    fields: [studentTickets.userId],
    references: [users.id],
  }),
}));

// 支払い取引テーブル
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  transactionId: text("transaction_id").notNull(),
  paymentMethod: text("payment_method").notNull().default("paypal"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("JPY"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: text("metadata") // JSON文字列として保存
});

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  user: one(users, {
    fields: [paymentTransactions.userId],
    references: [users.id]
  }),
}));

// レッスンレポートテーブル
export const lessonReports = pgTable("lesson_reports", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  tutorId: integer("tutor_id").notNull().references(() => tutors.id),
  studentId: integer("student_id").references(() => students.id),
  date: text("date"), // 授業日 (YYYY-MM-DD形式)
  timeSlot: text("time_slot"), // 授業時間枠 (例: "16:00-17:30")
  unitContent: text("unit_content").notNull(), // 単元内容
  messageContent: text("message_content"), // 伝言事項
  goalContent: text("goal_content"), // 来週までの目標(課題)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lessonReportsRelations = relations(lessonReports, ({ one }) => ({
  booking: one(bookings, {
    fields: [lessonReports.bookingId],
    references: [bookings.id],
  }),
  tutor: one(tutors, {
    fields: [lessonReports.tutorId],
    references: [tutors.id],
  }),
  student: one(students, {
    fields: [lessonReports.studentId],
    references: [students.id],
  }),
}));

// レッスンレポート挿入スキーマ
export const insertLessonReportSchema = createInsertSchema(lessonReports)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  });

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  email: true,
  phone: true,
  postalCode: true,
  prefecture: true,
  city: true,
  address: true,
  profileCompleted: true,
  tutorProfileCompleted: true,
  role: true,
  studentId: true,
  parentId: true,
  ticketCount: true,
});

export const insertStudentSchema = createInsertSchema(students).pick({
  userId: true,
  lastName: true,
  firstName: true,
  lastNameFurigana: true,
  firstNameFurigana: true,
  gender: true,
  school: true,
  grade: true,
  birthDate: true,
});

export const insertTutorSchema = createInsertSchema(tutors).pick({
  userId: true,
  lastName: true,
  firstName: true,
  lastNameFurigana: true,
  firstNameFurigana: true,
  university: true,
  birthDate: true,
  subjects: true,
  email: true,
  profileCompleted: true,
});

export const insertTutorShiftSchema = createInsertSchema(tutorShifts).pick({
  tutorId: true,
  date: true,
  timeSlot: true,
  subject: true,
  isAvailable: true,
});

export const insertBookingSchema = createInsertSchema(bookings).pick({
  userId: true,
  studentId: true,
  tutorId: true,
  tutorShiftId: true,
  date: true,
  timeSlot: true,
  subject: true,
  status: true,
  reportStatus: true,
  reportContent: true,
});

export const updateUserProfileSchema = z.object({
  parentName: z.string().min(2, "氏名を入力してください"),
  phone: z.string().min(10).max(15),
  postalCode: z.string().min(7).max(8),
  prefecture: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(2),
  profileCompleted: z.boolean().optional(),
});

export const tutorProfileSchema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameFurigana: z.string().min(1, "姓（ふりがな）を入力してください"),
  firstNameFurigana: z.string().min(1, "名（ふりがな）を入力してください"),
  university: z.string().min(1, "大学名を入力してください"),
  birthDate: z.string().min(1, "生年月日を選択してください"),
  subjects: z.string().min(1, "担当科目を選択してください"),
  email: z.string().email("有効なメールアドレスを入力してください").min(1, "メールアドレスは必須です"),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).pick({
  userId: true,
  transactionId: true,
  paymentMethod: true,
  amount: true,
  currency: true,
  status: true,
  metadata: true,
});



export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export type InsertTutor = z.infer<typeof insertTutorSchema>;
export type Tutor = typeof tutors.$inferSelect;

export type InsertTutorShift = z.infer<typeof insertTutorShiftSchema>;
export type TutorShift = typeof tutorShifts.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

export type InsertLessonReport = z.infer<typeof insertLessonReportSchema>;
export type LessonReport = typeof lessonReports.$inferSelect;

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type TutorProfile = z.infer<typeof tutorProfileSchema>;

export type TicketPurchase = {
  userId: number;
  quantity: number;
  amount: number;
};

export const timeSlots = ["16:00-17:30", "18:00-19:30", "20:00-21:30"];

// 学校レベルの定義
export type SchoolLevel = "elementary" | "junior_high" | "high_school";

// 各学校レベルに対応する科目マップ
export const subjectsBySchoolLevel: Record<SchoolLevel, string[]> = {
  elementary: ["国語", "算数", "理科", "社会", "英語"],
  junior_high: ["国語", "数学", "理科", "社会", "英語"],
  high_school: [
    "現代文", "古典", "数学", "物理", "化学", "生物", "地学", 
    "地理", "日本史（歴史総合を含む）", "世界史（歴史総合を含む）", 
    "公共", "英語", "情報"
  ]
};

// すべての科目リスト（講師の担当科目選択用）
export const allSubjects = [
  // 小学生
  "小学国語", "小学算数", "小学理科", "小学社会", "小学英語",
  // 中学生
  "中学国語", "中学数学", "中学理科", "中学社会", "中学英語",
  // 高校生
  "高校現代文", "高校古典", "高校数学", "高校物理", "高校化学", "高校生物", "高校地学", 
  "高校地理", "高校日本史", "高校世界史", "高校公共", "高校英語", "高校情報"
];

// 学年から学校レベルを推測する関数
export function getSchoolLevelFromGrade(grade: string): SchoolLevel {
  // 高校生（高校1年生、高校2年生、高校3年生）
  if (grade.includes("高校")) {
    return "high_school";
  }
  
  // 中学生（中学1年生、中学2年生、中学3年生）
  if (grade.includes("中学")) {
    return "junior_high";
  }
  
  // 小学生（小学1年生〜小学6年生）
  // 注意: 数字のみの場合（例：「1年生」）は小学生と判断
  return "elementary";
}
