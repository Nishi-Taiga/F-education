import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { BookingCard } from "@/components/booking-card";
import { BookingCancellationModal } from "@/components/booking-cancellation-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket, CalendarCheck, Settings, Plus, UserCircle, ClipboardList, UserCog, Clock, BookOpen, Scroll, MapPin, GraduationCap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Booking, Student } from "@shared/schema";

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // キャンセル関連の状態
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { studentName?: string }) | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  
  // 講師の生徒詳細ダイアログ用の状態
  const [showStudentDetailDialog, setShowStudentDetailDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    name: string;
    time: string;
    subject: string;
    grade: string;
    address: string;
  } | null>(null);

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });
  
  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });
  
  // 開発用：チケットを追加するミューテーション
  const addTicketsMutation = useMutation({
    mutationFn: async (quantity: number) => {
      try {
        console.log("チケット追加リクエスト開始:", { quantity });
        
        // apiRequestではなく、直接fetchを使用する（apiRequestはレスポンスを消費してしまう）
        const res = await fetch("/api/tickets/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
          credentials: "include",
        });
        
        console.log("レスポンス受信:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("APIエラー:", errorText);
          throw new Error(errorText || "APIリクエストが失敗しました");
        }
        
        const data = await res.json();
        console.log("APIレスポンス:", data);
        return data;
      } catch (err) {
        console.error("チケット追加エラー:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("onSuccess呼び出し:", data);
      toast({
        title: "チケット追加",
        description: `${data.message || "10枚のチケットが追加されました"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error) => {
      console.error("onErrorが呼び出されました:", error);
      let errorMessage = "チケットの追加に失敗しました";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
  
  // 開発用：チケットを10枚追加する
  const handleAddTickets = () => {
    addTicketsMutation.mutate(10);
  };
  
  // 予約キャンセルのミューテーション
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await apiRequest("DELETE", `/api/bookings/${bookingId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "予約キャンセル",
        description: "授業の予約をキャンセルしました。チケットが1枚返却されました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowCancellationModal(false);
    },
    onError: (error) => {
      toast({
        title: "キャンセルエラー",
        description: error instanceof Error ? error.message : "予約のキャンセルに失敗しました",
        variant: "destructive",
      });
    },
  });

  // 予約キャンセルボタンのハンドラ
  const handleCancelClick = (booking: Booking & { studentName?: string }) => {
    setSelectedBooking(booking);
    setShowCancellationModal(true);
  };

  // キャンセルの確認
  const confirmCancellation = () => {
    if (selectedBooking) {
      cancelBookingMutation.mutate(selectedBooking.id);
    }
  };
  
  // 生徒の名前を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;
    const student = students.find(s => s.id === studentId);
    if (student) {
      return `${student.lastName} ${student.firstName}`;
    }
    return undefined;
  };
  
  // 今日の授業を取得する関数
  const getTodaysBookings = (): (Booking & { studentName?: string })[] => {
    if (!bookings) return [];
    
    // 実際の予約がない場合はテスト用データを返す（講師アカウントの場合のみ）
    if (bookings.length === 0 && user?.role === 'tutor') {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      
      // テスト用の授業データ
      return [
        {
          id: 1001,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 1,
          tutorShiftId: 1,
          date: today,
          timeSlot: "16:00-17:30",
          subject: "数学",
          status: "confirmed",
          studentName: "山田 太郎"
        },
        {
          id: 1002,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 2,
          tutorShiftId: 2,
          date: today,
          timeSlot: "18:00-19:30",
          subject: "英語",
          status: "confirmed",
          studentName: "佐藤 花子"
        }
      ];
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    return bookings
      .filter(booking => booking.date === today)
      .map(booking => ({
        ...booking,
        studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
      }));
  };
  
  // 生徒詳細を表示する関数
  const handleStudentDetailClick = (booking: Booking & { studentName?: string }) => {
    // テスト生徒データかどうかチェック (studentIdが1または2の場合はテストデータと判断)
    if (booking.studentId === 1 || booking.studentId === 2) {
      // テスト用データの場合
      setSelectedStudent({
        name: booking.studentName || "生徒名",
        time: booking.timeSlot,
        subject: booking.subject,
        grade: booking.studentId === 1 ? "中学3年生" : "高校2年生",
        address: "テスト用住所：東京都新宿区西新宿2-8-1"
      });
      setShowStudentDetailDialog(true);
      return;
    }
    
    // 実データの場合
    const student = students?.find(s => s.id === booking.studentId);
    if (student) {
      setSelectedStudent({
        name: `${student.lastName} ${student.firstName}`,
        time: booking.timeSlot,
        subject: booking.subject,
        grade: student.grade,
        address: "授業行き先住所はユーザープロフィールを参照してください"
      });
      setShowStudentDetailDialog(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-primary">家庭教師サービス</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">{user?.displayName || user?.username}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                logoutMutation.mutate();
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto flex flex-col">
        <div className="md:flex md:items-start md:justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">マイページ</h2>
            <p className="mt-1 text-sm text-gray-600">
              {user?.role === 'tutor' ? '講師ダッシュボード' : '予約状況とチケット残数の確認'}
            </p>
          </div>
          {user?.role !== 'tutor' && (
            <div className="mt-4 md:mt-0 bg-white shadow-sm rounded-lg p-3 border border-gray-200">
              <div className="flex items-center">
                <div className="mr-3 bg-green-50 p-2 rounded-full">
                  <Ticket className="text-green-600 h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">チケット残数</p>
                  <div className="flex items-center">
                    <p className="text-xl font-bold text-gray-900">{user?.ticketCount || 0}</p>
                    <Button 
                      variant="outline"
                      size="icon"
                      className="ml-2 h-6 w-6 rounded-full border-dashed"
                      onClick={handleAddTickets}
                      disabled={addTicketsMutation.isPending}
                    >
                      {addTicketsMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">※開発用：チケット追加</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar - 非スクロール領域 */}
        <Card className="p-3 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-medium text-gray-900">予約済み授業</h3>
          </div>
          
          <div className="calendar-section">
            {isLoadingBookings || isLoadingStudents ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <CalendarView 
                bookings={user?.role === 'tutor' 
                  ? [...(bookings || []), ...getTodaysBookings()].map(booking => ({
                      ...booking,
                      studentName: booking.studentName || (booking.studentId ? getStudentName(booking.studentId) : undefined)
                    }))
                  : (bookings || []).map(booking => ({
                      ...booking,
                      studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
                    }))
                } 
              />
            )}
          </div>
        </Card>
        
        {/* 講師向けダッシュボード要約 */}
        {user?.role === 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-medium text-gray-900">講師ダッシュボード</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">今日の授業</h4>
                <div className="flex items-center mb-1">
                  <p className="text-lg font-bold">{getTodaysBookings().length}</p>
                  <span className="ml-1 text-xs text-gray-500">件</span>
                </div>
                <p className="text-xs text-gray-500">※テスト用授業を追加しました</p>
              </div>
              
              {getTodaysBookings().length > 0 ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">授業予定</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getTodaysBookings().map((booking) => (
                      <Button
                        key={booking.id}
                        variant="outline"
                        className="text-left h-auto py-2 px-3 bg-white hover:bg-blue-50 border border-gray-200"
                        onClick={() => handleStudentDetailClick(booking)}
                      >
                        <div>
                          <div className="font-medium text-blue-700">{booking.studentName}</div>
                          <div className="text-xs text-gray-500">{booking.timeSlot} - {booking.subject}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">授業予定</h4>
                  <p className="text-sm text-gray-600">本日の授業予定はありません</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Spacer to ensure footer stays at bottom */}
        <div className="flex-grow min-h-[30px]"></div>
        
        {/* Action Buttons - Fixed to bottom */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-md py-3 pb-4 mt-4 z-10">
          <div className="max-w-7xl mx-auto px-4">
            {user?.role === 'tutor' ? (
              // 講師用メニュー
              <div>
                <h3 className="text-lg font-semibold mb-3 text-center md:text-left">講師メニュー</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => navigate("/tutor/profile")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <UserCog className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">プロフィール設定</span>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => navigate("/tutor/schedule")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">シフト管理</span>
                    </div>
                  </Button>
                </div>
              </div>
            ) : (
              // 保護者/生徒用メニュー
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {/* 保護者アカウントのみにチケット購入ボタンを表示 */}
                {user?.role !== 'student' && user?.role !== 'tutor' && (
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => navigate("/tickets")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-green-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <Ticket className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">チケット購入</span>
                    </div>
                  </Button>
                )}
                
                {/* 全てのユーザーに授業予約ボタンを表示 */}
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => navigate("/booking")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900">授業予約</span>
                  </div>
                </Button>
                
                {/* 保護者アカウントのみに設定ボタンを表示 */}
                {user?.role !== 'student' && user?.role !== 'tutor' && (
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => navigate("/settings")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <Settings className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">設定</span>
                    </div>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* キャンセル確認モーダル */}
      {selectedBooking && (
        <BookingCancellationModal 
          isOpen={showCancellationModal}
          booking={selectedBooking}
          onCancel={() => setShowCancellationModal(false)}
          onConfirm={confirmCancellation}
          isProcessing={cancelBookingMutation.isPending}
        />
      )}
      
      {/* 生徒詳細ダイアログ */}
      <Dialog open={showStudentDetailDialog} onOpenChange={setShowStudentDetailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>生徒情報</DialogTitle>
            <DialogDescription>授業の詳細情報</DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 p-2 rounded-md">
                  <p className="text-xs text-gray-500">生徒名</p>
                  <p className="font-medium">{selectedStudent.name}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-md">
                  <p className="text-xs text-gray-500">時間</p>
                  <p className="font-medium">{selectedStudent.time}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-md">
                  <p className="text-xs text-gray-500">学年</p>
                  <p className="font-medium">{selectedStudent.grade}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-2 rounded-md">
                <p className="text-xs text-gray-500">教科</p>
                <p className="font-medium">{selectedStudent.subject}</p>
              </div>
              
              <div className="bg-gray-50 p-2 rounded-md">
                <p className="text-xs text-gray-500">住所</p>
                <p className="text-sm">{selectedStudent.address}</p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <DialogClose asChild>
              <Button variant="outline">閉じる</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
