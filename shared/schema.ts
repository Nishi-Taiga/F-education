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

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  studentId: integer("student_id").references(() => students.id),
  date: text("date").notNull(), // in YYYY-MM-DD format
  timeSlot: text("time_slot").notNull(), // format: "HH:MM-HH:MM"
  subject: text("subject"), // 科目（数学、英語など）
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

export const insertBookingSchema = createInsertSchema(bookings).pick({
  userId: true,
  studentId: true,
  date: true,
  timeSlot: true,
  subject: true,
});

export const updateUserProfileSchema = z.object({
  phone: z.string().min(10).max(15),
  postalCode: z.string().min(7).max(8),
  prefecture: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(2),
  profileCompleted: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

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

// 学年から学校レベルを推測する関数
export function getSchoolLevelFromGrade(grade: string): SchoolLevel {
  // 学年文字列から数字部分を抽出
  const gradeNum = parseInt(grade.replace(/[^0-9]/g, ""));
  
  if (gradeNum >= 1 && gradeNum <= 6) {
    return "elementary"; // 小学生（1〜6年生）
  } else if (gradeNum >= 7 && gradeNum <= 9 || grade.includes("中学")) {
    return "junior_high"; // 中学生（7〜9年生または「中学」を含む）
  } else {
    return "high_school"; // 上記以外は高校生と判断
  }
}
