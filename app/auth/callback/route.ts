import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Supabase URL
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';
const USERS_TABLE = 'users';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  console.log("Auth callback triggered. URL:", request.url);
  console.log("Code param:", code ? "Present" : "Not present");
  
  // コードがない場合はホームにリダイレクト
  if (!code) {
    console.log("No code present, redirecting to home");
    return NextResponse.redirect(new URL('/', request.url));
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

    // セッション情報からユーザーIDを取得
    const userId = data?.session?.user?.id;
    
    if (userId) {
      console.log("User ID from auth:", userId);
      
      // ユーザーデータベースで既存のユーザーを確認
      const { data: userData, error: userError } = await supabase
        .from(USERS_TABLE)
        .select('id, first_name, last_name, profile_completed')
        .eq('auth_user_id', userId)
        .single();
      
      if (userError && userError.code !== 'PGRST116') {
        console.error("Error checking user:", userError);
      }
      
      // ユーザーが存在しない場合、新規作成
      if (userError && userError.code === 'PGRST116') {
        console.log("User not found in database, creating new user");
        
        const { data: newUser, error: createError } = await supabase
          .from(USERS_TABLE)
          .insert([{
            auth_user_id: userId,
            email: data.session.user.email,
            role: 'parent',
            profile_completed: false
          }])
          .select();
        
        if (createError) {
          console.error("Failed to create user:", createError);
        } else {
          console.log("New user created:", newUser);
        }
        
        // 新規ユーザーなのでプロフィール設定ページへリダイレクト
        console.log("Redirecting new user to profile setup");
        return NextResponse.redirect(new URL('/profile-setup', request.url));
      }
      
      // プロフィール情報が設定されていないユーザー、またはプロフィール完了フラグがfalse
      if (!userData || !userData.first_name || !userData.last_name || userData.profile_completed === false) {
        console.log("Incomplete profile, redirecting to profile setup");
        return NextResponse.redirect(new URL('/profile-setup', request.url));
      }
      
      console.log("Existing user with complete profile, redirecting to dashboard");
    }
    
    // 既存ユーザーはダッシュボードにリダイレクト
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}