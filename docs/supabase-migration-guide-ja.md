# Supabase 移行手順書

## データベース設定手順

Replitから移行する際に必要なテーブル設定とデータ構造について説明します。Supabaseのプロジェクトを新規作成したあと、以下の手順でデータベースを設定してください。

### 1. ベーステーブルスキーマの作成

1. Supabaseダッシュボードにログインします
2. 「SQL」エディターを開きます
3. 以下のスクリプトファイルを順番に実行します：

#### 必須テーブル

1. **parent_profile.sql** - 保護者プロフィールテーブル
   - 保護者情報を保存するテーブルです
   - 生徒情報の親テーブルとなります

2. **users_students.sql** - ユーザーおよび生徒テーブル
   - 認証情報と生徒情報を保存するテーブルです
   - 保護者テーブルと関連付けられています

### 2. テーブル構造

#### parent_profile

```sql
CREATE TABLE IF NOT EXISTS parent_profile (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE, 
  phone TEXT,
  postal_code TEXT,
  prefecture TEXT,
  city TEXT,
  address TEXT,
  ticket_count INTEGER,
  role TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  student_id INTEGER,
  parent_id INTEGER
);
```

#### users

```sql
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
```

#### students

```sql
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
```

### 3. トラブルシューティング

#### 保護者プロフィール設定時のエラー対処法

**症状**: プロフィール設定時に、データベーステーブルが見つからないエラーが発生する

**解決策**:
1. Supabaseコンソールの「SQL」タブで、各スクリプトファイルが正常に実行されたか確認してください
2. テーブルが存在するか、Supabaseコンソールの「テーブルエディタ」で確認してください
3. すべてのテーブル（parent_profile, users, students）が作成されていない場合は、スクリプトファイルを再度実行してください

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
ORDER BY 
  table_name, 
  ordinal_position;
```

## 動作確認手順

1. parent_profileテーブルの作成と確認
2. users_students.sqlファイルの実行
3. アプリケーションへのログインとプロフィール設定
4. ダッシュボードへのリダイレクト確認

## 注意事項

- 必ず上記の順番でSQLファイルを実行してください
- Supabaseの「認証」機能と「ストレージ」機能も設定する必要がある場合は、別途手順書を参照してください
- 正常に動作しない場合は、ブラウザのコンソールログを確認し、発生しているエラーメッセージを確認してください
