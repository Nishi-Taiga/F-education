-- UUID拡張機能が必要なので、まずインストールする
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- テーブルが存在しない場合は作成する
CREATE TABLE IF NOT EXISTS public.tutor_profile (
  -- UUIDを主キーとして使用
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- 基本情報
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name_furigana TEXT,
  first_name_furigana TEXT,
  university TEXT,
  birth_date TEXT,
  subjects TEXT,
  bio TEXT,
  -- 状態管理
  is_active BOOLEAN DEFAULT TRUE,
  profile_completed BOOLEAN DEFAULT TRUE,
  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT,
  -- 参照整合性
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 検索を高速化するためのインデックス
CREATE INDEX IF NOT EXISTS idx_tutor_profile_user_id ON public.tutor_profile(user_id);

-- 行レベルセキュリティを有効化
ALTER TABLE public.tutor_profile ENABLE ROW LEVEL SECURITY;

-- ユーザーがプロフィールを閲覧できるポリシー
DROP POLICY IF EXISTS "Users can view their own tutor profiles" ON public.tutor_profile;
CREATE POLICY "Users can view their own tutor profiles"
  ON public.tutor_profile
  FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーがプロフィールを更新できるポリシー
DROP POLICY IF EXISTS "Users can update their own tutor profiles" ON public.tutor_profile;
CREATE POLICY "Users can update their own tutor profiles"
  ON public.tutor_profile
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ユーザーがプロフィールを登録できるポリシー
DROP POLICY IF EXISTS "Users can insert their own tutor profiles" ON public.tutor_profile;
CREATE POLICY "Users can insert their own tutor profiles"
  ON public.tutor_profile
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- サービスロールが全体管理できるポリシー
DROP POLICY IF EXISTS "Service role has full access" ON public.tutor_profile;
CREATE POLICY "Service role has full access"
  ON public.tutor_profile
  USING (auth.role() = 'service_role');
