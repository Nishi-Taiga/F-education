-- ユーザーテーブルにauth_idカラムを追加するマイグレーションスクリプト

-- まずカラムが存在するか確認
DO $$
BEGIN
    -- カラムが存在しない場合のみ追加
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'auth_id'
    ) THEN
        -- カラムを追加
        ALTER TABLE users ADD COLUMN auth_id text;
        
        -- auth_idに対するインデックスを作成
        CREATE INDEX idx_users_auth_id ON users(auth_id);
        
        RAISE NOTICE 'auth_id column added successfully';
    ELSE
        RAISE NOTICE 'auth_id column already exists';
    END IF;
END $$;

-- コメント
COMMENT ON COLUMN users.auth_id IS 'Supabase Auth UIのユーザーID (UUID)';
