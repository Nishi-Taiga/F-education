import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * サーバーサイドのSupabaseクライアントを作成する関数
 * Next.jsのAPI RoutesやServer Componentsから使用する
 */
export function createClient() {
  const cookieStore = cookies();
  
  // Supabaseクライアントを初期化
  return createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  );
}
