-- ALTER TABLE コマンドを使用して student_profile テーブルが存在しているかを確認し、
-- 存在しない場合は作成します

-- student_profile テーブルが存在するか確認
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_profile'
  ) THEN
    -- テーブルが存在しない場合は作成
    CREATE TABLE public.student_profile (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL, -- UUIDを安全に保存するためにTEXT型を使用
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name_furigana TEXT,
      first_name_furigana TEXT,
      gender TEXT,
      school TEXT,
      grade TEXT,
      birth_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      student_account_id INTEGER
    );
    
    -- テーブルのRLSを有効化
    ALTER TABLE public.student_profile ENABLE ROW LEVEL SECURITY;
    
    -- RLSポリシーを作成（すべてのユーザーにCRUD権限を付与）
    CREATE POLICY "Allow full access to authenticated users" 
      ON public.student_profile 
      FOR ALL 
      TO authenticated 
      USING (true);
      
    RAISE NOTICE 'Created student_profile table with RLS policies';
  ELSE
    -- テーブルが存在する場合はuser_idカラムの型を確認
    DECLARE
      column_type TEXT;
    BEGIN
      SELECT data_type INTO column_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'student_profile'
        AND column_name = 'user_id';
        
      IF column_type != 'text' AND column_type != 'uuid' THEN
        -- user_idカラムがtextまたはuuidでない場合はtext型に変換
        ALTER TABLE public.student_profile 
        ALTER COLUMN user_id TYPE TEXT;
        
        RAISE NOTICE 'Modified user_id column to TEXT type';
      ELSE
        RAISE NOTICE 'student_profile table exists with correct user_id type: %', column_type;
      END IF;
    END;
  END IF;
END $$;

-- 追加のインデックスを作成（パフォーマンス向上のため）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'student_profile'
    AND indexname = 'idx_student_profile_user_id'
  ) THEN
    CREATE INDEX idx_student_profile_user_id ON public.student_profile(user_id);
    RAISE NOTICE 'Created index on user_id column';
  END IF;
END $$;
