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
    
    // まず、テーブルが存在するか確認し、なければ作成する
    try {
      console.log('[API] Checking if table exists');
      const { error: tableCheckError } = await supabase
        .from('tutor_profile')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.log('[API] Table might not exist, attempting to create it');
        const { error: createTableError } = await supabase
          .rpc('create_tutor_profile_table_if_not_exists');
        
        if (createTableError) {
          console.error('[API] Failed to create table:', createTableError);
        } else {
          console.log('[API] Table created successfully');
        }
      }
    } catch (tableError) {
      console.error('[API] Error checking/creating table:', tableError);
    }
    
    // プロフィールデータを準備
    // 重要: ここでidフィールドを生成して含める
    const profileData = {
      id: crypto.randomUUID(), // UUIDを明示的に生成
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
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    try {
      // 標準的なInsert操作
      console.log('[API] Attempting standard insert with explicit ID');
      
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
        // RPC呼び出しを試みる
        console.log('[API] Trying RPC call to insert tutor profile');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('insert_tutor_profile', { 
            profile: profileData 
          });
        
        if (rpcError) {
          console.error('[API] RPC call failed:', rpcError);
          return NextResponse.json({ 
            error: 'Database error during RPC call', 
            details: rpcError 
          }, { status: 500 });
        }
        
        console.log('[API] RPC call succeeded:', rpcData);
        return NextResponse.json({ success: true, data: rpcData });
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
