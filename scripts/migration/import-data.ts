import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config({ path: '.env.local' });

// データベース接続
const pool = new Pool({ connectionString: process.env.DATABASE_URL as string });
const db = drizzle({ client: pool, schema });

async function main() {
  console.log('データの移行を開始します...');

  try {
    // データディレクトリを確認
    const dataDir = path.join(__dirname, '../../data');
    
    // 生徒データを移行
    if (fs.existsSync(path.join(dataDir, 'students.json'))) {
      await importStudents();
    }
    
    // 講師データを移行
    if (fs.existsSync(path.join(dataDir, 'tutors.json'))) {
      await importTutors();
    }
    
    // シフトデータを移行
    if (fs.existsSync(path.join(dataDir, 'tutorShifts.json'))) {
      await importTutorShifts();
    }
    
    // 予約データを移行
    if (fs.existsSync(path.join(dataDir, 'bookings.json'))) {
      await importBookings();
    }
    
    // 生徒チケットデータを移行
    if (fs.existsSync(path.join(dataDir, 'studentTickets.json'))) {
      await importStudentTickets();
    }
    
    // 支払い取引データを移行
    if (fs.existsSync(path.join(dataDir, 'paymentTransactions.json'))) {
      await importPaymentTransactions();
    }
    
    // レッスンレポートデータを移行
    if (fs.existsSync(path.join(dataDir, 'lessonReports.json'))) {
      await importLessonReports();
    }

    console.log('データの移行が完了しました！');
  } catch (error) {
    console.error('移行プロセス中にエラーが発生しました', error);
  } finally {
    // リソースをクリーンアップ
    await pool.end();
  }
}

// 生徒データのインポート
async function importStudents() {
  console.log('生徒データのインポートを開始します...');
  const studentsJsonPath = path.join(__dirname, '../../data/students.json');
  const studentsData = JSON.parse(fs.readFileSync(studentsJsonPath, 'utf8'));
  
  for (const studentData of studentsData) {
    try {
      await db.insert(schema.students).values({
        userId: studentData.userId,
        lastName: studentData.lastName,
        firstName: studentData.firstName,
        lastNameFurigana: studentData.lastNameFurigana,
        firstNameFurigana: studentData.firstNameFurigana,
        gender: studentData.gender,
        school: studentData.school,
        grade: studentData.grade,
        birthDate: studentData.birthDate,
        isActive: studentData.isActive ?? true,
        studentAccountId: studentData.studentAccountId || null,
      });
      console.log(`生徒をインポートしました: ${studentData.lastName} ${studentData.firstName}`);
    } catch (error) {
      console.error(`生徒のインポートに失敗: ${studentData.lastName} ${studentData.firstName}`, error);
    }
  }
}

// 講師データのインポート
async function importTutors() {
  console.log('講師データのインポートを開始します...');
  const tutorsJsonPath = path.join(__dirname, '../../data/tutors.json');
  const tutorsData = JSON.parse(fs.readFileSync(tutorsJsonPath, 'utf8'));
  
  for (const tutorData of tutorsData) {
    try {
      await db.insert(schema.tutors).values({
        userId: tutorData.userId,
        lastName: tutorData.lastName,
        firstName: tutorData.firstName,
        lastNameFurigana: tutorData.lastNameFurigana,
        firstNameFurigana: tutorData.firstNameFurigana,
        university: tutorData.university,
        birthDate: tutorData.birthDate,
        subjects: tutorData.subjects,
        email: tutorData.email || null,
        isActive: tutorData.isActive ?? true,
        profileCompleted: tutorData.profileCompleted ?? true,
      });
      console.log(`講師をインポートしました: ${tutorData.lastName} ${tutorData.firstName}`);
    } catch (error) {
      console.error(`講師のインポートに失敗: ${tutorData.lastName} ${tutorData.firstName}`, error);
    }
  }
}

// 講師シフトデータのインポート
async function importTutorShifts() {
  console.log('講師シフトデータのインポートを開始します...');
  const shiftsJsonPath = path.join(__dirname, '../../data/tutorShifts.json');
  const shiftsData = JSON.parse(fs.readFileSync(shiftsJsonPath, 'utf8'));
  
  for (const shiftData of shiftsData) {
    try {
      await db.insert(schema.tutorShifts).values({
        tutorId: shiftData.tutorId,
        date: shiftData.date,
        timeSlot: shiftData.timeSlot,
        subject: shiftData.subject || 'available',
        isAvailable: shiftData.isAvailable ?? true,
      });
      console.log(`シフトをインポートしました: 講師ID=${shiftData.tutorId}, 日付=${shiftData.date}, 時間=${shiftData.timeSlot}`);
    } catch (error) {
      console.error(`シフトのインポートに失敗: 講師ID=${shiftData.tutorId}, 日付=${shiftData.date}`, error);
    }
  }
}

