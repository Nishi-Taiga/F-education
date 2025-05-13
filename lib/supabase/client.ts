import { createClient } from '@supabase/supabase-js';

// ここでハードコードされた値をフォールバックとして使用
const FALLBACK_SUPABASE_URL = 'https://odokliluhbzqsdzdyyho.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2tsaWx1aGJ6cXNkemR5eWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQ2NjkwMDYsImV4cCI6MjAzMDI0NTAwNn0.cTQ-t_Uh7XmItWRdPm18w1iq1tGABcDkYw6KnRKkv9o';

// 環境変数から値を取得し、フォールバックを使用
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// 環境変数チェックと情報をログに出力（開発環境用）
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in client');
  } else {
    console.log('Supabase client URL:', supabaseUrl);
  }
}

// タイムアウトやリトライを含むより堅牢なクライアント設定
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'feducation-auth-token',
  },
  global: {
    fetch: async (url, options = {}) => {
      // タイムアウトを追加
      const timeout = 30000; // 30秒
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      options.signal = controller.signal;
      
      try {
        const response = await fetch(url, options);
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        console.error(`Fetch error for ${url}:`, error);
        throw error;
      }
    }
  }
});
