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
        .select('*')
        .eq('user_id', authUid)
        .single();
      if (parentError || !parent) return;
      // 生徒一覧取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_profile')
        .select('id, last_name, first_name, ticket_count')
        .eq('parent_id', parent.id);
      if (!studentsError && studentsData) {
        setStudents(studentsData);
      }
    };
    fetchStudents();
  }, [user]);

  // --- BookingCardの型に合わせたダミー予約データ ---
  const dummyBookings = [
    {
      id: "1",
      date: new Date(),
      startTime: "16:00",
      endTime: "17:30",
      status: "confirmed",
      subject: "数学",
      studentId: "1",
      tutorId: "1",
      studentName: "山田 太郎"
    },
    {
      id: "2",
      date: new Date(Date.now() + 86400000),
      startTime: "18:00",
      endTime: "19:30",
      status: "confirmed",
      subject: "英語",
      studentId: "2",
      tutorId: "1",
      studentName: "佐藤 花子"
    }
  ];

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
                    <span className="font-bold text-green-700">{student.ticket_count}枚</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* カレンダー表示 */}
        <SimpleCalendar bookings={dummyBookings} />
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
              {dummyBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} onClick={() => {}} />
              ))}
            </div>
          </Card>
        )}
        {/* アクションボタン例 */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-md py-3 pb-4 mt-4 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}