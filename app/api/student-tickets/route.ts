import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { users, students, studentTickets } from "@/shared/schema";

export async function GET(request: NextRequest) {
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
    
    // Get student tickets based on role
    let result = [];
    
    if (userDetails.role === 'student' && userDetails.studentId) {
      // Student account - get own tickets
      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.id, userDetails.studentId));
      
      if (student) {
        // Get the ticket count
        const [ticketSum] = await db
          .select({ 
            ticketCount: sql`COALESCE(SUM(${studentTickets.quantity}), 0)`.as('ticketCount')
          })
          .from(studentTickets)
          .where(eq(studentTickets.studentId, student.id));
        
        result = [{
          studentId: student.id,
          name: `${student.lastName} ${student.firstName}`,
          ticketCount: Number(ticketSum.ticketCount) || 0
        }];
      }
    } else {
      // Parent account - get tickets for all children
      const studentsList = await db
        .select()
        .from(students)
        .where(and(
          eq(students.userId, userDetails.id),
          eq(students.isActive, true)
        ));
      
      // Get ticket counts for each student
      result = await Promise.all(
        studentsList.map(async (student) => {
          const [ticketSum] = await db
            .select({ 
              ticketCount: sql`COALESCE(SUM(${studentTickets.quantity}), 0)`.as('ticketCount')
            })
            .from(studentTickets)
            .where(eq(studentTickets.studentId, student.id));
          
          return {
            studentId: student.id,
            name: `${student.lastName} ${student.firstName}`,
            ticketCount: Number(ticketSum.ticketCount) || 0
          };
        })
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching student tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
