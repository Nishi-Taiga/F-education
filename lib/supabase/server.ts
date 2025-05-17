import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * サーバーサイドのSupabaseクライアントを作成する関数
 * Next.jsのAPI RoutesやServer Componentsから使用する
 */
export function createClient() {
  const cookieStore = cookies();
  
  // Supabaseクライアントを初期化
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
