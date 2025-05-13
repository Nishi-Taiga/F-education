-- 既存テーブルの確認
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'parent',
  profile_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学生テーブル
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 講師テーブル
CREATE TABLE IF NOT EXISTS tutors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  specialization TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- チケットテーブル
CREATE TABLE IF NOT EXISTS student_tickets (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 予約テーブル
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  tutor_id INTEGER NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  tickets_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 支払い取引テーブル
CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  tickets_purchased INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 権限設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own data" ON users FOR SELECT
  USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_tutors_user_id ON tutors(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tutor_id ON bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_student_tickets_student_id ON student_tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
