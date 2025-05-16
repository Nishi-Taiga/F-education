import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

// 古いReplitアプリのデータベース接続（ReplitのRun DB接続文字列が必要）
const pool = new Pool({ connectionString: process.env.REPLIT_DATABASE_URL as string });
const db = drizzle({ client: pool, schema });

// エクスポート先ディレクトリ
const exportDir = path.join(__dirname, '../../data');

// データエクスポート関数
async function exportData() {
  console.log('データのエクスポートを開始します...');

  // エクスポートディレクトリが存在することを確認
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  try {
    // ユーザーデータをエクスポート
    const usersData = await db.select().from(schema.users);
    fs.writeFileSync(
      path.join(exportDir, 'users.json'),
      JSON.stringify(usersData, null, 2)
    );
    console.log(`${usersData.length}件のユーザーデータをエクスポートしました`);

    // 生徒データをエクスポート
    const studentsData = await db.select().from(schema.students);
    fs.writeFileSync(
      path.join(exportDir, 'students.json'),
      JSON.stringify(studentsData, null, 2)
    );
    console.log(`${studentsData.length}件の生徒データをエクスポートしました`);

    // 講師データをエクスポート
    const tutorsData = await db.select().from(schema.tutors);
    fs.writeFileSync(
      path.join(exportDir, 'tutors.json'),
      JSON.stringify(tutorsData, null, 2)
    );
    console.log(`${tutorsData.length}件の講師データをエクスポートしました`);

    // 講師シフトデータをエクスポート
    const shiftsData = await db.select().from(schema.tutorShifts);
    fs.writeFileSync(
      path.join(exportDir, 'tutorShifts.json'),
      JSON.stringify(shiftsData, null, 2)
    );
    console.log(`${shiftsData.length}件の講師シフトデータをエクスポートしました`);

    // 予約データをエクスポート
    const bookingsData = await db.select().from(schema.bookings);
    fs.writeFileSync(
      path.join(exportDir, 'bookings.json'),
      JSON.stringify(bookingsData, null, 2)
    );
    console.log(`${bookingsData.length}件の予約データをエクスポートしました`);

    // 生徒チケットデータをエクスポート
    const ticketsData = await db.select().from(schema.studentTickets);
    fs.writeFileSync(
      path.join(exportDir, 'studentTickets.json'),
      JSON.stringify(ticketsData, null, 2)
    );
    console.log(`${ticketsData.length}件の生徒チケットデータをエクスポートしました`);

    // 支払い取引データをエクスポート
    const transactionsData = await db.select().from(schema.paymentTransactions);
    fs.writeFileSync(
      path.join(exportDir, 'paymentTransactions.json'),
      JSON.stringify(transactionsData, null, 2)
    );
    console.log(`${transactionsData.length}件の支払い取引データをエクスポートしました`);

    // レッスンレポートデータをエクスポート
    const reportsData = await db.select().from(schema.lessonReports);
    fs.writeFileSync(
      path.join(exportDir, 'lessonReports.json'),
      JSON.stringify(reportsData, null, 2)
    );
    console.log(`${reportsData.length}件のレッスンレポートデータをエクスポートしました`);

    console.log(`すべてのデータを ${exportDir} にエクスポートしました`);
  } catch (error) {
    console.error('データエクスポート中にエラーが発生しました', error);
  } finally {
    await pool.end();
  }
}

exportData().catch(console.error);
