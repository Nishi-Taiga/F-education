-- この関数はtutor_profileテーブルが存在しない場合に作成する
CREATE OR REPLACE FUNCTION create_tutor_profile_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- まず、UUID拡張機能がインストールされているか確認し、なければインストール
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  
  -- テーブルが存在するか確認
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_profile'
  ) THEN
    -- テーブルが存在しない場合は作成
    CREATE TABLE public.tutor_profile (
      id UUID PRIMARY KEY,
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name_furigana TEXT,
      first_name_furigana TEXT,
      university TEXT,
      birth_date TEXT,
      subjects TEXT,
      bio TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      profile_completed BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      email TEXT,
      user_id UUID NOT NULL REFERENCES auth.users(id)
    );

    -- インデックスを作成
    CREATE INDEX IF NOT EXISTS idx_tutor_profile_user_id ON public.tutor_profile(user_id);
    
    -- Row Level Securityを有効化
    ALTER TABLE public.tutor_profile ENABLE ROW LEVEL SECURITY;
    
    -- ユーザーが自分自身のプロフィールにアクセスできるようにするポリシー
    CREATE POLICY "Users can view their own tutor profiles"
      ON public.tutor_profile
      FOR SELECT
      USING (auth.uid() = user_id);
      
    CREATE POLICY "Users can update their own tutor profiles"
      ON public.tutor_profile
      FOR UPDATE
      USING (auth.uid() = user_id);
      
    CREATE POLICY "Users can insert their own tutor profiles"
      ON public.tutor_profile
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- tutor_profileを挿入するための関数
CREATE OR REPLACE FUNCTION insert_tutor_profile(profile JSONB)
RETURNS JSONB AS $$
DECLARE
  inserted_row JSONB;
BEGIN
  -- テーブルがない場合は作成
  PERFORM create_tutor_profile_table_if_not_exists();
  
  -- プロフィールの挿入
  INSERT INTO public.tutor_profile (
    id,
    user_id,
    last_name, 
    first_name, 
    last_name_furigana,
    first_name_furigana,
    university,
    birth_date,
    subjects,
    email,
    profile_completed,
    is_active,
    created_at
  )
  VALUES (
    (profile->>'id')::UUID,
    (profile->>'user_id')::UUID,
    profile->>'last_name',
    profile->>'first_name',
    profile->>'last_name_furigana',
    profile->>'first_name_furigana',
    profile->>'university',
    profile->>'birth_date',
    profile->>'subjects',
    profile->>'email',
    (profile->>'profile_completed')::BOOLEAN,
    (profile->>'is_active')::BOOLEAN,
    (profile->>'created_at')::TIMESTAMP WITH TIME ZONE
  )
  RETURNING to_jsonb(tutor_profile.*) INTO inserted_row;
  
  RETURN inserted_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
