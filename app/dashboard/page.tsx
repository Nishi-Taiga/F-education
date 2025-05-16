"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CommonHeader } from "@/components/common-header";
import { 
  CalendarCheck, 
  Ticket, 
  Settings, 
  UserCog, 
  FileText, 
  Loader2 
} from "lucide-react";
import { CalendarView } from "@/components/calendar-view";
import { BookingCard } from "@/components/booking-card";
import { BookingCancellationModal } from "@/components/booking-cancellation-modal";
import { BookingDetailModal } from "@/components/booking-detail-modal";
import { ReportViewModal } from "@/components/report-view-modal";

// ユーザータイプの定義
type UserRole = 'parent' | 'tutor' | 'student';

// ユーザー情報の型
type UserDetails = {
  id: number;
  user_id: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  email: string;
  profile_completed?: boolean;
  displayName?: string;
  username?: string;
};

// 講師プロファイルの型
type TutorProfile = {
  id: number;
  user_id: string;
  last_name: string;
  first_name: string;
  last_name_furigana: string;
  first_name_furigana: string;
  university: string;
  birth_date: string;
  subjects: string;
  email?: string;
  profile_completed?: boolean;
  created_at: string;
};

// 予約情報の型
type Booking = {
  id: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  tutorId: number;
  studentId: number | null;
  userId: number;
  tutorShiftId?: number;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string;
  studentName?: string;
  tutorName?: string;
};

// チケット情報の型
type StudentTicket = {
  studentId: number;
  name: string;
  ticketCount: number;
};

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studentTickets, setStudentTickets] = useState<StudentTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // 予約カードの状態
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  
  // 予約詳細モーダルの状態
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [selectedDetailBooking, setSelectedDetailBooking] = useState<Booking | null>(null);
  const [studentDetails, setStudentDetails] = useState<{
    lastName: string;
    firstName: string;
    school: string;
    grade: string;
    address?: string;
    phone?: string;
  } | null>(null);
  
  // レポート閲覧モーダルの状態
  const [showReportViewDialog, setShowReportViewDialog] = useState(false);
  const [viewReportBooking, setViewReportBooking] = useState<Booking | null>(null);

  // セッションとユーザー情報の取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          console.log("No session found, redirecting to home");
          router.push('/');
          return;
        }
        
        const authUserId = session.user.id;
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', authUserId)
          .maybeSingle();
          
        if (userError || !userData) {
          console.log("User data not found, redirecting to profile setup");
          setIsRedirecting(true);
          router.push('/profile-setup');
          return;
        }
        
        // display_nameを追加
        const userWithDisplayName = {
          ...userData,
          displayName: userData.last_name && userData.first_name 
            ? `${userData.last_name} ${userData.first_name}` 
            : userData.username || userData.email
        };
        
        setUser(userWithDisplayName);
        
        // ユーザーロールに応じたデータ取得
        if (userData.role === 'tutor') {
          // 講師プロファイルの取得
          const { data: tutorData } = await supabase
            .from('tutor_profiles')
            .select('*')
            .eq('user_id', authUserId)
            .maybeSingle();
            
          if (tutorData) {
            setTutorProfile(tutorData);
          }
          
          // 講師の予約を取得
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('*, students(first_name, last_name)')
            .eq('tutor_id', userData.id)
            .order('date', { ascending: true });
            
          if (bookingsData) {
            // データ変換：Supabase形式からアプリ内形式に変換
            const formattedBookings = bookingsData.map(booking => ({
              id: booking.id,
              date: booking.date,
              timeSlot: `${booking.start_time} - ${booking.end_time}`,
              subject: booking.subject,
              status: booking.status,
              tutorId: booking.tutor_id,
              studentId: booking.student_id,
              userId: booking.user_id,
              reportStatus: booking.report_status,
              reportContent: booking.report_content,
              createdAt: booking.created_at,
              studentName: booking.students ? 
                `${booking.students.last_name} ${booking.students.first_name}` : 
                undefined
            }));
            
            setBookings(formattedBookings);
          }
        } else {
          // 生徒/保護者の予約を取得
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('*, tutors:tutor_id(first_name, last_name)')
            .eq('user_id', userData.id)
            .order('date', { ascending: true });
            
          if (bookingsData) {
            // データ変換
            const formattedBookings = bookingsData.map(booking => ({
              id: booking.id,
              date: booking.date,
              timeSlot: `${booking.start_time} - ${booking.end_time}`,
              subject: booking.subject,
              status: booking.status,
              tutorId: booking.tutor_id,
              studentId: booking.student_id,
              userId: booking.user_id,
              reportStatus: booking.report_status,
              reportContent: booking.report_content,
              createdAt: booking.created_at,
              tutorName: booking.tutors ? 
                `${booking.tutors.last_name} ${booking.tutors.first_name}` : 
                undefined
            }));
            
            setBookings(formattedBookings);
          }
          
          // チケット情報の取得
          const { data: ticketsData } = await supabase
            .from('student_tickets')
            .select('student_id, quantity, students(first_name, last_name)')
            .eq('user_id', userData.id);
            
          if (ticketsData) {
            const formattedTickets = ticketsData.map(ticket => ({
              studentId: ticket.student_id,
              name: ticket.students ? 
                `${ticket.students.last_name} ${ticket.students.first_name}` : 
                "不明",
              ticketCount: ticket.quantity
            }));
            
            setStudentTickets(formattedTickets);
          }
        }
        
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, toast]);
  