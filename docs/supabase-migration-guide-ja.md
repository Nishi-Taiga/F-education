# Supabase 移行手順書

## データベース設定手順

Replitから移行する際に必要なテーブル設定とデータ構造について説明します。Supabaseのプロジェクトを新規作成したあと、以下の手順でデータベースを設定してください。

### 1. テーブル構造の確認

現在のデータベースには以下のテーブルが存在します：

#### parent_profile テーブル
```
| column_name  | data_type                   |
| ------------ | --------------------------- |
| id           | integer                     |
| name         | text                        |
| password     | text                        |
| email        | text                        |
| phone        | text                        |
| postal_code  | text                        |
| prefecture   | text                        |
| city         | text                        |
| address      | text                        |
| ticket_count | integer                     |
| role         | text                        |
| created_at   | timestamp without time zone |
| student_id   | integer                     |
| parent_id    | integer                     |
```

#### student_profile テーブル（最新版）
```
| column_name         | data_type                   |
| ------------------- | --------------------------- |
| id                  | integer                     |
| parent_id           | integer                     |
| last_name           | text                        |
| first_name          | text                        |
| last_name_furigana  | text                        |
| first_name_furigana | text                        |
| gender              | text                        |
| school              | text                        |
| grade               | text                        |
| birth_date          | date                        |
| created_at          | timestamp without time zone |
```

### 2. テーブル構造の変更（必要な場合）

もし `student_profile` テーブルが存在しない場合、または構造が異なる場合は、以下のSQLで作成または変更してください：

```sql
-- student_profile テーブルの作成または修正
CREATE TABLE IF NOT EXISTS public.student_profile (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER NOT NULL, -- parent_profile.id を参照
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name_furigana TEXT,
  first_name_furigana TEXT,
  gender TEXT,
  school TEXT,
  grade TEXT,
  birth_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_student_profile_parent_id ON public.student_profile(parent_id);

-- RLSの設定
ALTER TABLE public.student_profile ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（認証されたユーザーが全操作可能）
CREATE POLICY "Allow authenticated users full access" 
  ON public.student_profile 
  FOR ALL 
  TO authenticated 
  USING (true);
```

### 3. アプリケーションコードの更新について

保護者プロフィール設定画面のコードは、以下のテーブル・カラム構造に合わせて更新されています：

1. **保護者情報の保存:**
   - テーブル: `parent_profile`
   - 主要フィールド: `name`, `email`, `phone`, `postal_code`, `prefecture`, `city`, `address`
   - 特記事項: `ticket_count` は初期値 0 で設定されます

2. **生徒情報の保存:**
   - テーブル: `student_profile`
   - 主要フィールド: `parent_id`, `last_name`, `first_name`, `last_name_furigana`, `first_name_furigana`, `gender`, `school`, `grade`, `birth_date`
   - 特記事項: `birth_date` は日付型で保存されます
   - 親子関連付け: `parent_id` フィールドに親のID (`parent_profile.id`) が設定されます

### 4. トラブルシューティング

#### 保護者プロフィール設定時のエラー対処法

**症状1: student_profile テーブルが見つからない**

原因: テーブルが存在しない

解決策:
```sql
-- テーブルの存在確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'student_profile';

-- テーブルが存在しない場合は上記のCREATE TABLE文を実行
```

**症状2: parent_id に関するエラーが発生する**

原因: `parent_id` の型が不適切、または外部キー制約の問題

解決策:
```sql
-- parent_id カラムの型を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_profile' AND column_name = 'parent_id';

-- parent_id が integer でない場合は変更
ALTER TABLE public.student_profile 
ALTER COLUMN parent_id TYPE INTEGER;
```

**症状3: RLS（Row Level Security）によるアクセス拒否**

原因: アクセス権限の問題

解決策:
```sql
-- RLSポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'student_profile';

-- 必要に応じてポリシーを追加
CREATE POLICY "Allow authenticated users full access" 
  ON public.student_profile 
  FOR ALL 
  TO authenticated 
  USING (true);
```

#### テーブルスキーマの確認

Supabaseコンソールの「SQL」タブで以下のクエリを実行することで、テーブル構造を確認できます:

```sql
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_schema = 'public' 
  AND table_name IN ('parent_profile', 'student_profile')
ORDER BY 
  table_name, 
  ordinal_position;
```

## 動作確認手順

1. アプリケーションにログインする
2. プロフィール設定画面に進む
3. 保護者情報と生徒情報を入力
4. 「プロフィールを保存」ボタンをクリック
5. ダッシュボードにリダイレクトされることを確認
6. Supabaseダッシュボードで`parent_profile`と`student_profile`テーブルのデータを確認

## 注意事項

- `parent_id` は `parent_profile` テーブルの `id` カラムを参照します
- `student_profile` テーブルのRLSポリシーが適切に設定されていることを確認してください
- テーブル構造を変更する前に、必ずバックアップを取ることをお勧めします
- 正常に動作しない場合は、ブラウザのコンソールログを確認し、発生しているエラーメッセージを確認してください
