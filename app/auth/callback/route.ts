import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Supabase URL
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  console.log("Auth callback triggered. URL:", request.url);
  console.log("Code param:", code ? "Present" : "Not present");
  
  // コードがない場合はダッシュボードにリダイレクト
  if (!code) {
    console.log("No code present, redirecting to dashboard");
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  try {
    const supabase = createServerClient();
    
    console.log("Exchanging code for session...");
    
    // Supabaseの認証コードを交換して処理
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Auth error:", error);
      return NextResponse.redirect(new URL('/?error=auth_error', request.url));
    }
    
    console.log("Auth successful:", data ? "Session data received" : "No session data");

    // セッション情報からユーザーメールアドレスを取得
    const email = data?.session?.user?.email;
    
    if (email) {
      // ユーザーデータベースで既存のユーザーを確認
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, firstName, lastName')
        .eq('email', email)
        .single();
      
      if (userError && userError.code !== 'PGRST116') {
        console.error("Error checking user:", userError);
      }
      
      // プロフィール情報が設定されていないユーザーはプロフィール設定ページへリダイレクト
      if (!userData || !userData.firstName || !userData.lastName) {
        console.log("New user or incomplete profile, redirecting to profile setup");
        return NextResponse.redirect(new URL('/profile-setup', request.url));
      }
      
      console.log("Existing user with profile, redirecting to dashboard");
    }
    
    // 既存ユーザー（またはエラー時）はダッシュボードにリダイレクト
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}