import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  grade: text("grade"),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  ticketCount: integer("ticket_count").default(0).notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
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
  grade: true,
});

export const insertBookingSchema = createInsertSchema(bookings).pick({
  userId: true,
  date: true,
  timeSlot: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type TicketPurchase = {
  userId: number;
  quantity: number;
  amount: number;
};

export const timeSlots = ["16:00-17:30", "18:00-19:30", "20:00-21:30"];