// 予約データのインポート
async function importBookings() {
  console.log('予約データのインポートを開始します...');
  const bookingsJsonPath = path.join(__dirname, '../../data/bookings.json');
  const bookingsData = JSON.parse(fs.readFileSync(bookingsJsonPath, 'utf8'));
  
  for (const bookingData of bookingsData) {
    try {
      await db.insert(schema.bookings).values({
        userId: bookingData.userId,
        studentId: bookingData.studentId || null,
        tutorId: bookingData.tutorId,
        tutorShiftId: bookingData.tutorShiftId,
        date: bookingData.date,
        timeSlot: bookingData.timeSlot,
        subject: bookingData.subject,
        status: bookingData.status || 'confirmed',
        reportStatus: bookingData.reportStatus || 'pending',
        reportContent: bookingData.reportContent || null,
      });
      console.log(`予約をインポートしました: ID=${bookingData.id}, 日付=${bookingData.date}`);
    } catch (error) {
      console.error(`予約のインポートに失敗: ID=${bookingData.id}, 日付=${bookingData.date}`, error);
    }
  }
}

// 生徒チケットデータのインポート
async function importStudentTickets() {
  console.log('生徒チケットデータのインポートを開始します...');
  const ticketsJsonPath = path.join(__dirname, '../../data/studentTickets.json');
  const ticketsData = JSON.parse(fs.readFileSync(ticketsJsonPath, 'utf8'));
  
  for (const ticketData of ticketsData) {
    try {
      await db.insert(schema.studentTickets).values({
        studentId: ticketData.studentId,
        userId: ticketData.userId,
        quantity: ticketData.quantity,
      });
      console.log(`生徒チケットをインポートしました: 生徒ID=${ticketData.studentId}, 数量=${ticketData.quantity}`);
    } catch (error) {
      console.error(`生徒チケットのインポートに失敗: 生徒ID=${ticketData.studentId}`, error);
    }
  }
}

// 支払い取引データのインポート
async function importPaymentTransactions() {
  console.log('支払い取引データのインポートを開始します...');
  const transactionsJsonPath = path.join(__dirname, '../../data/paymentTransactions.json');
  const transactionsData = JSON.parse(fs.readFileSync(transactionsJsonPath, 'utf8'));
  
  for (const transactionData of transactionsData) {
    try {
      await db.insert(schema.paymentTransactions).values({
        userId: transactionData.userId,
        transactionId: transactionData.transactionId,
        paymentMethod: transactionData.paymentMethod || 'paypal',
        amount: transactionData.amount,
        currency: transactionData.currency || 'JPY',
        status: transactionData.status,
        metadata: transactionData.metadata || null,
      });
      console.log(`支払い取引をインポートしました: ID=${transactionData.id}, 取引ID=${transactionData.transactionId}`);
    } catch (error) {
      console.error(`支払い取引のインポートに失敗: ID=${transactionData.id}`, error);
    }
  }
}

// レッスンレポートデータのインポート
async function importLessonReports() {
  console.log('レッスンレポートデータのインポートを開始します...');
  const reportsJsonPath = path.join(__dirname, '../../data/lessonReports.json');
  const reportsData = JSON.parse(fs.readFileSync(reportsJsonPath, 'utf8'));
  
  for (const reportData of reportsData) {
    try {
      await db.insert(schema.lessonReports).values({
        bookingId: reportData.bookingId,
        tutorId: reportData.tutorId,
        studentId: reportData.studentId || null,
        date: reportData.date || null,
        timeSlot: reportData.timeSlot || null,
        unitContent: reportData.unitContent,
        messageContent: reportData.messageContent || null,
        goalContent: reportData.goalContent || null,
      });
      console.log(`レッスンレポートをインポートしました: 予約ID=${reportData.bookingId}`);
    } catch (error) {
      console.error(`レッスンレポートのインポートに失敗: 予約ID=${reportData.bookingId}`, error);
    }
  }
}

main().catch(console.error);
