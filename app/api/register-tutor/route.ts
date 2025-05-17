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
    
    // 認証セッションを取得
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // ユーザーIDの一貫性をチェック
    if (session.user.id !== tutorData.user_id) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }
    
    console.log('[API] Attempting to save tutor profile:', tutorData);
    
    // テーブルにデータを挿入
    let result;
    
    // 複数の方法を試す
    try {
      // 1. 通常のinsert操作
      console.log('[API] Trying standard insert...');
      const { data: insertData, error: insertError } = await supabase
        .from('tutor_profile')
        .insert(tutorData)
        .select();
      
      if (insertError) {
        console.error('[API] Standard insert failed:', insertError);
        throw new Error(`Standard insert failed: ${insertError.message}`);
      }
      
      result = insertData;
      console.log('[API] Standard insert succeeded:', result);
    } catch (standardError) {
      // 2. SQL文を直接実行
      try {
        console.log('[API] Trying raw SQL insert...');
        
        // SQLクエリを構築
        const columns = Object.keys(tutorData).join(', ');
        const placeholders = Object.keys(tutorData).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(tutorData);
        
        const { data: sqlData, error: sqlError } = await supabase
          .rpc('execute_sql', {
            sql_query: `INSERT INTO tutor_profile (${columns}) VALUES (${placeholders}) RETURNING *`,
            params: values
          });
        
        if (sqlError) {
          console.error('[API] SQL insert failed:', sqlError);
          throw new Error(`SQL insert failed: ${sqlError.message}`);
        }
        
        result = sqlData;
        console.log('[API] SQL insert succeeded:', result);
      } catch (sqlError) {
        // 3. テーブル作成を試みる（通常これは必要ないはず）
        try {
          console.log('[API] Creating table as last resort...');
          
          const { error: tableError } = await supabase
            .rpc('execute_sql', {
              sql_query: `
                CREATE TABLE IF NOT EXISTS tutor_profile (
                  id SERIAL PRIMARY KEY,
                  user_id UUID NOT NULL,
                  first_name TEXT NOT NULL,
                  last_name TEXT NOT NULL,
                  last_name_furigana TEXT,
                  first_name_furigana TEXT,
                  university TEXT,
                  birth_date TEXT,
                  subjects TEXT,
                  email TEXT,
                  bio TEXT,
                  profile_completed BOOLEAN DEFAULT TRUE,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
              `,
              params: []
            });
          
          if (tableError) {
            console.error('[API] Table creation failed:', tableError);
            throw new Error(`Table creation failed: ${tableError.message}`);
          }
          
          // テーブルを作成した後にもう一度挿入を試みる
          const { data: finalData, error: finalError } = await supabase
            .from('tutor_profile')
            .insert(tutorData)
            .select();
          
          if (finalError) {
            console.error('[API] Final insert attempt failed:', finalError);
            throw new Error(`Final insert attempt failed: ${finalError.message}`);
          }
          
          result = finalData;
          console.log('[API] Final insert succeeded after table creation:', result);
        } catch (finalError) {
          console.error('[API] All methods failed:', finalError);
          return NextResponse.json({ error: 'All insert methods failed' }, { status: 500 });
        }
      }
    }
    
    // 成功したら結果を返す
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
