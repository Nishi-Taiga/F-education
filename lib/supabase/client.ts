import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 環境変数チェックと情報をログに出力（開発環境用）
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in client');
  } else {
    console.log('Supabase client initialized with URL:', supabaseUrl);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'feducation-auth-token',
  }
});
