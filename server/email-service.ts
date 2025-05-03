import nodemailer from 'nodemailer';
import { User, Booking, Student, Tutor } from '@shared/schema';
import { format } from 'date-fns';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users } from '@shared/schema';

// メール送信クラス
export class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    // 環境変数からメールの認証情報を取得
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      throw new Error('メール設定が不足しています。EMAIL_USERとEMAIL_PASSを設定してください。');
    }

    this.fromEmail = emailUser;

    // GmailのSMTPトランスポーター設定
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // 起動時に接続テスト
    this.testConnection();
  }

  // 接続テスト
  private async testConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      console.log('メールサーバーへの接続に成功しました');
    } catch (error) {
      console.error('メールサーバーへの接続に失敗しました:', error);
    }
  }

  // メール送信
  private async sendMail(options: nodemailer.SendMailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail(options);
      console.log(`メール送信成功: ${options.to}`);
      return true;
    } catch (error) {
      console.error('メール送信エラー:', error);
      return false;
    }
  }

  // ユーザーのメールアドレスを取得
  private async getUserEmail(userId: number): Promise<string | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      return user?.email || null;
    } catch (error) {
      console.error('ユーザーのメールアドレス取得エラー:', error);
      return null;
    }
  }

  // 予約完了メール送信
  async sendBookingConfirmation(
    booking: Booking, 
    student: Student, 
    tutor: Tutor | undefined, 
    parentEmail: string | null
  ): Promise<boolean> {
    // 日付をフォーマット
    const formattedDate = format(new Date(booking.date), 'yyyy年M月d日');
    
    // 保護者へのメール
    if (parentEmail) {
      const parentMailOptions: nodemailer.SendMailOptions = {
        from: `"F education 予約システム" <${this.fromEmail}>`,
        to: parentEmail,
        subject: `【F education】授業予約完了のお知らせ (${formattedDate})`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4b5563; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">授業予約完了のお知らせ</h2>
            
            <p>お子様の授業予約が完了しました。</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>生徒名:</strong> ${student.lastName} ${student.firstName}</p>
              <p style="margin: 5px 0;"><strong>日付:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0;"><strong>時間:</strong> ${booking.timeSlot}</p>
              <p style="margin: 5px 0;"><strong>教科:</strong> ${booking.subject}</p>
              <p style="margin: 5px 0;"><strong>講師名:</strong> ${tutor ? `${tutor.lastName} ${tutor.firstName}` : '未定'}</p>
            </div>
            
            <p>授業の24時間前までにキャンセルされる場合は、チケットは返却されます。それ以降のキャンセルについては、チケットは消費されますのでご了承ください。</p>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
              ※このメールは自動送信されています。このメールに返信しないでください。<br>
              お問い合わせは、F educationカスタマーサポートまでお願いいたします。
            </p>
          </div>
        `,
      };
      
      await this.sendMail(parentMailOptions);
    }
    
    // 講師へのメール
    if (tutor) {
      const tutorEmail = await this.getUserEmail(tutor.userId);
      
      if (tutorEmail) {
        const tutorMailOptions: nodemailer.SendMailOptions = {
          from: `"F education 予約システム" <${this.fromEmail}>`,
          to: tutorEmail,
          subject: `【F education】新規授業予約のお知らせ (${formattedDate})`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4b5563; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">新規授業予約のお知らせ</h2>
              
              <p>新しい授業が予約されました。</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 5px 0;"><strong>生徒名:</strong> ${student.lastName} ${student.firstName}</p>
                <p style="margin: 5px 0;"><strong>学年:</strong> ${student.grade}</p>
                <p style="margin: 5px 0;"><strong>日付:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0;"><strong>時間:</strong> ${booking.timeSlot}</p>
                <p style="margin: 5px 0;"><strong>教科:</strong> ${booking.subject}</p>
              </div>
              
              <p>予約詳細は講師ダッシュボードでご確認ください。</p>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                ※このメールは自動送信されています。このメールに返信しないでください。<br>
                お問い合わせは、F educationカスタマーサポートまでお願いいたします。
              </p>
            </div>
          `,
        };
        
        await this.sendMail(tutorMailOptions);
      }
    }
    
    return true;
  }

  // 予約キャンセルメール送信
  async sendBookingCancellation(
    booking: Booking, 
    student: Student, 
    tutor: Tutor | undefined, 
    parentEmail: string | null
  ): Promise<boolean> {
    // 日付をフォーマット
    const formattedDate = format(new Date(booking.date), 'yyyy年M月d日');
    
    // 保護者へのメール
    if (parentEmail) {
      const parentMailOptions: nodemailer.SendMailOptions = {
        from: `"F education 予約システム" <${this.fromEmail}>`,
        to: parentEmail,
        subject: `【F education】授業キャンセル完了のお知らせ (${formattedDate})`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4b5563; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">授業キャンセル完了のお知らせ</h2>
            
            <p>以下の授業がキャンセルされました。</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>生徒名:</strong> ${student.lastName} ${student.firstName}</p>
              <p style="margin: 5px 0;"><strong>日付:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0;"><strong>時間:</strong> ${booking.timeSlot}</p>
              <p style="margin: 5px 0;"><strong>教科:</strong> ${booking.subject}</p>
              <p style="margin: 5px 0;"><strong>講師名:</strong> ${tutor ? `${tutor.lastName} ${tutor.firstName}` : '未定'}</p>
            </div>
            
            <p>チケットは返却されました。新しい授業の予約は予約画面から行うことができます。</p>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
              ※このメールは自動送信されています。このメールに返信しないでください。<br>
              お問い合わせは、F educationカスタマーサポートまでお願いいたします。
            </p>
          </div>
        `,
      };
      
      await this.sendMail(parentMailOptions);
    }
    
    // 講師へのメール
    if (tutor) {
      const tutorEmail = await this.getUserEmail(tutor.userId);
      
      if (tutorEmail) {
        const tutorMailOptions: nodemailer.SendMailOptions = {
          from: `"F education 予約システム" <${this.fromEmail}>`,
          to: tutorEmail,
          subject: `【F education】授業キャンセルのお知らせ (${formattedDate})`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4b5563; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">授業キャンセルのお知らせ</h2>
              
              <p>以下の授業がキャンセルされました。</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 5px 0;"><strong>生徒名:</strong> ${student.lastName} ${student.firstName}</p>
                <p style="margin: 5px 0;"><strong>日付:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0;"><strong>時間:</strong> ${booking.timeSlot}</p>
                <p style="margin: 5px 0;"><strong>教科:</strong> ${booking.subject}</p>
              </div>
              
              <p>予約状況は講師ダッシュボードでご確認ください。</p>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                ※このメールは自動送信されています。このメールに返信しないでください。<br>
                お問い合わせは、F educationカスタマーサポートまでお願いいたします。
              </p>
            </div>
          `,
        };
        
        await this.sendMail(tutorMailOptions);
      }
    }
    
    return true;
  }
}

// シングルトンインスタンスを作成
export const emailService = new EmailService();