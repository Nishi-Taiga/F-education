import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// サインインが必要なパスのリスト
const PROTECTED_PATHS = [
  '/dashboard',
  '/booking',
  '/tickets',
  '/settings',
  '/reports',
  '/profile-setup',
  '/tutor-schedule',
  '/tutor-bookings',
  '/report-edit',
  '/profile-setup/tutor',
];

// ユーザーがログインせずにアクセスできるパス
const PUBLIC_PATHS = [
  '/auth',
  '/auth/login',
  '/auth/register',
];

export function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  
  // 認証セッション情報の取得
  const supabaseSession = request.cookies.get('sb-iknunqtcfpdpwkovggqr-auth-token')?.value;
  
  // Replit版の動作を模倣: ルートパス(/)へのアクセスは認証状態に応じてリダイレクト
  if (currentPath === '/') {
    // ログイン済みの場合はダッシュボードへリダイレクト
    if (supabaseSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // 未ログインの場合は認証ページへリダイレクト
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  // 保護されたパスへのアクセスだが認証情報がない場合は認証ページへリダイレクト
  if (PROTECTED_PATHS.some(path => currentPath.startsWith(path)) && !supabaseSession) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  // 認証済みなのに認証ページにアクセスしようとした場合はダッシュボードへリダイレクト
  if (PUBLIC_PATHS.some(path => currentPath.startsWith(path)) && supabaseSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};
