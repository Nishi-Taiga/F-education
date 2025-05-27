"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BookingCard } from "@/components/booking-card";
import { CommonHeader } from "@/components/common-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Calendar, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SimpleCalendar } from "@/components/simple-calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      if (user?.role !== 'parent') return;
      // 認証ユーザーのauth UIDを取得
      const { data: { session } } = await supabase.auth.getSession();
      const authUid = session?.user?.id;
      if (!authUid) return;
      // parent_profileからid取得（user_idはuuid型）
      const { data: parent, error: parentError } = await supabase
        .from('parent_profile')
        .select('id') // Only need parent ID
        .eq('user_id', authUid)
        .single();
      if (parentError || !parent) return;

      // 予約情報を取得
      const fetchBookings = async (parentId) => {
        setIsLoadingBookings(true);
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,\n
            student_profile (last_name, first_name),\n
            tutor_profile (last_name, first_name)\n
          `)
          .eq('parent_id', parentId)
          .order('date', { ascending: true })
          .order('time_slot', { ascending: true });

        if (!bookingsError && bookingsData) {
          // BookingCardの型に合うようにデータを整形
          const formattedBookings = bookingsData.map(booking => ({
            id: booking.id.toString(),
            date: new Date(booking.date + 'T' + booking.time_slot.split(' - ')[0] + ':00'), // Adjust time_slot to be parseable
            startTime: booking.time_slot.split(' - ')[0],
            endTime: booking.time_slot.split(' - ')[1],
            status: booking.status,
            subject: booking.subject,
            studentId: booking.student_id?.toString(),
            tutorId: booking.tutor_id?.toString(),
            studentName: booking.student_profile ? `${booking.student_profile.last_name} ${booking.student_profile.first_name}` : '生徒',
            tutorName: booking.tutor_profile ? `${booking.tutor_profile.last_name} ${booking.tutor_profile.first_name}` : '講師',
          }));
          setBookings(formattedBookings);
        }
        setIsLoadingBookings(false);
      };

      fetchBookings(parent.id);

      // 生徒一覧取得 (ticket_countはここでは取得しない)
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_profile')
        .select('id, last_name, first_name') // Select only profile info
        .eq('parent_id', parent.id);

      if (!studentsError && studentsData) {
        // 各生徒のチケット残数を student_tickets テーブルから計算
        const studentsWithTickets = await Promise.all(studentsData.map(async student => {
          const { data: ticketsData, error: ticketsError } = await supabase
            .from('student_tickets')
            .select('quantity')
            .eq('student_id', student.id);

          const ticketCount = ticketsError || !ticketsData ? 0 : ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0);

          return {
            ...student,
            ticketCount: ticketCount // Add calculated ticket count
          };
        }));
        setStudents(studentsWithTickets); // Update state with processed data
      }
    };
    fetchStudents();
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto flex flex-col">
        {/* チケット残数表示 (親/生徒) */}
        {user?.role === 'parent' && (
          <div className="flex flex-col items-end mb-4">
            <div className="flex flex-col gap-1">
              {students.length === 0 ? (
                <div className="text-gray-400 text-xs">生徒情報がありません</div>
              ) : (
                students.map(student => (
                  <div key={student.id} className="flex items-center bg-gray-50 py-0.5 px-2 rounded-md whitespace-nowrap text-xs border border-gray-200 mb-1">
                    <span className="font-medium truncate mr-2">{student.last_name} {student.first_name}</span>
                    <Ticket className="text-green-600 h-3 w-3 mr-1" />
                    <span className="font-bold text-green-700">{student.ticketCount}枚</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* カレンダー表示 */}
        <SimpleCalendar bookings={bookings} />

        {/* 講師用：本日の授業予定エリア */}
        {user?.role === 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-900">本日の授業予定</h3>
            </div>
            <div className="space-y-2">
              {/* 本来は本日の授業のみ抽出。ここではダミーデータから今日の日付分のみ表示 */}
              {bookings.filter(b => {
                const today = new Date();
                return b.date.getFullYear() === today.getFullYear() &&
                  b.date.getMonth() === today.getMonth() &&
                  b.date.getDate() === today.getDate();
              }).length === 0 ? (
                <div className="text-gray-400 text-xs">本日の授業予定はありません</div>
              ) : (
                bookings.filter(b => {
                  const today = new Date();
                  return b.date.getFullYear() === today.getFullYear() &&
                    b.date.getMonth() === today.getMonth() &&
                    b.date.getDate() === today.getDate();
                }).map(booking => (
                  <BookingCard key={booking.id} booking={booking} onClick={() => {}} />
                ))
              )}
            </div>
          </Card>
        )}
        {user?.role === 'student' && (
          <div className="bg-white shadow-sm rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">チケット残数</h3>
              <div className="flex items-center bg-green-50 py-1 px-3 rounded-full">
                <Ticket className="text-green-600 h-4 w-4 mr-1.5" />
                <span className="font-bold text-green-700">0枚</span>
              </div>
            </div>
          </div>
        )}
        {/* 予約一覧（保護者・生徒向け） */}
        {user?.role !== 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-900">予約一覧</h3>
            </div>
            <div className="space-y-2">
              {isLoadingBookings ? (
                <div className="text-gray-400 text-sm">予約情報を読み込み中...</div>
              ) : bookings.length === 0 ? (
                <div className="text-gray-400 text-sm">予約はありません</div>
              ) : (
                bookings.map(booking => (
                  <BookingCard key={booking.id} booking={booking} onClick={() => {}} />
                ))
              )}
            </div>
          </Card>
        )}
        {/* アクションボタン例 */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-md py-3 pb-4 mt-4 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {user?.role === 'tutor' ? (
                <>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/tutor/schedule")}
                  >
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">シフト管理</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports/new")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-green-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">新規レポート</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">過去レポート</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/tickets")}
                  >
                    <Ticket className="h-4 w-4 mr-2 text-green-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">チケット購入</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/booking")}
                  >
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">授業予約</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">授業レポート</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}