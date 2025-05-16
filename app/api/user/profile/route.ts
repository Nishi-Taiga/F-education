import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/shared/schema";
import { z } from "zod";

// Profile update schema
const profileSchema = z.object({
  parentName: z.string().min(2, "氏名を入力してください"),
  phone: z.string().min(10).max(15),
  postalCode: z.string().min(7).max(8),
  prefecture: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(2),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get session from Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Parse and validate request body
    const body = await request.json();
    const result = profileSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { parentName, phone, postalCode, prefecture, city, address } = result.data;
    
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
    
    // Update user profile
    const [updatedUser] = await db
      .update(users)
      .set({
        displayName: parentName,
        phone,
        postalCode,
        prefecture,
        city,
        address,
        profileCompleted: true
      })
      .where(eq(users.id, userDetails.id))
      .returning();
    
    // Return updated user details (excluding sensitive fields)
    return NextResponse.json({
      id: updatedUser.id,
      displayName: updatedUser.displayName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      postalCode: updatedUser.postalCode,
      prefecture: updatedUser.prefecture,
      city: updatedUser.city,
      address: updatedUser.address,
      profileCompleted: updatedUser.profileCompleted,
      tutorProfileCompleted: updatedUser.tutorProfileCompleted,
      ticketCount: updatedUser.ticketCount,
      role: updatedUser.role,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
