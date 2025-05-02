import { pool, db } from "../server/db";
import { students, users, tutors, tutorShifts, bookings, studentTickets } from "../shared/schema";
import { sql } from "drizzle-orm";

async function createTables() {
  try {
    console.log("データベースマイグレーションを開始します...");

    // studentTickets テーブルの作成
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "student_tickets" (
        "id" SERIAL PRIMARY KEY,
        "student_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "quantity" INTEGER NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY ("student_id") REFERENCES "students" ("id"),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
      );
    `);

    console.log("student_tickets テーブルが正常に作成されました");

    console.log("データベースマイグレーションが完了しました");
  } catch (error) {
    console.error("マイグレーション中にエラーが発生しました:", error);
  } finally {
    // 終了時に接続を閉じる
    await pool.end();
  }
}

// マイグレーションを実行
createTables();