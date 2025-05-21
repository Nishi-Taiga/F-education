-- usersテーブル（認証ユーザー情報）
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
  parent_id INTEGER NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name_furigana TEXT,
  first_name_furigana TEXT,
  gender TEXT,
  school TEXT,
  grade TEXT,
  birth_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);

-- 権限設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own data" ON users FOR SELECT
  USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE
  USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own data" ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students visible to parent" ON students FOR SELECT
  USING (parent_id IN (SELECT id FROM parent_profile WHERE email = auth.email()));
