# Feducation Migration Guide

## Replit to Vercel + Supabase 移行ガイド

このガイドでは、現在のReplitアプリケーションをVercelとSupabaseを活用した環境に移行する詳細な手順を説明します。

### 1. Supabaseプロジェクトのセットアップ

1. [Supabase](https://supabase.com/) にアカウントを作成する
2. 新しいプロジェクトを作成する
3. プロジェクトが作成されたら、次の作業を行います：
   - プロジェクトURLとアノンキーをメモしておく（環境変数として使用）
   - SQLエディタを開いて、`export.sql` ファイルの内容を実行し、データベーススキーマを移行
   - 必要であれば `migrations` フォルダ内のスクリプトも実行

#### Auth設定

1. Authentication → Settings と進む
2. Email auth を有効にする
3. サイトURLを設定する (例: `https://your-vercel-app.vercel.app`)
4. Email templatesを日本語に設定（必要に応じて）

### 2. データ移行

1. 既存のReplitアプリケーションから、以下のデータを抽出します：
   - ユーザーデータ
   - 予約データ
   - チケット情報
   - その他の重要なデータ

2. CSVまたはJSONフォーマットでデータをエクスポートし、Supabaseにインポートします。

3. 必要に応じて、認証情報（パスワードなど）を移行します。Supabase Authはbcryptハッシュ化パスワードをサポートしています。

4. メタデータやファイルがある場合は、Supabase Storageにアップロードします。

### 3. Vercelプロジェクトのセットアップ

1. [Vercel](https://vercel.com/) にアカウントを作成する
2. GitHub, GitLab, または BitBucketと連携する
3. このリポジトリをGitHubにプッシュ
4. Vercelでインポートし、新しいプロジェクトとして設定

#### 環境変数の設定

Vercelの環境変数セクションで以下の変数を設定します：

- `NEXT_PUBLIC_SUPABASE_URL` - SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabaseのアノンキー
- `DATABASE_URL` - PostgreSQLデータベースの接続文字列
- その他必要な環境変数（SendGrid API Keyなど）

### 4. コードの変更点

#### 認証の変更

- Express SessionベースからJWTベースの認証に移行
- `req.isAuthenticated()` チェックは、Supabase Authのセッションチェックに置き換え
- ユーザーデータの取得方法も変更

#### API Endpointsの変更

- Express ルーターからNext.js API Routesへの移行
- データベースアクセスの方法も変更（Drizzle ORMを使用）

#### フロントエンドの変更

- クライアントサイドのコードは、主にAPIのエンドポイントとデータ構造の変更に合わせて更新

### 5. デプロイ

1. ソースコードをGitHubにプッシュ
2. Vercelで連携したGitHubリポジトリからプロジェクトをデプロイ
3. 環境変数が正しく設定されていることを確認
4. デプロイ完了後、アプリケーションの動作を確認

### 6. ドメイン設定

1. カスタムドメインを使用する場合は、Vercelのドメイン設定セクションで設定
2. DNSレコードを更新し、カスタムドメインをVercelにポイント
3. SSL証明書が自動的に発行されることを確認

### 7. テストと確認

1. ユーザー認証機能のテスト
2. 予約機能のテスト
3. チケット購入・管理機能のテスト
4. レポート機能のテスト
5. レスポンシブデザインのテスト（モバイル対応）

### 8. 注意点と制限事項

1. Replitで使用していたメモリストアはSupabaseに移行
2. 一部の機能はSupabaseの機能制限により、実装方法が変わる可能性がある
3. 運用環境での監視やログ記録の方法も変更

### 9. トラブルシューティング

#### 認証関連の問題

- Supabase認証のデバッグ方法： Supabase Dashboardのログを確認
- JWTトークンの期限切れ問題の対処法

#### データベース関連の問題

- 接続エラーの対処法
- クエリのパフォーマンス最適化方法

### 10. 参考リンク

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Supabase ドキュメント](https://supabase.com/docs)
- [Vercel デプロイドキュメント](https://vercel.com/docs)
- [Drizzle ORM ドキュメント](https://orm.drizzle.team/docs/overview)

### 11. メンテナンス

1. バックアップ方法
2. スケーリング方法
3. モニタリングとアラート設定

### 付録: Supabaseの主要機能

- **Authentication**: ユーザー認証とセッション管理
- **Database**: PostgreSQLデータベース
- **Storage**: ファイルストレージ
- **Edge Functions**: サーバーレス関数
- **Realtime**: リアルタイムデータ更新

### 付録: Vercelの主要機能

- **CI/CD**: 継続的インテグレーションと継続的デプロイメント
- **Preview Deployments**: PRごとのプレビューデプロイメント
- **Analytics**: ウェブサイト分析
- **Speed Insights**: パフォーマンス分析
- **Edge Functions**: エッジでのサーバーレス関数実行
