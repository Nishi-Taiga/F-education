import { pool, db } from "../server/db";
import { bookings, lessonReports } from "../shared/schema";
import { eq, isNotNull, and, sql } from "drizzle-orm";

/**
 * レポートデータをbookingsテーブルからlesson_reportsテーブルに移行する
 * reportStatusとreportContentを持つレコードを探し、対応するレッスンレポートを作成する
 */
async function migrateReports() {
  try {
    console.log("レポートデータの移行を開始します...");

    // reportContentが設定されているbookingsを取得
    const bookingsWithReports = await db.select()
      .from(bookings)
      .where(and(
        isNotNull(bookings.reportContent),
        sql`${bookings.reportContent} != ''`
      ));

    console.log(`移行対象のレポート数: ${bookingsWithReports.length}`);

    if (bookingsWithReports.length === 0) {
      console.log("移行対象のレポートがありません。");
      return;
    }

    // レポート内容をパースする関数
    function parseReportContent(content: string | null): { unitContent: string, messageContent: string, goalContent: string } {
      if (!content) return { unitContent: "不明", messageContent: "", goalContent: "" };
      
      // デフォルト値
      let unitContent = "授業内容";
      let messageContent = "";
      let goalContent = "";
      
      // レポート内容をセクションごとに分割して解析
      const unitMatch = content.match(/【単元】\s*([\s\S]*?)(?=\n\n【|$)/);
      const messageMatch = content.match(/【伝言事項】\s*([\s\S]*?)(?=\n\n【|$)/);
      const goalMatch = content.match(/【来週までの目標\(課題\)】\s*([\s\S]*?)(?=$)/);
      
      if (unitMatch && unitMatch[1]) unitContent = unitMatch[1].trim();
      if (messageMatch && messageMatch[1]) messageContent = messageMatch[1].trim();
      if (goalMatch && goalMatch[1]) goalContent = goalMatch[1].trim();
      
      return { unitContent, messageContent, goalContent };
    }

    // 各レポートを処理
    let migratedCount = 0;
    for (const booking of bookingsWithReports) {
      // 既存のレッスンレポートをチェック
      const existingReport = await db.select()
        .from(lessonReports)
        .where(eq(lessonReports.bookingId, booking.id));
      
      if (existingReport.length > 0) {
        console.log(`予約ID ${booking.id} のレポートは既に移行済みです。スキップします。`);
        continue;
      }
      
      // レポート内容をパース
      const { unitContent, messageContent, goalContent } = parseReportContent(booking.reportContent);
      
      // レポートステータスの設定
      const status = booking.reportStatus === "completed" ? "completed" : "draft";
      
      // 新しいレッスンレポートを作成
      await db.insert(lessonReports).values({
        bookingId: booking.id,
        tutorId: booking.tutorId,
        studentId: booking.studentId,
        unitContent,
        messageContent,
        goalContent,
        status,
        createdAt: booking.createdAt,
        updatedAt: new Date()
      });
      
      migratedCount++;
    }

    console.log(`${migratedCount}件のレポートを正常に移行しました。`);
  } catch (error) {
    console.error("レポート移行中にエラーが発生しました:", error);
  } finally {
    // 終了時に接続を閉じる
    await pool.end();
  }
}

// 移行を実行
migrateReports();