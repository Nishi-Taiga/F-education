import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const supabase = createServerComponentClient({ cookies });
  
  // セッションチェック
  const { data } = await supabase.auth.getSession();
  
  // ログイン済みならダッシュボードにリダイレクト
  if (data.session) {
    redirect('/dashboard');
  }
  
  // 未ログインなら認証ページにリダイレクト
  redirect('/auth');
}