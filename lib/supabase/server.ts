import { createClient } from '@supabase/supabase-js';

// 明示的なハードコード値（必須）
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbnVucXRjZnBkcHdrb3ZnZ3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjA2ODQsImV4cCI6MjA2MjQ5NjY4NH0.H8BKyngllaBTTz6VBg4y1nd-6udqFq5yr16rK5XtCTY';

// サーバークライアントは毎回新しいインスタンスを作成するが、
// クライアント側と同じ認証情報を使用
export function createServerClient() {
  // デバッグ情報
  console.log('Creating Supabase server client');
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false, // サーバーサイドではトークン自動更新は不要
    }
  });
}