-- 既存のテーブルがあれば削除
DROP TABLE IF EXISTS public.tutor_profile;

-- テーブルを作成
CREATE TABLE public.tutor_profile (
  -- 自動采番される整数型主キー
  id SERIAL PRIMARY KEY,
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
  -- ユーザーリファレンス (認証システムのUUID)
  user_id UUID NOT NULL
);

-- user_idにインデックスを追加
CREATE INDEX IF NOT EXISTS idx_tutor_profile_user_id ON public.tutor_profile(user_id);

-- 行レベルセキュリティを設定
ALTER TABLE public.tutor_profile ENABLE ROW LEVEL SECURITY;

-- ユーザーが自分のデータを読み込めるポリシー
CREATE POLICY "Users can view their own tutor profiles"
  ON public.tutor_profile
  FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーが自分のデータを更新できるポリシー
CREATE POLICY "Users can update their own tutor profiles"
  ON public.tutor_profile
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ユーザーが自分のデータを登録できるポリシー
CREATE POLICY "Users can insert their own tutor profiles"
  ON public.tutor_profile
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- サービスロールが全テーブルにアクセスできるポリシー
CREATE POLICY "Service role has full access"
  ON public.tutor_profile
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');