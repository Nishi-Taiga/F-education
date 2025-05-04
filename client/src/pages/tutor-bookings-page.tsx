import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookingDetailModal } from "@/components/booking-detail-modal";
import { CalendarView } from "@/components/calendar-view";
import { Calendar } from "@/components/ui/calendar";
import { ReportViewModal } from "@/components/report-view-modal";
import { ReportEditModal } from "@/components/report-edit-modal";

// 予約情報の型定義
type Booking = {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string;
  createdAt: string;
};

export default function TutorBookingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking & { studentName?: string }>();
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [showReportViewModal, setShowReportViewModal] = useState(false);
  const [showReportEditModal, setShowReportEditModal] = useState(false);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  
  // 講師プロフィールの取得
  const { data: tutorProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/tutor/profile"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor profile");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor profile:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!user && user.role === "tutor"
  });
  
  // 予約情報の取得
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["/api/tutor/bookings"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/bookings");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor bookings");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor bookings:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!tutorProfile
  });
  
  // 生徒情報の取得
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/students");
        if (!response.ok) {
          throw new Error("Failed to fetch students");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching students:", error);
        throw error;
      }
    },
    retry: false
  });
  
  // 講師でない場合はリダイレクト
  useEffect(() => {
    if (user && user.role !== "tutor") {
      navigate("/");
    }
  }, [user, navigate]);
  
  // 今日以降の予約
  const upcomingBookings = bookings?.filter((booking: Booking) => {
    const bookingDate = parseISO(booking.date);
    return !isBefore(bookingDate, new Date()) || isToday(bookingDate);
  }) || [];
  
  // 過去の予約
  const pastBookings = bookings?.filter((booking: Booking) => {
    const bookingDate = parseISO(booking.date);
    return isBefore(bookingDate, new Date()) && !isToday(bookingDate);
  }) || [];
  
  // 選択した日付の予約
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const bookingsOnSelectedDate = bookings?.filter((booking: Booking) => 
    booking.date === selectedDateStr
  ) || [];
  
  // カレンダーに予約のある日付をハイライト表示するための関数
  const getBookingDates = () => {
    if (!bookings) return [];
    
    // 予約のある日付のみを抽出
    const dates = bookings.map((booking: Booking) => booking.date);
    // 重複を除去（配列を使用）
    const uniqueDates = Array.from(new Set(dates));
    // Date型に変換
    return uniqueDates.map(date => parseISO(date as string));
  };
  
  const bookingDates = getBookingDates();
  
  // 生徒IDから生徒名を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;
    const student = students.find((s: any) => s.id === studentId);
    if (!student) return undefined;
    return `${student.lastName} ${student.firstName}`;
  };
  
  // 予約カードがクリックされたときの処理
  const handleBookingClick = async (booking: Booking & { studentName?: string }) => {
    try {
      // 予約の詳細情報を取得 (生徒情報や前回のレポートも含む)
      const response = await fetch(`/api/bookings/${booking.id}`);
      if (response.ok) {
        const bookingDetails = await response.json();
        
        // デバッグ出力を追加
        console.log("詳細情報取得成功:", bookingDetails);
        
        // 生徒情報があればログ出力
        if (bookingDetails.studentDetails) {
          console.log("生徒詳細情報:", bookingDetails.studentDetails);
        }
        
        // 前回のレポート情報があればログ出力
        if (bookingDetails.previousReport) {
          console.log("前回のレポート:", bookingDetails.previousReport);
        }
        
        // 編集ボタン表示のためにselectedBookingに完全な情報を設定
        setSelectedBooking({
          ...bookingDetails,
          // 既存のフィールドを保持しつつ、必要なフィールドを確実に設定
          studentName: bookingDetails.studentName || getStudentName(bookingDetails.studentId),
          id: bookingDetails.id,
          reportStatus: bookingDetails.reportStatus || 'pending',
          reportContent: bookingDetails.reportContent || ''
        });
        
        // 生徒詳細情報を設定
        setStudentDetails(bookingDetails.studentDetails || null);
      } else {
        // 詳細が取得できない場合は、元の予約情報を使用
        setSelectedBooking(booking);
        
        // 生徒情報を個別に取得
        if (booking.studentId) {
          try {
            const studentResponse = await fetch(`/api/students/${booking.studentId}`);
            if (studentResponse.ok) {
              const studentDetails = await studentResponse.json();
              setStudentDetails(studentDetails);
            } else {
              setStudentDetails(null);
            }
          } catch (error) {
            console.error("生徒情報の取得に失敗しました", error);
            setStudentDetails(null);
          }
        } else {
          setStudentDetails(null);
        }
      }
    } catch (error) {
      console.error("予約詳細の取得に失敗しました", error);
      setSelectedBooking(booking);
      setStudentDetails(null);
    }
    
    // モーダルを表示
    setShowBookingDetailModal(true);
  };
  
  // 読み込み中の表示
  if (isLoadingProfile || isLoadingBookings || isLoadingStudents) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  // 生徒名を含む予約データを作成
  const bookingsWithStudentNames = bookings?.map((booking: Booking) => ({
    ...booking,
    studentName: getStudentName(booking.studentId)
  })) || [];
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">予約管理</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {/* カレンダービュー（タブレット・デスクトップ・モバイル対応） */}
        <Card>
          <CardHeader>
            <CardTitle>予約カレンダー</CardTitle>
            <CardDescription>
              予約をクリックすると詳細が表示されます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarView 
              key={`calendar-bookings-${bookingsWithStudentNames.length}`} // 強制再描画のためのkey
              showLegend={true} // 講師用は凡例を表示
              interactive={true} // インタラクティブにする
              onBookingClick={handleBookingClick} // 予約クリック時のハンドラを追加
              bookings={bookingsWithStudentNames}
            />
          </CardContent>
        </Card>
        
        {/* 授業予約リスト */}
        <Card>
          <CardHeader>
            <CardTitle>授業予約一覧</CardTitle>
            <CardDescription>
              授業の予約状況を確認できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming">
                  今後の予約 ({upcomingBookings.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  過去の予約 ({pastBookings.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upcoming">
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    現在予約はありません
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {upcomingBookings.map((booking: Booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="past">
                {pastBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    過去の予約はありません
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {pastBookings.map((booking: Booking) => (
                      <BookingCard key={booking.id} booking={booking} isPast />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* 予約詳細モーダル */}
      {selectedBooking && (
        <BookingDetailModal
          isOpen={showBookingDetailModal}
          booking={{
            ...selectedBooking,
            studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId)
          }}
          studentDetails={studentDetails}
          onClose={() => setShowBookingDetailModal(false)}
          onViewReport={() => {
            setShowBookingDetailModal(false);
            setShowReportViewModal(true);
          }}
          // 必ず講師アカウントではレポート編集を有効にする
          onEditReport={selectedBooking.reportStatus === 'completed' ? () => {
            console.log("レポート編集モーダルを開きます", selectedBooking);
            setShowBookingDetailModal(false);
            setShowReportEditModal(true);
          } : undefined}
        />
      )}
      
      {/* レポート表示モーダル */}
      {selectedBooking && (
        <ReportViewModal
          isOpen={showReportViewModal}
          booking={{
            ...selectedBooking,
            studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
          }}
          onClose={() => setShowReportViewModal(false)}
        />
      )}
      
      {/* レポート編集モーダル */}
      {selectedBooking && (
        <ReportEditModal
          isOpen={showReportEditModal}
          booking={{
            ...selectedBooking,
            studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
          }}
          onClose={() => setShowReportEditModal(false)}
          onSuccess={() => {
            // レポート編集が成功したら予約情報を再取得
            // 自動的にinvalidateQueriesで再取得されるので、ここでは何もしない
          }}
        />
      )}
    </div>
  );
}

// 予約カードコンポーネント
function BookingCard({ booking, isPast = false }: { booking: Booking; isPast?: boolean }) {
  const bookingDate = parseISO(booking.date);
  const formattedDate = format(bookingDate, "yyyy年M月d日(E)", { locale: ja });
  
  return (
    <div className={`p-4 border rounded-lg ${isPast ? "bg-muted/50" : ""}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg">{formattedDate}</h3>
          <p className="text-md">{booking.timeSlot}</p>
        </div>
        <Badge variant={booking.status === "cancelled" ? "destructive" : "default"}>
          {booking.status === "cancelled" ? "キャンセル" : "確定"}
        </Badge>
      </div>
      
      <Separator className="my-3" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">科目</p>
          <p>{booking.subject || "未設定"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">生徒ID</p>
          <p>{booking.studentId || "未設定"}</p>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-muted-foreground">
        予約ID: {booking.id} / 作成日時: {format(parseISO(booking.createdAt), "yyyy/MM/dd HH:mm")}
      </div>
    </div>
  );
}