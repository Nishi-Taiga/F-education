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
    
    console.log('[API] Starting profile registration process');
    
    // テーブルにデータを挿入
    let result;
    
    // 複数の方法を試す
    try {
      // 直接SQL実行でIDを自動生成する
      console.log('[API] Trying direct SQL insert...');
      
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: `
          INSERT INTO tutor_profile (
            id,
            user_id, 
            first_name, 
            last_name, 
            last_name_furigana, 
            first_name_furigana, 
            university, 
            birth_date, 
            subjects, 
            email, 
            profile_completed
          ) VALUES (
            (SELECT COALESCE(MAX(id), 0) + 1 FROM tutor_profile),
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) RETURNING *
        `,
        params: [
          tutorData.user_id,
          tutorData.first_name,
          tutorData.last_name,
          tutorData.last_name_furigana || '',
          tutorData.first_name_furigana || '',
          tutorData.university || '',
          tutorData.birth_date,
          tutorData.subjects,
          tutorData.email || '',
          true
        ]
      });
      
      if (sqlError) {
        console.error('[API] SQL insert failed:', sqlError);
        throw new Error(`SQL insert failed: ${sqlError.message}`);
      }
      
      result = sqlData;
      console.log('[API] SQL insert succeeded:', result);
    } catch (sqlError) {
      // テーブルの作成を試みる（通常これは必要ないはず）
      try {
        console.log('[API] Creating table as last resort...');
        
        // まずテーブルがあるか確認
        const { data: tableCheck, error: checkError } = await supabase.rpc('execute_sql', {
          sql_query: `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public'
              AND table_name = 'tutor_profile'
            )
          `,
          params: []
        });
        
        if (checkError) {
          console.error('[API] Table check failed:', checkError);
        } else {
          console.log('[API] Table exists check:', tableCheck);
        }
        
        // テーブルを作成
        const { error: tableError } = await supabase.rpc('execute_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS tutor_profile (
              id SERIAL PRIMARY KEY,
              user_id UUID NOT NULL,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              last_name_furigana TEXT,
              first_name_furigana TEXT,
              university TEXT,
              birth_date TEXT NOT NULL,
              subjects TEXT NOT NULL,
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
        
        // データを挿入
        const { data: insertData, error: insertError } = await supabase.rpc('execute_sql', {
          sql_query: `
            INSERT INTO tutor_profile (
              user_id, 
              first_name, 
              last_name, 
              last_name_furigana, 
              first_name_furigana, 
              university, 
              birth_date, 
              subjects, 
              email, 
              profile_completed
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            ) RETURNING *
          `,
          params: [
            tutorData.user_id,
            tutorData.first_name,
            tutorData.last_name,
            tutorData.last_name_furigana || '',
            tutorData.first_name_furigana || '',
            tutorData.university || '',
            tutorData.birth_date,
            tutorData.subjects,
            tutorData.email || '',
            true
          ]
        });
        
        if (insertError) {
          console.error('[API] Final insert attempt failed:', insertError);
          throw new Error(`Final insert attempt failed: ${insertError.message}`);
        }
        
        result = insertData;
        console.log('[API] Final insert succeeded after table creation:', result);
      } catch (finalError) {
        console.error('[API] All methods failed:', finalError);
        return NextResponse.json({ error: 'All insert methods failed', details: finalError }, { status: 500 });
      }
    }
    
    // 成功したら結果を返す
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
