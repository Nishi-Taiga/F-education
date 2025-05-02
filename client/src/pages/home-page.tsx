import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { BookingCard } from "@/components/booking-card";
import { BookingCancellationModal } from "@/components/booking-cancellation-modal";
import { ReportViewModal } from "@/components/report-view-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket, CalendarCheck, Settings, Plus, UserCircle, ClipboardList, UserCog, Clock, BookOpen, Scroll, MapPin, GraduationCap, Copy, Check, FileText } from "lucide-react";
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

// 授業のステータスに応じたテキスト色を返すユーティリティ関数
const getBookingTextColor = (booking: Booking & { studentName?: string }, isSelected: boolean): string => {
  if (isSelected) {
    return 'text-white';
  }
  
  // 報告済みの授業は緑色
  if (booking.reportStatus === 'completed') {
    console.log(`授業 ${booking.date} ${booking.timeSlot} 報告済み: 緑色`);
    return 'text-green-700';
  }
  
  // 日本時間の今日の日付を取得
  const now = new Date();
  const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJapan = japanTime.toISOString().split('T')[0]; // YYYY-MM-DD形式
  
  // 授業の日付
  const lessonDate = booking.date;
  
  // 日付の比較
  if (lessonDate < todayJapan) {
    // 前日までの報告書未作成の授業は赤色
    console.log(`授業 ${booking.date} ${booking.timeSlot}: 過去の未報告授業（赤色）`);
    return 'text-red-700';
  } else if (lessonDate === todayJapan) {
    // 当日の授業は青色
    console.log(`授業 ${booking.date} ${booking.timeSlot}: 当日の授業（青色）`);
    return 'text-blue-700';
  } else {
    // 翌日以降の授業は青色（標準色）
    console.log(`授業 ${booking.date} ${booking.timeSlot}: 未来の授業（青色）`);
    return 'text-blue-700';
  }
};

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // キャンセル関連の状態
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { studentName?: string }) | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  
  // 講師の生徒詳細ダイアログ用の状態
  const [showStudentDetailDialog, setShowStudentDetailDialog] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    name: string;
    time: string;
    subject: string;
    grade: string;
    address: string;
  } | null>(null);
  
  // レポート作成ダイアログ用の状態
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReportBooking, setSelectedReportBooking] = useState<(Booking & { studentName?: string }) | null>(null);
  const [todaysBookingsForReport, setTodaysBookingsForReport] = useState<(Booking & { studentName?: string })[]>([]);
  const [reportContent, setReportContent] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false); // 強制的に再描画を行うためのフラグ
  
  // レポート閲覧ダイアログ用の状態
  const [showReportViewDialog, setShowReportViewDialog] = useState(false);
  const [viewReportBooking, setViewReportBooking] = useState<(Booking & { studentName?: string }) | null>(null);
  
  // アドレスをコピーする関数
  const copyAddressToClipboard = () => {
    if (selectedStudent?.address) {
      navigator.clipboard.writeText(selectedStudent.address)
        .then(() => {
          setAddressCopied(true);
          setTimeout(() => setAddressCopied(false), 2000);
          toast({
            title: "コピー完了",
            description: "住所をクリップボードにコピーしました",
          });
        })
        .catch((err) => {
          console.error("クリップボードへのコピーに失敗しました:", err);
          toast({
            title: "コピーエラー",
            description: "住所のコピーに失敗しました",
            variant: "destructive",
          });
        });
    }
  };

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });
  
  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });
  
  // 生徒ごとのチケット残数を取得
  const { data: studentTickets = [], isLoading: isLoadingStudentTickets } = useQuery<Array<{
    studentId: number;
    name: string;
    ticketCount: number;
  }>>({
    queryKey: ["/api/student-tickets"],
    enabled: !!user && user.role !== 'tutor',
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
      queryClient.invalidateQueries({ queryKey: ["/api/student-tickets"] });
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
  
  // 開発用：チケットをリセットするミューテーション
  const resetTicketsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tickets/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "チケットのリセットに失敗しました");
      }
      
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "チケットリセット",
        description: "すべてのチケットが0にリセットされました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student-tickets"] });
    },
    onError: (error) => {
      toast({
        title: "リセットエラー",
        description: error instanceof Error ? error.message : "チケットのリセットに失敗しました",
        variant: "destructive",
      });
    },
  });
  
  // 開発用：チケットを10枚追加する
  const handleAddTickets = () => {
    addTicketsMutation.mutate(10);
  };
  
  // 開発用：チケットをリセット（0に）する
  const handleResetTickets = () => {
    resetTicketsMutation.mutate();
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

  // レポート閲覧ボタンのハンドラ
  const handleViewReportClick = (booking: Booking & { studentName?: string }) => {
    setViewReportBooking(booking);
    setShowReportViewDialog(true);
  };

  // キャンセルの確認
  const confirmCancellation = () => {
    if (selectedBooking) {
      cancelBookingMutation.mutate(selectedBooking.id);
    }
  };
  
  // レポート保存のミューテーション
  // テスト用データを保持するステート
  const [testBookings, setTestBookings] = useState<(Booking & { studentName?: string })[]>([]);
  
  // コンポーネントマウント時にテストデータを初期化
  useEffect(() => {
    if (user?.role === 'tutor' && (!bookings || bookings.length === 0)) {
      const april29 = "2025-04-29";
      const april30 = "2025-04-30";
      
      // 初期テストデータ
      const initialTestData = [
        // 4/29の授業3件
        {
          id: 1001,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 1,
          tutorShiftId: 1,
          date: april29,
          timeSlot: "16:00-17:30",
          subject: "数学",
          status: "confirmed",
          reportStatus: null,
          reportContent: null,
          studentName: "山田 太郎"
        },
        {
          id: 1002,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 2,
          tutorShiftId: 2,
          date: april29,
          timeSlot: "18:00-19:30",
          subject: "英語",
          status: "confirmed",
          reportStatus: null,
          reportContent: null,
          studentName: "佐藤 花子"
        },
        {
          id: 1003,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 3,
          tutorShiftId: 3,
          date: april29,
          timeSlot: "20:00-21:30",
          subject: "理科",
          status: "confirmed",
          reportStatus: null,
          reportContent: null,
          studentName: "鈴木 一郎"
        },
        // 4/30の授業2件
        {
          id: 2001,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 1,
          tutorShiftId: 4,
          date: april30,
          timeSlot: "16:00-17:30",
          subject: "物理",
          status: "confirmed",
          reportStatus: null,
          reportContent: null,
          studentName: "山田 太郎"
        },
        {
          id: 2002,
          createdAt: new Date(),
          userId: user.id,
          tutorId: user.id,
          studentId: 2,
          tutorShiftId: 5,
          date: april30,
          timeSlot: "18:00-19:30",
          subject: "化学",
          status: "confirmed",
          reportStatus: null,
          reportContent: null,
          studentName: "佐藤 花子"
        }
      ];
      
      setTestBookings(initialTestData);
    }
  }, [user, bookings]);
  
  // レポート保存のミューテーション
  const saveReportMutation = useMutation({
    mutationFn: async ({ bookingId, content }: { bookingId: number, content: string }) => {
      // ダミーIDのチェック (デモデータ)
      if (bookingId === 1001 || bookingId === 1002 || bookingId === 1003 || 
          bookingId === 2001 || bookingId === 2002) {
        console.log("テスト用ダミーIDのためモックレスポンスを返します");
        // テスト用ダミーIDの場合は実際のAPIを呼び出さずに成功レスポンスを返す
        return {
          message: "レポートが正常に保存されました(テスト用)",
          booking: {
            id: bookingId,
            reportStatus: "completed",
            reportContent: content
          }
        };
      }
      
      // 実際のAPI呼び出し (ダミーID以外)
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/report`, { reportContent: content });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "レポート保存完了",
        description: "授業レポートが保存されました",
      });
      
      // テスト用ダミーデータの場合は手動で状態を更新
      if (selectedReportBooking && [1001, 1002, 1003, 2001, 2002].includes(selectedReportBooking.id)) {
        // テストデータを更新
        const updatedTestBookings = testBookings.map(booking => 
          booking.id === selectedReportBooking.id 
            ? { ...booking, reportStatus: "completed", reportContent: reportContent }
            : booking
        );
        setTestBookings(updatedTestBookings);
        
        // リロードしてカレンダー表示を更新
        setTimeout(() => {
          // 強制的に再描画
          setForceUpdate(prev => !prev);
        }, 100);
      }
      
      // データを再取得してUIを更新
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      
      // ダイアログを閉じる前に少し遅延を入れる
      setTimeout(() => {
        setShowReportDialog(false);
        setReportContent('');
        setReportSaving(false);
      }, 500);
    },
    onError: (error) => {
      toast({
        title: "レポート保存エラー",
        description: error instanceof Error ? error.message : "レポートの保存に失敗しました",
        variant: "destructive",
      });
    },
  });
  
  // 生徒の名前を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;
    const student = students.find(s => s.id === studentId);
    if (student) {
      return `${student.lastName} ${student.firstName}`;
    }
    return undefined;
  };
  
  // 日本時間で日付を取得するヘルパー関数
  const getJapanDate = (): string => {
    const now = new Date();
    // 日本時間に調整（UTC+9）
    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return japanTime.toISOString().split('T')[0]; // YYYY-MM-DD形式
  };
  
  // 指定日の授業を取得する関数
  const getBookingsByDate = (date: string): (Booking & { studentName?: string })[] => {
    if (!bookings) return [];
    
    // 実際の予約がない場合はテスト用データを返す（講師アカウントの場合のみ）
    if (bookings.length === 0 && user?.role === 'tutor') {
      // テスト用の日付
      const april29 = "2025-04-29";
      const april30 = "2025-04-30";
      const may1 = "2025-05-01";
      
      // テストデータから該当する日付のデータをフィルタリング
      return testBookings
        .filter(booking => booking.date === date)
        .map(booking => ({
          ...booking,
          studentName: booking.studentName || getStudentName(booking.studentId)
        }));
    }
    
    // 実際のデータをフィルタリング
    return bookings
      .filter(booking => booking.date === date)
      .map(booking => ({
        ...booking,
        studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
      }));
  };
  
  // 今日の授業を取得する関数
  const getTodaysBookings = (): (Booking & { studentName?: string })[] => {
    // テスト用に4/30を固定で「今日」として設定
    const today = "2025-04-30"; // 本番では getJapanDate() を使用
    return getBookingsByDate(today);
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
  
  // レポート作成対象の授業を取得する関数
  const getUnreportedBookings = (): (Booking & { studentName?: string })[] => {
    if (!bookings) return [];
    
    // 現在の日時を取得（日本時間）
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = getJapanDate();
    
    // テスト用データを使用（講師アカウントの場合のみ）
    if (bookings.length === 0 && user?.role === 'tutor') {
      // テストデータからレポート未作成のデータをフィルタリング
      return testBookings
        .filter(booking => booking.reportStatus !== "completed")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(booking => ({
          ...booking,
          studentName: booking.studentName || getStudentName(booking.studentId)
        }));
    }
    
    // 未報告の授業をすべて取得（過去の未報告授業も含む）
    return bookings
      // レポートが未作成の授業だけをフィルタリング
      .filter(booking => booking.reportStatus !== "completed")
      // 日付ごとに並べ替え（降順：新しい日付が上）
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      // 生徒名を追加
      .map(booking => ({
        ...booking,
        studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
      }));
  };
  
  // レポート作成ダイアログを開く関数
  const handleOpenReportDialog = (booking?: Booking & { studentName?: string }) => {
    // 未報告の授業一覧を取得し、状態を設定
    const unreportedBookings = getUnreportedBookings();
    setTodaysBookingsForReport(unreportedBookings);
    
    // 選択された授業を設定（指定がない場合は最初の授業か空に）
    setSelectedReportBooking(booking || (unreportedBookings.length > 0 ? unreportedBookings[0] : null));
    setShowReportDialog(true);
  };
  
  // レポート関連の関数はすでに定義済み

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">F education</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
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
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.role === 'tutor' ? 'ダッシュボード' : '予約システム'}
            </h2>
          </div>
          {user?.role !== 'tutor' && (
            <div className="mt-4 md:mt-0 bg-white shadow-sm rounded-lg p-3 border border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-dashed"
                    onClick={handleAddTickets}
                    disabled={addTicketsMutation.isPending}
                  >
                    {addTicketsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    <span className="text-xs">追加</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-dashed text-red-500 border-red-200 hover:bg-red-50"
                    onClick={handleResetTickets}
                    disabled={resetTicketsMutation.isPending}
                  >
                    {resetTicketsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <span className="text-xs">リセット</span>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 生徒ごとのチケット残数 */}
              {studentTickets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center mb-2">
                    <div className="mr-2 bg-green-50 p-1.5 rounded-full">
                      <Ticket className="text-green-600 h-4 w-4" />
                    </div>
                    <p className="text-base font-medium text-gray-900">チケット残数</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {studentTickets.map(ticket => (
                      <div key={ticket.studentId} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span className="text-sm font-medium">{ticket.name}</span>
                        <span className="text-base font-bold">{ticket.ticketCount}枚</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2">※開発用：チケット追加・リセット</p>
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
                key={forceUpdate ? "updated" : "initial"} // forceUpdateによる強制再描画のためのkey
                showLegend={user?.role === 'tutor'} // 講師用のみ凡例を表示
                interactive={user?.role === 'tutor'} // 講師の場合のみインタラクティブに
                bookings={user?.role === 'tutor'
                  ? testBookings.length > 0 ? testBookings : [
                      // 4/29の予定
                      {
                        id: 1001,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 1,
                        tutorShiftId: 1,
                        date: "2025-04-29",
                        timeSlot: "16:00-17:30",
                        subject: "数学",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "山田 太郎"
                      },
                      {
                        id: 1002,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 2,
                        tutorShiftId: 2,
                        date: "2025-04-29",
                        timeSlot: "18:00-19:30",
                        subject: "英語",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "佐藤 花子"
                      },
                      {
                        id: 1003,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 3,
                        tutorShiftId: 3,
                        date: "2025-04-29",
                        timeSlot: "20:00-21:30",
                        subject: "理科",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "鈴木 一郎"
                      },
                      // 4/30の予定
                      {
                        id: 2001,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 1,
                        tutorShiftId: 4,
                        date: "2025-04-30",
                        timeSlot: "16:00-17:30",
                        subject: "物理",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "山田 太郎"
                      },
                      {
                        id: 2002,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 2,
                        tutorShiftId: 5,
                        date: "2025-04-30",
                        timeSlot: "18:00-19:30",
                        subject: "化学",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "佐藤 花子"
                      },
                      // 5/1の予定
                      {
                        id: 3001,
                        createdAt: new Date(),
                        userId: user.id,
                        tutorId: user.id,
                        studentId: 3,
                        tutorShiftId: 6,
                        date: "2025-05-01",
                        timeSlot: "16:00-17:30",
                        subject: "社会",
                        status: "confirmed",
                        reportStatus: null,
                        reportContent: null,
                        studentName: "鈴木 一郎"
                      }
                    ]
                  : (bookings || []).map(booking => ({
                      ...booking,
                      studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
                    }))
                } 
              />
            )}
          </div>
        </Card>
        
        {/* 保護者/生徒向け予約リスト */}
        {user?.role !== 'tutor' && (
          <Card className="p-3 mb-4" id="booking-list">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-medium text-gray-900">予約一覧</h3>
            </div>
            
            <div className="space-y-2">
              {isLoadingBookings ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : bookings && bookings.length > 0 ? (
                <div className="space-y-2">
                  {bookings
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(booking => ({
                      ...booking,
                      studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
                    }))
                    .map(booking => (
                      <BookingCard 
                        key={booking.id} 
                        booking={booking}
                        onCancelClick={handleCancelClick}
                        onViewReportClick={booking.reportStatus === 'completed' ? handleViewReportClick : undefined}
                      />
                    ))
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {/* テスト用のデータ */}
                  <BookingCard 
                    key="test-past-with-report" 
                    booking={{
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
                    }}
                    onViewReportClick={handleViewReportClick}
                  />
                  <BookingCard 
                    key="test-today"
                    booking={{
                      id: 9002,
                      createdAt: new Date(),
                      userId: user ? user.id : 0,
                      tutorId: 1,
                      studentId: 4,
                      tutorShiftId: 2,
                      date: "2025-04-30",
                      timeSlot: "18:00-19:30",
                      subject: "英語",
                      status: "confirmed",
                      reportStatus: null,
                      reportContent: null,
                      studentName: "テスト 太郎"
                    }}
                    onCancelClick={handleCancelClick}
                  />
                </div>
              )}
            </div>
          </Card>
        )}
        
        {/* 講師向けダッシュボード要約 */}
        {user?.role === 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-medium text-gray-900">F education ダッシュボード</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="grid grid-cols-4 md:grid-cols-12 gap-4">
                <div className="col-span-4 md:col-span-3 bg-gray-50 p-4 rounded-lg flex flex-col justify-center">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">今日の授業</h4>
                  <div className="flex items-center">
                    <p className="text-lg font-bold">{getTodaysBookings().length}</p>
                    <span className="ml-1 text-xs text-gray-500">件</span>
                  </div>
                </div>
                
                <div className="col-span-4 md:col-span-9 bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">授業予定</h4>
                  {getTodaysBookings().length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {getTodaysBookings().map((booking) => (
                        <Button
                          key={booking.id}
                          variant="outline"
                          className="text-left h-auto py-2 px-3 bg-white hover:bg-blue-50 border border-gray-200"
                          onClick={() => handleStudentDetailClick(booking)}
                        >
                          <div className="w-full">
                            <div className={`font-medium ${getBookingTextColor(booking, false)}`}>{booking.studentName}</div>
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-gray-500">{booking.timeSlot} - {booking.subject}</div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-full hover:bg-blue-100"
                                onClick={(e) => {
                                  e.stopPropagation(); // 親のクリックイベントを阻止
                                  handleOpenReportDialog(booking);
                                }}
                              >
                                <FileText className="h-3 w-3 text-blue-600" />
                              </Button>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">本日の授業予定はありません</p>
                  )}
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
                <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-3">
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
                  
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => {
                      // 未報告の授業があればレポートダイアログを開く
                      const unreportedBookings = getUnreportedBookings();
                      if (unreportedBookings.length > 0) {
                        handleOpenReportDialog();
                      } else {
                        // 未報告の授業がない場合でもダイアログを開くがリストは空
                        handleOpenReportDialog();
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900">レポート作成</span>
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
                
                {/* レポート確認ボタン */}
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => navigate("/reports")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900">レポート確認</span>
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
      
      {/* レポート閲覧モーダル */}
      {viewReportBooking && (
        <ReportViewModal
          isOpen={showReportViewDialog}
          booking={viewReportBooking}
          onClose={() => setShowReportViewDialog(false)}
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
                <div className="flex justify-between items-start">
                  <p className="text-xs text-gray-500">住所</p>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-gray-200 -mt-1 -mr-1"
                    onClick={copyAddressToClipboard}
                    disabled={addressCopied}
                  >
                    {addressCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-500" />
                    )}
                  </Button>
                </div>
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
      
      {/* レポート作成ダイアログ */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>授業レポート作成</DialogTitle>
            <DialogDescription>授業内容を記録してください（未報告の授業を選択）</DialogDescription>
          </DialogHeader>
          
          {selectedReportBooking && (
            <div className="space-y-4 py-2">
              {/* 生徒選択セクション */}
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-blue-800">レポート対象の授業を選択</h3>
                </div>
                
                <div className="space-y-2">
                  {todaysBookingsForReport.length > 0 ? (
                    <div className="bg-white rounded-md border border-gray-200 max-h-[250px] overflow-y-auto">
                      <div className="p-1">
                        {todaysBookingsForReport.map((booking) => (
                          <Button
                            key={booking.id}
                            variant={selectedReportBooking.id === booking.id ? "default" : "outline"}
                            className={`w-full justify-start text-left h-auto py-2 px-3 mb-1 ${selectedReportBooking.id === booking.id ? 'bg-blue-600' : 'bg-white hover:bg-blue-50'} border border-gray-200 overflow-hidden`}
                            onClick={() => setSelectedReportBooking(booking)}
                          >
                            <div className="flex items-center w-full">
                              <div className="mr-2">
                                {selectedReportBooking.id === booking.id ? (
                                  <Check className="h-4 w-4 text-white" />
                                ) : (
                                  <div className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className={`font-medium ${getBookingTextColor(booking, selectedReportBooking?.id === booking.id)}`}>
                                  {booking.studentName || "生徒不明"}
                                </div>
                                <div className={`text-xs ${selectedReportBooking?.id === booking.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {booking.date} {booking.timeSlot} - {booking.subject}
                                </div>
                              </div>
                              <div className="ml-2">
                                {booking.reportStatus === 'completed' ? (
                                  <div className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                    報告済み
                                  </div>
                                ) : (
                                  (() => {
                                    // 日本時間の今日の日付を取得
                                    const now = new Date();
                                    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                                    const todayJapan = japanTime.toISOString().split('T')[0]; // YYYY-MM-DD形式
                                    
                                    // 授業の日付
                                    const lessonDate = booking.date;
                                    
                                    // 日付の比較
                                    if (lessonDate < todayJapan) {
                                      // 前日までの報告書未作成の授業は赤色
                                      return (
                                        <div className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">
                                          未報告
                                        </div>
                                      );
                                    } else if (lessonDate === todayJapan) {
                                      // 当日の授業は青色
                                      return (
                                        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                          今日
                                        </div>
                                      );
                                    } else {
                                      // 翌日以降の授業
                                      return (
                                        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                          予定
                                        </div>
                                      );
                                    }
                                  })()
                                )}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">レポート対象の授業はありません</p>
                  )}
                </div>
              </div>
              
              {/* 授業情報 */}
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-800">授業情報</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">生徒名</p>
                    <p className="font-medium">{selectedReportBooking?.studentName || "生徒不明"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">時間帯</p>
                    <p className="font-medium">{selectedReportBooking?.timeSlot}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">日付</p>
                    <p className="font-medium">{selectedReportBooking?.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">教科</p>
                    <p className="font-medium">{selectedReportBooking?.subject}</p>
                  </div>
                </div>
              </div>
              
              {/* 報告書フォーム */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="lesson-content" className="block text-sm font-medium">
                    レポート内容
                  </label>
                  <div className="text-xs text-gray-500 mb-2">
                    以下の項目を含めて記入してください：
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>単元</li>
                      <li>伝言事項</li>
                      <li>来週までの目標(課題)</li>
                    </ul>
                  </div>
                  <textarea
                    id="lesson-content"
                    rows={6}
                    className="block w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"
                    placeholder="単元、伝言事項、来週までの目標(課題)などを記入してください"
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <DialogClose asChild>
                  <Button variant="outline">キャンセル</Button>
                </DialogClose>
                <Button 
                  type="button"
                  onClick={() => {
                    if (!reportContent.trim()) {
                      toast({
                        title: "入力エラー",
                        description: "レポート内容を入力してください",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (selectedReportBooking) {
                      setReportSaving(true);
                      saveReportMutation.mutate({
                        bookingId: selectedReportBooking.id,
                        content: reportContent
                      });
                    }
                  }}
                  disabled={saveReportMutation.isPending || reportSaving || !reportContent.trim()}
                >
                  {saveReportMutation.isPending || reportSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存する"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
