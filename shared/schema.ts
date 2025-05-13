import { pgTable, serial, text, integer, boolean, timestamp, date, time } from 'drizzle-orm/pg-core';

// ユーザーテーブル
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  role: text('role').notNull().default('parent'),
  studentId: integer('student_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 生徒テーブル
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 生徒チケットテーブル
export const studentTickets = pgTable('student_tickets', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  quantity: integer('quantity').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 講師テーブル
export const tutors = pgTable('tutors', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  specialization: text('specialization'),
  bio: text('bio'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 予約テーブル
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  tutorId: integer('tutor_id').notNull(),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: text('status').notNull().default('pending'),
  notes: text('notes'),
  ticketsUsed: integer('tickets_used').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 支払い取引テーブル
export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('JPY'),
  status: text('status').notNull().default('pending'),
  provider: text('provider').notNull(),
  providerTransactionId: text('provider_transaction_id'),
  ticketsPurchased: integer('tickets_purchased'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
