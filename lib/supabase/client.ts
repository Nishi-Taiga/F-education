import { createClient } from '@supabase/supabase-js';

// 明示的なハードコード値（必須）
// 注意: これらの値はビルド後のコードに埋め込まれるため、
// 環境変数から値を取得できなくても必ず使用される
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbnVucXRjZnBkcHdrb3ZnZ3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjA2ODQsImV4cCI6MjA2MjQ5NjY4NH0.H8BKyngllaBTTz6VBg4y1nd-6udqFq5yr16rK5XtCTY';

// 明示的な識別子をストレージキーに使用して一意性を確保
const STORAGE_KEY = 'feducation-auth-v1';

// シングルトンインスタンスを保持する
let supabaseInstance = null;

// 環境変数の使用を試みるが、ハードコード値を優先
const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

// Supabaseクライアントのインスタンスを取得する関数
export const getSupabaseClient = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // デバッグ情報（開発環境のみ）
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.log('Initializing Supabase client:');
    console.log('URL:', supabaseUrl);
    console.log('Key available:', !!supabaseAnonKey);
  }

  // クライアント設定
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: STORAGE_KEY,
    }
  });

  return supabaseInstance;
};

// 既存のコードとの互換性のために直接のexportも提供
export const supabase = getSupabaseClient();