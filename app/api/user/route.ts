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
    
    // Fetch user data from the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
      
    if (userError) {
      console.error("User data fetch error:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Return the user data
    return NextResponse.json({
      id: userData.id,
      user_id: userData.user_id,
      username: userData.username,
      firstName: userData.first_name,
      lastName: userData.last_name,
      role: userData.role,
      email: userData.email,
      profileCompleted: userData.profile_completed
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}