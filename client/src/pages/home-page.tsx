import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { BookingCard } from "@/components/booking-card";
import { BookingCancellationModal } from "@/components/booking-cancellation-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket, CalendarCheck, Settings, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Booking, Student } from "@shared/schema";

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // キャンセル関連の状態
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { studentName?: string }) | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);

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
                <div className="mr-3 bg-primary bg-opacity-10 p-2 rounded-full">
                  <Ticket className="text-primary h-5 w-5" />
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

        {/* Calendar - 共通表示 */}
        <Card className="p-3 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-medium text-gray-900">予約済み授業</h3>
          </div>
          
          <div className="scrollable-container">
            {isLoadingBookings || isLoadingStudents ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <CalendarView 
                bookings={bookings?.map(booking => ({
                  ...booking,
                  studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
                })) || []} 
              />
            )}
            
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-2">授業予定</div>
              <div className="space-y-2 card-container">
                {isLoadingBookings || isLoadingStudents ? (
                  <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : bookings && bookings.length > 0 ? (
                  bookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={{
                        ...booking,
                        studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
                      }}
                      onCancelClick={user?.role !== 'tutor' ? handleCancelClick : undefined}
                    />
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    予約済みの授業はありません
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
        
        {/* 講師向けダッシュボード要約 */}
        {user?.role === 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-medium text-gray-900">講師ダッシュボード</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 mb-1">今日の授業</h4>
                <p className="text-lg font-bold">0</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 mb-1">今週の授業</h4>
                <p className="text-lg font-bold">0</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 mb-1">合計シフト</h4>
                <p className="text-lg font-bold">0</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">講師機能を使用するには、各ページでデータを設定してください</p>
                <div className="flex space-x-4 mt-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/tutor/profile")}>
                    プロフィール設定
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/tutor/schedule")}>
                    シフト登録
                  </Button>
                </div>
              </div>
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
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <svg className="h-4 w-4 md:h-5 md:w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
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
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">シフト管理</span>
                    </div>
                  </Button>
                </div>
              </div>
            ) : (
              // 生徒用メニュー
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => navigate("/tickets")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <Ticket className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900">チケット購入</span>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => navigate("/booking")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-2">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">授業予約</span>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => navigate("/settings")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-2">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">設定</span>
                  </div>
                </Button>
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
    </div>
  );
}
