import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/shared/schema";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get session from Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Get auth user
    const authUser = session.user;
    
    // Find user in our database
    const [userDetails] = await db
      .select()
      .from(users)
      .where(eq(users.email, authUser.email || ''));
    
    if (!userDetails) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Return user details (excluding sensitive fields)
    return NextResponse.json({
      id: userDetails.id,
      displayName: userDetails.displayName,
      email: userDetails.email,
      phone: userDetails.phone,
      postalCode: userDetails.postalCode,
      prefecture: userDetails.prefecture,
      city: userDetails.city,
      address: userDetails.address,
      profileCompleted: userDetails.profileCompleted,
      tutorProfileCompleted: userDetails.tutorProfileCompleted,
      ticketCount: userDetails.ticketCount,
      role: userDetails.role,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
