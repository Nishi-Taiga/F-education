import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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
    
    // 認証成功後にダッシュボードにリダイレクト
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}