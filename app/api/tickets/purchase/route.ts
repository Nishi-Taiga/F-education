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
        amount: quantity ? quantity * 1000 : 0, // Assume ¥1000 per ticket
        currency: "JPY",
        status: "completed",
        provider: "manual",
        ticketsPurchased: quantity || 0
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
              quantity: itemQuantity,
              description: "Manual purchase"
            });
        }
      }
      
      return NextResponse.json({
        message: "Tickets purchased successfully",
        transactionId: transaction.id
      });
    } 
    else if (quantity) {
      // For simplicity in this stub - just confirm the purchase
      return NextResponse.json({
        message: "Tickets purchased successfully",
        transactionId: transaction.id,
        quantity
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
