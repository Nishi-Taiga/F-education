import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { BookingCard } from "@/components/booking-card";
import { ReportViewModal } from "@/components/report-view-modal";
import { CommonHeader } from "@/components/common-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText, Search, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Booking, Student } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export default function ReportListPage() {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // レポート閲覧ダイアログ用の状態
  const [showReportViewDialog, setShowReportViewDialog] = useState(false);
  const [viewReportBooking, setViewReportBooking] = useState<(Booking & { studentName?: string }) | null>(null);

  // 予約データの取得
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: !!user,
  });

  // 生徒データの取得
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!user,
  });

  // 生徒名を取得する関数
  const getStudentName = (studentId: number): string => {
    const student = students?.find((s: Student) => s.id === studentId);
    return student ? `${student.lastName} ${student.firstName}` : `生徒ID: ${studentId}`;
  };

  // レポート閲覧ボタンのハンドラ
  const handleViewReportClick = (booking: Booking & { studentName?: string }) => {
    setViewReportBooking(booking);
    setShowReportViewDialog(true);
  };

  // レポートがある予約のみをフィルタリング
  const reportedBookings = Array.isArray(bookings) 
    ? bookings
        .filter((booking: Booking) => booking.reportStatus === 'completed')
        .map((booking: Booking) => ({
          ...booking,
          studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
        }))
        .sort((a: Booking & { studentName?: string }, b: Booking & { studentName?: string }) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()) // 日付の降順でソート
    : [];

  // 検索フィルタリング
  const filteredBookings = reportedBookings.filter((booking: Booking & { studentName?: string }) => {
    if (!searchTerm) return true;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const studentName = booking.studentName || '';
    const subject = booking.subject || '';
    const date = format(parseISO(booking.date), 'yyyy年MM月dd日', { locale: ja });
    
    return studentName.toLowerCase().includes(lowerSearchTerm) || 
           subject.toLowerCase().includes(lowerSearchTerm) ||
           date.includes(searchTerm);
  });

  // テスト用のデータ
  const testReportedBookings = [
    {
      id: 9001,
      createdAt: new Date(),
      userId: user ? user.id : 0,
      tutorId: 1,
      studentId: 4,
      tutorShiftId: 1,
      date: "2025-04-15",
      timeSlot: "16:00-17:30",
      subject: "数学",
      status: "confirmed",
      reportStatus: "completed",
      reportContent: "中学1年の方程式\n授業中は集中して取り組めていました。解説を聞いて理解しようとする姿勢が素晴らしいです。\n次回までに教科書p.45-46の問題を解いてきてください。",
      studentName: "テスト 太郎"
    },
    {
      id: 9002,
      createdAt: new Date(),
      userId: user ? user.id : 0,
      tutorId: 1,
      studentId: 4,
      tutorShiftId: 1,
      date: "2025-04-01",
      timeSlot: "16:00-17:30",
      subject: "英語",
      status: "confirmed",
      reportStatus: "completed",
      reportContent: "中学1年の不定詞\n文法の理解が進んでいます。演習問題では8割以上正解できていました。\n次回までに教科書p.32の例文を音読練習してきてください。",
      studentName: "テスト 太郎"
    }
  ];

  // 最終的に表示するデータ
  const displayBookings = filteredBookings.length > 0 ? filteredBookings : testReportedBookings;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* CommonHeaderを使用 */}
      <CommonHeader showBackButton={true} title="F education" />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">授業レポート一覧</h2>
          <p className="mt-1 text-sm text-gray-600">完了した授業のレポートを確認できます</p>
        </div>
        
        {/* 検索バー */}
        <div className="mb-4 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input 
              type="text" 
              placeholder="生徒名・教科・日付で検索" 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">レポート一覧</h2>
            <div className="text-sm text-gray-500">
              {displayBookings.length}件のレポート
            </div>
          </div>
          
          {isLoadingBookings || isLoadingStudents ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayBookings.length > 0 ? (
            <div className="space-y-3">
              {displayBookings.map(booking => (
                <div key={booking.id} className="group relative">
                  <BookingCard 
                    booking={booking}
                    onViewReportClick={handleViewReportClick}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">レポートはまだありません</p>
              <p className="text-sm text-gray-400 mt-1">
                授業が完了し、講師がレポートを提出すると、ここに表示されます
              </p>
            </div>
          )}
        </Card>
      </main>
      
      {/* レポート閲覧モーダル */}
      {viewReportBooking && (
        <ReportViewModal
          isOpen={showReportViewDialog}
          booking={viewReportBooking}
          onClose={() => setShowReportViewDialog(false)}
        />
      )}
    </div>
  );
}