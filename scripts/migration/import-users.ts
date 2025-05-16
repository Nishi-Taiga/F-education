import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config({ path: '.env.local' });

// Supabaseクライアントを初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string // 管理者権限が必要
);

// データベース接続
const pool = new Pool({ connectionString: process.env.DATABASE_URL as string });
const db = drizzle({ client: pool, schema });

async function main() {
  console.log('ユーザーデータの移行を開始します...');

  try {
    // JSONファイルからユーザーデータを読み込む
    // (既存のシステムからエクスポートしたもの)
    const usersJsonPath = path.join(__dirname, '../../data/users.json');
    const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));

    // ユーザーごとに処理
    for (const userData of usersData) {
      console.log(`ユーザーを処理中: ${userData.email}`);

      // 1. Supabase Authにユーザーを作成
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.rawPassword || 'DefaultPassword123', // 実際の実装ではセキュアな方法が必要
        email_confirm: true
      });

      if (authError) {
        console.error(`認証ユーザーの作成に失敗: ${userData.email}`, authError);
        continue;
      }

      // 2. データベースにユーザー情報を挿入
      try {
        await db.insert(schema.users).values({
          // IDはおそらく自動生成
          username: userData.username,
          // パスワードはSupabaseで管理されるので不要
          displayName: userData.displayName,
          email: userData.email,
          phone: userData.phone,
          postalCode: userData.postalCode,
          prefecture: userData.prefecture,
          city: userData.city,
          address: userData.address,
          profileCompleted: userData.profileCompleted || false,
          tutorProfileCompleted: userData.tutorProfileCompleted || false,
          emailNotifications: userData.emailNotifications || true,
          smsNotifications: userData.smsNotifications || false,
          ticketCount: userData.ticketCount || 0,
          role: userData.role || 'parent',
          studentId: userData.studentId || null,
          parentId: userData.parentId || null,
          // createdAtは自動設定
        });

        console.log(`ユーザーをデータベースに追加しました: ${userData.email}`);
      } catch (dbError: any) {
        console.error(`データベースへのユーザー追加に失敗: ${userData.email}`, dbError);
      }
    }

    console.log('ユーザーデータの移行が完了しました！');
  } catch (error) {
    console.error('移行プロセス中にエラーが発生しました', error);
  } finally {
    // リソースをクリーンアップ
    await pool.end();
  }
}

main().catch(console.error);
