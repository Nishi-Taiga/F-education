import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { bookings, tutors, students, users } from "@/shared/schema";
import { z } from "zod";

// Booking creation schema
const createBookingSchema = z.object({
  studentId: z.number().optional(),
  tutorId: z.number(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().optional(),
});

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
    
    // Get user's bookings (different logic based on role)
    let userBookings;
    
    if (userDetails.role === 'student' && userDetails.studentId) {
      // Student account - get bookings for this student
      userBookings = await db
        .select({
          id: bookings.id,
          date: bookings.date,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          tutorId: bookings.tutorId,
          studentId: bookings.studentId,
          notes: bookings.notes,
        })
        .from(bookings)
        .where(eq(bookings.studentId, userDetails.studentId));
    } else if (userDetails.role === 'tutor') {
      // Tutor account - get bookings for this tutor
      const [tutorDetails] = await db
        .select()
        .from(tutors)
        .where(eq(tutors.userId, userDetails.id));
      
      if (!tutorDetails) {
        return NextResponse.json({ error: "Tutor profile not found" }, { status: 404 });
      }
      
      userBookings = await db
        .select({
          id: bookings.id,
          date: bookings.date,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          tutorId: bookings.tutorId,
          studentId: bookings.studentId,
          notes: bookings.notes,
        })
        .from(bookings)
        .where(eq(bookings.tutorId, tutorDetails.id));
    } else {
      // Parent/regular account - get all bookings for their students
      const studentsList = await db
        .select()
        .from(students)
        .where(and(
          eq(students.userId, userDetails.id),
          eq(students.isActive, true)
        ));
      
      const studentIds = studentsList.map(student => student.id);
      
      if (studentIds.length === 0) {
        return NextResponse.json([]);
      }
      
      userBookings = await db
        .select({
          id: bookings.id,
          date: bookings.date,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          tutorId: bookings.tutorId,
          studentId: bookings.studentId,
          notes: bookings.notes,
        })
        .from(bookings)
        .where(eq(bookings.studentId, studentIds[0])); // Simplified for now
    }
    
    // Enhance bookings with tutor and student names
    const enhancedBookings = await Promise.all(
      userBookings.map(async (booking) => {
        // Get tutor name if available
        let tutorName = null;
        if (booking.tutorId) {
          const [tutor] = await db
            .select({ 
              lastName: tutors.lastName,
              firstName: tutors.firstName
            })
            .from(tutors)
            .where(eq(tutors.id, booking.tutorId));
          
          if (tutor) {
            tutorName = `${tutor.lastName} ${tutor.firstName}`;
          }
        }
        
        // Get student name if available
        let studentName = null;
        if (booking.studentId) {
          const [student] = await db
            .select({
              lastName: students.lastName,
              firstName: students.firstName
            })
            .from(students)
            .where(eq(students.id, booking.studentId));
            
          if (student) {
            studentName = `${student.lastName} ${student.firstName}`;
          }
        }
        
        return {
          ...booking,
          tutorName,
          studentName
        };
      })
    );
    
    return NextResponse.json(enhancedBookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const result = createBookingSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { studentId, tutorId, date, startTime, endTime, notes } = result.data;
    
    // Create the booking
    const [newBooking] = await db
      .insert(bookings)
      .values({
        studentId: studentId || 0,
        tutorId,
        date,
        startTime,
        endTime,
        status: "confirmed",
        notes: notes || null,
        ticketsUsed: 1
      })
      .returning();
    
    return NextResponse.json(newBooking);
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
