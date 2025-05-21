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

#### student_profile テーブル
```
| column_name         | data_type                   |
| ------------------- | --------------------------- |
| id                  | integer                     |
| user_id             | integer                     |
| last_name           | text                        |
| first_name          | text                        |
| last_name_furigana  | text                        |
| first_name_furigana | text                        |
| gender              | text                        |
| school              | text                        |
| grade               | text                        |
| birth_date          | date                        |
| created_at          | timestamp without time zone |
| student_account_id  | integer                     |
```

### 2. テーブル構造の変更（必要に応じて）

もし `student_profile` テーブルの `user_id` カラムが integer 型ではなく UUID 型として使用される場合は、以下のようにテーブル構造を変更してください：

```sql
-- student_profile テーブルの user_id カラムの型を変更
ALTER TABLE student_profile ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
```

これにより、Supabase Authentication の UUID が正しく保存できるようになります。

### 3. アプリケーションコードの更新について

保護者プロフィール設定画面のコードは、以下のテーブル・カラム構造に合わせて更新されています：

1. **保護者情報の保存:**
   - テーブル: `parent_profile`
   - 主要フィールド: `name`, `email`, `phone`, `postal_code`, `prefecture`, `city`, `address`
   - 特記事項: `ticket_count` は初期値 0 で設定されます

2. **生徒情報の保存:**
   - テーブル: `student_profile`
   - 主要フィールド: `user_id`, `last_name`, `first_name`, `last_name_furigana`, `first_name_furigana`, `gender`, `school`, `grade`, `birth_date`
   - 特記事項: `birth_date` は日付型で保存されます
   - 親子関連付け: `user_id` フィールドに Supabase Authentication の UUID が設定されます

### 4. トラブルシューティング

#### 保護者プロフィール設定時のエラー対処法

**症状1: user_id に関するエラーが発生する**

原因: `user_id` の型が不適切

解決策:
```sql
-- student_profile テーブルの user_id カラムの型がわからない場合、確認する
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_profile' AND column_name = 'user_id';

-- user_id が UUID 型でない場合、変更する
ALTER TABLE student_profile ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
```

**症状2: 日付形式に関するエラーが発生する**

原因: `birth_date`カラムがdate型だが、文字列が送信されている

解決策:
- コードでは、日付を適切なフォーマット（ISO 日付形式）に変換しています
- それでも問題が発生する場合は、Supabaseのテーブル定義で`birth_date`をtext型に変更するか検討

**症状3: 認証エラーが発生する**

原因: アクセス権限の問題

解決策:
- Supabase設定でテーブルのRow Level Security (RLS)ポリシーを確認
- 必要に応じて公開アクセスを許可または適切なポリシーを設定

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

1. アプリケーションにログインする
2. プロフィール設定画面に進む
3. 保護者情報と生徒情報を入力
4. 「プロフィールを保存」ボタンをクリック
5. ダッシュボードにリダイレクトされることを確認
6. Supabaseダッシュボードで`parent_profile`と`student_profile`テーブルのデータを確認

## 注意事項

- user_id カラムの型が UUID に対応していない場合、エラーが発生します
- テーブル構造を変更する前に、必ずバックアップを取ることをお勧めします
- 正常に動作しない場合は、ブラウザのコンソールログを確認し、発生しているエラーメッセージを確認してください
