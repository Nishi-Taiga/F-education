import { db } from "./db";
import { users, students, tutors, tutorShifts } from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

// データベースに初期データをロードする関数
export async function seedDatabase() {
  try {
    console.log("データベースの初期化を開始...");
    
    // ユーザーテーブルチェック
    const existingUsers = await db.select({ count: sql`count(*)` }).from(users);
    if (Number(existingUsers[0].count) > 0) {
      console.log("データベースには既にデータが存在します。シードはスキップします。");
      return;
    }
    
    // パスワードをハッシュ化
    const userPassword = await hashPassword("password123");
    const tutorPassword = await hashPassword("tutor123");
    
    // テストユーザー（保護者）を作成
    const [testUser] = await db.insert(users).values({
      username: "testuser",
      password: userPassword,
      displayName: "テストユーザー",
      email: "test@example.com",
      role: "user",
      ticketCount: 10,
      phone: "090-1234-5678",
      postalCode: "100-0001",
      prefecture: "東京都",
      city: "千代田区",
      address: "千代田1-1-1",
      profileCompleted: true,
      emailNotifications: true,
      smsNotifications: false
    }).returning();
    
    // テスト用の生徒を作成（高校生と小学生）
    const [student1] = await db.insert(students).values({
      userId: testUser.id,
      lastName: "テスト",
      firstName: "太郎",
      lastNameFurigana: "てすと",
      firstNameFurigana: "たろう",
      gender: "male",
      school: "テスト高等学校",
      grade: "高校2年生",
      birthDate: "2008-05-15",
      isActive: true
    }).returning();
    
    const [student2] = await db.insert(students).values({
      userId: testUser.id,
      lastName: "テスト",
      firstName: "花子",
      lastNameFurigana: "てすと",
      firstNameFurigana: "はなこ",
      gender: "female",
      school: "テスト小学校",
      grade: "3年生",
      birthDate: "2015-08-23",
      isActive: true
    }).returning();
    
    // テスト講師ユーザーを作成
    const [tutorUser] = await db.insert(users).values({
      username: "testutor",
      password: tutorPassword,
      displayName: "テスト講師",
      email: "tutor@example.com",
      role: "tutor",
      profileCompleted: true,
      tutorProfileCompleted: true
    }).returning();
    
    // テスト講師プロフィールを作成
    const [tutor] = await db.insert(tutors).values({
      userId: tutorUser.id,
      lastName: "講師",
      firstName: "太郎",
      lastNameFurigana: "こうし",
      firstNameFurigana: "たろう",
      university: "東京大学",
      birthDate: "1995-01-15",
      subjects: "小学国語,小学算数,中学数学,高校数学",
      bio: "数学が得意な講師です。分かりやすい授業を心がけています。",
      isActive: true,
      profileCompleted: true
    }).returning();
    
    // テスト講師のシフトを追加（翌日から1週間分）
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const timeSlot of ["16:00-17:30", "18:00-19:30", "20:00-21:30"]) {
        // 講師の担当科目からランダムに1つ選択
        const subjectList = tutor.subjects.split(',');
        const randomSubject = subjectList[Math.floor(Math.random() * subjectList.length)];
        
        await db.insert(tutorShifts).values({
          tutorId: tutor.id,
          date: dateStr,
          timeSlot: timeSlot,
          subject: randomSubject,
          isAvailable: Math.random() > 0.3 // ランダムに空き状況を設定
        });
      }
    }
    
    console.log("テストユーザーとテストデータを作成しました:", {
      user: testUser.username,
      students: [
        `${student1.lastName} ${student1.firstName}`,
        `${student2.lastName} ${student2.firstName}`
      ],
      tutor: `${tutor.lastName} ${tutor.firstName}`
    });
  } catch (error) {
    console.error("テストデータの作成に失敗しました:", error);
    throw error;
  }
}

// ESMモジュールでは直接require.mainが使えないため、この部分は削除

// この関数をエクスポートしてindex.tsから呼び出す