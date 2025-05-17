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
    
    // プロフィールデータを準備
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
      profile_completed: true
    };
    
    try {
      // 標準的なInsert操作
      console.log('[API] Attempting standard insert');
      
      const { data: insertData, error: insertError } = await supabase
        .from('tutor_profile')
        .insert(profileData)
        .select();
      
      if (insertError) {
        console.error('[API] Standard insert failed:', insertError);
        throw new Error(`Standard insert failed: ${insertError.message}`);
      }
      
      console.log('[API] Standard insert succeeded:', insertData);
      return NextResponse.json({ success: true, data: insertData });
    } catch (error: any) {
      console.error('[API] Insert error:', error);
      
      // Supabaseの自動処理にアクセスできない場合は別の方法を試す
      try {
        // テーブルのスキーマ確認
        console.log('[API] Checking table schema');
        const { data: schemaData, error: schemaError } = await supabase
          .from('tutor_profile')
          .select('id')
          .limit(1);
        
        if (schemaError) {
          console.error('[API] Schema check failed:', schemaError);
          return NextResponse.json({ 
            error: 'Database error during schema check', 
            details: schemaError 
          }, { status: 500 });
        }
        
        // Upsert操作を試す
        console.log('[API] Trying upsert operation');
        const { data: upsertData, error: upsertError } = await supabase
          .from('tutor_profile')
          .upsert(profileData)
          .select();
        
        if (upsertError) {
          console.error('[API] Upsert failed:', upsertError);
          return NextResponse.json({ 
            error: 'Database error during upsert', 
            details: upsertError 
          }, { status: 500 });
        }
        
        console.log('[API] Upsert succeeded:', upsertData);
        return NextResponse.json({ success: true, data: upsertData });
      } catch (fallbackError: any) {
        console.error('[API] All fallback methods failed:', fallbackError);
        return NextResponse.json({ 
          error: 'All insert methods failed', 
          details: fallbackError.message || String(fallbackError)
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
