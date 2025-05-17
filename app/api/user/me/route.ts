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
    
    // Fetch user data from the database by email instead of user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
      
    if (userError) {
      console.error("User data fetch error:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Return the user data
    return NextResponse.json({
      id: userData.id,
      auth_id: session.user.id, // Supabaseの認証ID
      username: userData.username,
      firstName: userData.first_name,
      lastName: userData.last_name,
      role: userData.role,
      email: userData.email,
      profileCompleted: userData.profile_completed,
      displayName: userData.display_name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim()
    });
  } catch (error) {
    console.error("Server error:", error);
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
    
    // データベース更新
    const { error: updateError } = await supabase
      .from('users')
      .update(data)
      .eq('email', session.user.email);
      
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    
    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}