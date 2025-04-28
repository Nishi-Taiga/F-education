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
