import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 講師プロフィールを登録するAPIエンドポイント
 * POSTリクエストで講師情報を受け取り、tutor_profileテーブルに保存する
 */
export async function POST(request: NextRequest) {
  try {
    // リクエストボディからデータを取得
    const tutorData = await request.json();
    
    // 必須フィールドをチェック
    const requiredFields = [
      'user_id',
      'first_name',
      'last_name',
      'birth_date',
      'subjects'
    ];
    
    for (const field of requiredFields) {
      if (!tutorData[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }
    
    // サーバーサイドSupabaseクライアントを作成
    const supabase = createClient();
    
    console.log('[API] Starting profile registration process with data:', {
      ...tutorData,
      // 機密情報を隠す
      user_id: tutorData.user_id ? `${tutorData.user_id.substring(0, 8)}...` : 'undefined',
    });
    
    // プロフィールデータを準備 - idフィールドを含めない
    // PostgreSQLのUUID生成関数が自動的にidを生成します
    const profileData = {
      user_id: tutorData.user_id,
      first_name: tutorData.first_name,
      last_name: tutorData.last_name,
      last_name_furigana: tutorData.last_name_furigana || '',
      first_name_furigana: tutorData.first_name_furigana || '',
      university: tutorData.university || '',
      birth_date: tutorData.birth_date,
      subjects: tutorData.subjects,
      email: tutorData.email || '',
      profile_completed: true,
      is_active: true
    };
    
    // データの挿入操作を実行
    console.log('[API] Inserting profile data into tutor_profile table');
    const { data: insertedData, error: insertError } = await supabase
      .from('tutor_profile')
      .insert(profileData)
      .select();
    
    if (insertError) {
      console.error('[API] Insert error:', insertError);
      
      // ユーザーIDが同じレコードが既に存在する場合は、更新を試みる
      if (insertError.code === '23505') { // 重複キーエラー
        console.log('[API] Record already exists, trying update');
        const { data: updatedData, error: updateError } = await supabase
          .from('tutor_profile')
          .update(profileData)
          .eq('user_id', tutorData.user_id)
          .select();
          
        if (updateError) {
          console.error('[API] Update error:', updateError);
          return NextResponse.json({ 
            error: 'Failed to update existing profile', 
            details: updateError 
          }, { status: 500 });
        }
        
        console.log('[API] Update successful:', updatedData);
        return NextResponse.json({ success: true, data: updatedData });
      }
      
      // テーブルが存在しない可能性がある場合の処理
      if (insertError.code === '42P01') { // テーブルが存在しない
        return NextResponse.json({ 
          error: 'Table does not exist. Please run the SQL script to create the table.', 
          details: insertError 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to insert profile data', 
        details: insertError 
      }, { status: 500 });
    }
    
    console.log('[API] Insert successful:', insertedData);
    return NextResponse.json({ success: true, data: insertedData });
    
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
