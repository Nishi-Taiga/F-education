import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  // コードがない場合はダッシュボードにリダイレクト
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  try {
    const supabase = createServerClient();
    
    // Supabaseの認証コードを交換して処理
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Auth error:", error);
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // 認証成功後にダッシュボードにリダイレクト
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
