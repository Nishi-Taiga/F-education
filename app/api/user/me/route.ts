import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    
    console.log("API /me: Session found, user email:", session.user.email);
    
    // まずは全ユーザーを取得して、クライアント側でフィルタリング
    const { data: usersList, error: usersError } = await supabase
      .from('users')
      .select('*');
      
    if (usersError) {
      console.error("API /me: Error fetching users list:", usersError);
      return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 500 });
    }
    
    console.log("API /me: Users list retrieved, count:", usersList?.length);
    
    // メールアドレスが一致するユーザーを検索
    const userData = usersList?.find(user => 
      user.email?.toLowerCase() === session.user.email.toLowerCase() || 
      user.username?.toLowerCase() === session.user.email.toLowerCase()
    );
    
    if (!userData) {
      console.error("API /me: User not found for email:", session.user.email);
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    
    console.log("API /me: Found user:", userData);
    
    // Return the user data
    return NextResponse.json({
      id: userData.id,
      auth_id: session.user.id, // Supabaseの認証ID
      username: userData.username,
      firstName: userData.first_name,
      lastName: userData.last_name,
      role: userData.role,
      email: userData.email || session.user.email,
      profileCompleted: userData.profile_completed,
      displayName: userData.display_name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim()
    });
  } catch (error) {
    console.error("API /me: Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // ユーザー情報更新処理
    const data = await request.json();
    const supabase = createServerClient();
    
    // セッション確認
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session || !session.user) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    
    console.log("API /me POST: Updating user with email:", session.user.email, "Data:", data);
    
    // まずユーザーを検索
    const { data: usersList, error: usersError } = await supabase
      .from('users')
      .select('*');
      
    if (usersError) {
      console.error("API /me POST: Error fetching users list:", usersError);
      return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 500 });
    }
    
    // メールアドレスが一致するユーザーを検索
    const userData = usersList?.find(user => 
      user.email?.toLowerCase() === session.user.email.toLowerCase() || 
      user.username?.toLowerCase() === session.user.email.toLowerCase()
    );
    
    if (!userData) {
      console.error("API /me POST: User not found for email:", session.user.email);
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    
    // データベース更新
    const { error: updateError } = await supabase
      .from('users')
      .update(data)
      .eq('id', userData.id);
      
    if (updateError) {
      console.error("API /me POST: Error updating user:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    
    console.log("API /me POST: User updated successfully");
    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("API /me POST: Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}