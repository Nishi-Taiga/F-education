import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  ticketCount: integer("ticket_count").default(0).notNull(),
  role: text("role").default("user"), // "user" or "tutor"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  subjects: text("subjects").notNull(), // カンマ区切りの科目リスト
  bio: text("bio"), // 自己紹介文
  isActive: boolean("is_active").default(true),
  profileCompleted: boolean("profile_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 講師シフトテーブル
export const tutorShifts = pgTable("tutor_shifts", {
  id: serial("id").primaryKey(),
  tutorId: integer("tutor_id").notNull().references(() => tutors.id),
  date: text("date").notNull(), // in YYYY-MM-DD format
  timeSlot: text("time_slot").notNull(), // format: "HH:MM-HH:MM"
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  studentId: integer("student_id").references(() => students.id),
  tutorId: integer("tutor_id").references(() => tutors.id),
  date: text("date").notNull(), // in YYYY-MM-DD format
  timeSlot: text("time_slot").notNull(), // format: "HH:MM-HH:MM"
  subject: text("subject"), // 科目（数学、英語など）
  status: text("status").default("confirmed"), // "confirmed", "cancelled"
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  role: true,
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
  bio: true,
});

export const insertTutorShiftSchema = createInsertSchema(tutorShifts).pick({
  tutorId: true,
  date: true,
  timeSlot: true,
  isAvailable: true,
});

export const insertBookingSchema = createInsertSchema(bookings).pick({
  userId: true,
  studentId: true,
  tutorId: true,
  date: true,
  timeSlot: true,
  subject: true,
  status: true,
});

export const updateUserProfileSchema = z.object({
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
  bio: z.string().optional(),
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
