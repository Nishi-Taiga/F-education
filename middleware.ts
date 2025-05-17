import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // セッションを取得
  const { data: { session } } = await supabase.auth.getSession();
  
  // パス情報を取得
  const { pathname } = req.nextUrl;
  
  // 認証ページ関連のパス
  const authRelatedPaths = ['/auth', '/login', '/register', '/signup'];
  
  // プロフィール設定ページ関連のパス
  const profileSetupPaths = ['/profile-setup', '/profile-setup/parent', '/profile-setup/tutor'];
  
  // 認証済みで、認証関連ページにアクセスしようとしている場合
  if (session && authRelatedPaths.some(path => pathname.startsWith(path))) {
    // ダッシュボードにリダイレクト
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  
  // 認証済みのユーザーのプロフィール確認
  if (session && !pathname.startsWith('/api/')) {
    const email = session.user.email;
    
    if (email) {
      // ユーザーがusersテーブルに存在するか確認
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('profile_completed')
        .eq('email', email)
        .maybeSingle();
      
      // プロフィール未設定で、プロフィール設定ページ以外にアクセスしようとしている場合
      if ((!existingUser || !existingUser.profile_completed) && 
          !profileSetupPaths.some(path => pathname.startsWith(path)) && 
          !pathname.startsWith('/api/')) {
        // プロフィール設定ページにリダイレクト
        return NextResponse.redirect(new URL('/profile-setup', req.url));
      }
    }
  }
  
  return res;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Apply to all routes except those that start with:
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
