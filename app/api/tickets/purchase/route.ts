import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { users, students, studentTickets, paymentTransactions } from "@/shared/schema";
import { z } from "zod";

// Ticket purchase schema
const purchaseSchema = z.object({
  items: z.array(
    z.object({
      studentId: z.number(),
      quantity: z.number().positive()
    })
  ).optional(),
  quantity: z.number().positive().optional(), // For legacy support
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get session from Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Get the user from the database
    const [userDetails] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email || ''));
    
    if (!userDetails) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Parse and validate request body
    const body = await request.json();
    const result = purchaseSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { items, quantity } = result.data;
    
    // Create payment transaction record
    const [transaction] = await db
      .insert(paymentTransactions)
      .values({
        userId: userDetails.id,
        transactionId: `manual-${Date.now()}`,
        paymentMethod: "manual",
        amount: 0, // This is a manual purchase
        currency: "JPY",
        status: "completed",
        metadata: JSON.stringify({ items, quantity }),
      })
      .returning();
    
    if (items && items.length > 0) {
      // New format: purchase for specific students
      for (const item of items) {
        const { studentId, quantity: itemQuantity } = item;
        
        // Check if student belongs to this user
        const [student] = await db
          .select()
          .from(students)
          .where(and(
            eq(students.id, studentId),
            eq(students.userId, userDetails.id)
          ));
        
        if (student) {
          // Add tickets to student
          await db
            .insert(studentTickets)
            .values({
              studentId,
              userId: userDetails.id,
              quantity: itemQuantity
            });
        }
      }
      
      // Calculate total tickets for user (legacy support)
      const [ticketSum] = await db
        .select({ 
          ticketCount: sql`COALESCE(SUM(${studentTickets.quantity}), 0)`.as('ticketCount')
        })
        .from(studentTickets)
        .where(eq(studentTickets.userId, userDetails.id));
      
      // Update user's total ticket count
      const totalTickets = Number(ticketSum.ticketCount) || 0;
      await db
        .update(users)
        .set({ ticketCount: totalTickets })
        .where(eq(users.id, userDetails.id));
      
      // Get updated user
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userDetails.id));
      
      return NextResponse.json({
        ticketCount: updatedUser.ticketCount,
        message: "Tickets purchased successfully"
      });
    } 
    else if (quantity) {
      // Legacy format: purchase for user directly
      const newTicketCount = userDetails.ticketCount + quantity;
      
      // Update user's ticket count
      await db
        .update(users)
        .set({ ticketCount: newTicketCount })
        .where(eq(users.id, userDetails.id));
      
      return NextResponse.json({
        ticketCount: newTicketCount,
        message: "Tickets purchased successfully"
      });
    }
    else {
      return NextResponse.json(
        { error: "Invalid request: must provide items or quantity" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error purchasing tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
