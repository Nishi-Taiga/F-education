# Feducation

家庭教師授業の予約システム

## Replitから Vercel + Supabase への移行について

このリポジトリはReplitで作成されたアプリケーションをVercelとSupabaseを使用する環境に移行するためのものです。

### 環境構成

- **フロントエンド**: Next.js
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **ホスティング**: Vercel

### 移行手順

1. **Supabaseプロジェクトのセットアップ**:
   - Supabaseでアカウントを作成し、新しいプロジェクトを作成
   - 既存のデータベーススキーマを移行 (`export.sql` ファイルを使用)
   - 必要な環境変数を設定

2. **Vercelプロジェクトのセットアップ**:
   - Vercelでアカウントを作成
   - GitHubリポジトリと連携
   - 環境変数を設定 (Supabase URLとアノンキーなど)

3. **データ移行**:
   - ユーザーデータをPostgreSQLからSupabaseに移行
   - 必要に応じて、ユーザー認証情報を移行

### 主な変更点

- Express.jsからNext.js APIルートへの移行
- セッションベースの認証からJWTベースの認証への移行
- データベース接続の変更

### デプロイ手順

1. GitHub上にリポジトリを作成してコードをプッシュ
2. Vercelでリポジトリを選択してデプロイ
3. 必要な環境変数を設定
4. デプロイ完了

### ローカル開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# 本番環境と同等の環境でテスト
npm start
```

### 環境変数

以下の環境変数を設定する必要があります:

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# データベース設定
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### セットアップ後の必須手順

1. Supabaseのダッシュボード上でSQLエディターを開き、`sql/migrations/create_tutor_profile_table_rpc.sql` のSQL文を実行して必要な関数を作成してください。

2. 次に以下のコマンドを実行して、テーブルを初期化します：
```sql
SELECT create_tutor_profile_table_if_not_exists();
```

### 参考リンク

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Supabase ドキュメント](https://supabase.io/docs)
- [Vercel デプロイドキュメント](https://vercel.com/docs/deployments/overview)
