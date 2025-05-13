import { createClient } from '@supabase/supabase-js';

// ここでハードコードされた値をフォールバックとして使用（新しい正しい値）
const FALLBACK_SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbnVucXRjZnBkcHdrb3ZnZ3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjA2ODQsImV4cCI6MjA2MjQ5NjY4NH0.H8BKyngllaBTTz6VBg4y1nd-6udqFq5yr16rK5XtCTY';

// 環境変数から値を取得し、フォールバックを使用
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// 環境変数チェックと情報をログに出力
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
