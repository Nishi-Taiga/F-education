import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookingDetailModal } from "@/components/booking-detail-modal";
import { CalendarView } from "@/components/calendar-view";
import { Calendar } from "@/components/ui/calendar";
import { ReportViewModal } from "@/components/report-view-modal";
import { ReportEditModal } from "@/components/report-edit-modal";

// 予約情報の型定義 - レポート関連のフィールドを追加
// 基本的な予約型
type Booking = {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  tutorShiftId?: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string;
  studentName?: string;
  // レポート編集用の一時的なフラグ（非公式プロパティ）
  openEditAfterClose?: boolean;
};

// カレンダーコンポーネント用の拡張された予約型
type ExtendedBooking = Omit<Booking, 'createdAt'> & {
  createdAt: string | Date;
  studentName?: string;
};

export default function TutorBookingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<ExtendedBooking | undefined>();
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [showReportViewModal, setShowReportViewModal] = useState(false);
  const [showReportEditModal, setShowReportEditModal] = useState(false);
  const [reportEditBooking, setReportEditBooking] = useState<ExtendedBooking | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  
  // 予約カードコンポーネント - コンポーネントを内部で定義し直して必要な状態と関数にアクセスできるようにする
  function BookingCard({ booking, isPast = false }: { booking: Booking; isPast?: boolean }) {
    const bookingDate = parseISO(booking.date);
    const formattedDate = format(bookingDate, "yyyy年M月d日(E)", { locale: ja });
    
    // レポート状態を確認（'completed'または'completed:'で始まる場合はレポート作成済み）
    const hasReport = booking.reportStatus === 'completed' || 
      (booking.reportStatus && booking.reportStatus.startsWith('completed:'));
    
    return (
      <div 
        className={`p-4 border rounded-lg ${isPast ? "bg-muted/50" : ""} hover:bg-gray-50 cursor-pointer`}
        onClick={async () => {
          // レポート作成済みかどうかチェック
          if (hasReport && booking.reportContent) {
            console.log("レポート作成済みの予約がクリックされました - 詳細取得してからレポート表示");
            
            try {
              // 予約の詳細情報を取得（生徒情報や前回のレポートも含む）
              const response = await fetch(`/api/bookings/${booking.id}`);
              if (response.ok) {
                const bookingDetails = await response.json();
                
                // 詳細データを設定
                const enhancedBookingDetails = {
                  ...bookingDetails,
                  studentName: bookingDetails.studentName || getStudentName(bookingDetails.studentId),
                  tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
                };
                
                // 選択された予約とレポート編集用データを設定
                setSelectedBooking(enhancedBookingDetails);
                setReportEditBooking(enhancedBookingDetails);
                
                // 詳細情報を表示
                console.log("詳細データ取得成功:", enhancedBookingDetails);
                
                // 生徒詳細情報があれば設定
                if (bookingDetails.studentDetails) {
                  setStudentDetails(bookingDetails.studentDetails);
                }
                
                // レポート詳細モーダルを表示
                setShowReportViewModal(true);
              } else {
                // 詳細が取得できない場合は、基本情報のみで表示
                console.log("詳細情報取得失敗 - 基本情報のみ表示");
                setSelectedBooking(booking);
                setReportEditBooking({...booking});
                setShowReportViewModal(true);
              }
            } catch (error) {
              console.error("予約詳細取得エラー:", error);
              // エラー時も基本情報で表示
              setSelectedBooking(booking);
              setReportEditBooking({...booking});
              setShowReportViewModal(true);
            }
          } else {
            // 通常の処理
            handleBookingClick(booking);
          }
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-lg">{formattedDate}</h3>
            <p className="text-md">{booking.timeSlot}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={booking.status === "cancelled" ? "destructive" : "default"}>
              {booking.status === "cancelled" ? "キャンセル" : "確定"}
            </Badge>
            
            {/* レポート状態バッジを追加 */}
            {hasReport ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                レポート済
              </Badge>
            ) : isPast ? (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                レポート未作成
              </Badge>
            ) : null}
          </div>
        </div>
        
        <Separator className="my-3" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">科目</p>
            <p>{booking.subject || "未設定"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">生徒</p>
            <p>{getStudentName(booking.studentId) || "未設定"}</p>
          </div>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            予約ID: {booking.id}
          </div>
          
          {/* 過去の授業の場合はレポート編集/作成ボタンを表示 */}
          {isPast && (
            <Button
              size="sm"
              variant={hasReport ? "outline" : "default"}
              className={hasReport ? "border-amber-500 text-amber-600 hover:bg-amber-50" : "bg-blue-600 hover:bg-blue-700 text-white"}
              onClick={(e) => {
                // イベントの伝播を止めてカード自体のクリックイベントが発火しないようにする
                e.stopPropagation();
                
                console.log("レポート作成/編集ボタンがクリックされました", booking);
                
                // レポート編集用のデータを設定
                setReportEditBooking({
                  ...booking,
                  id: booking.id,
                  userId: booking.userId,
                  tutorId: booking.tutorId,
                  studentId: booking.studentId,
                  tutorShiftId: booking.tutorShiftId || 0,
                  date: booking.date,
                  timeSlot: booking.timeSlot,
                  subject: booking.subject || "",
                  status: booking.status || null,
                  createdAt: booking.createdAt,
                  reportStatus: booking.reportStatus || null,
                  reportContent: booking.reportContent || '',
                  studentName: getStudentName(booking.studentId)
                });
                
                // 編集モーダルを表示
                setTimeout(() => {
                  setShowReportEditModal(true);
                }, 50);
              }}
            >
              {hasReport ? "レポート編集" : "レポート作成"}
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // こちらの関数は使用していないので削除（handleOpenReportEditModalを使用）
  
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
  
  // レポート編集モーダルを表示するハンドラー - 完全に再実装（最終解決策）
  const handleOpenReportEditModal = () => {
    console.log("レポート編集モーダルを開きます（グローバル関数）", selectedBooking);
    
    if (!selectedBooking) {
      console.error("レポート編集対象の予約が選択されていません");
      return;
    }
    
    // 編集用の予約データを個別に保持する
    setReportEditBooking({
      ...selectedBooking,
      id: selectedBooking.id,
      userId: selectedBooking.userId,
      tutorId: selectedBooking.tutorId,
      studentId: selectedBooking.studentId,
      tutorShiftId: selectedBooking.tutorShiftId || 0,
      date: selectedBooking.date,
      timeSlot: selectedBooking.timeSlot,
      subject: selectedBooking.subject || "",
      status: selectedBooking.status || null,
      createdAt: selectedBooking.createdAt,
      reportStatus: selectedBooking.reportStatus || null,
      reportContent: selectedBooking.reportContent || ''
    });
    
    // 詳細モーダルを閉じる
    setShowBookingDetailModal(false);
    
    // 同期的に実行しても非同期的に実行されるため、レンダリングサイクルの後に実行されるようにする
    setTimeout(() => {
      // レポート編集モーダルを表示
      setShowReportEditModal(true);
      console.log("編集モーダルを表示しました - データ:", reportEditBooking);
    }, 50); // タイミングを短くする
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
  const handleBookingClick = async (booking: ExtendedBooking) => {
    try {
      console.log("予約クリック:", booking);
      
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
        // 必要なフィールドが全て含まれるように明示的に指定
        const enhancedBookingDetails = {
          ...bookingDetails,
          id: bookingDetails.id,
          userId: bookingDetails.userId,
          tutorId: bookingDetails.tutorId,
          studentId: bookingDetails.studentId,
          tutorShiftId: bookingDetails.tutorShiftId || 0,
          date: bookingDetails.date,
          timeSlot: bookingDetails.timeSlot,
          subject: bookingDetails.subject,
          status: bookingDetails.status || null,
          createdAt: bookingDetails.createdAt,
          reportStatus: bookingDetails.reportStatus || null,
          reportContent: bookingDetails.reportContent || '',
          studentName: bookingDetails.studentName || getStudentName(bookingDetails.studentId)
        };
        
        // 完全な予約情報をコンソールに出力（デバッグ用）
        console.log("完全な予約情報:", enhancedBookingDetails);
        
        // 選択された予約を設定
        setSelectedBooking(enhancedBookingDetails);
        
        // レポート編集用の予約データも設定（カレンダービューからの直接編集のため）
        setReportEditBooking({
          ...enhancedBookingDetails
        });
        
        // 生徒詳細情報を設定
        setStudentDetails(bookingDetails.studentDetails || null);
      } else {
        // 詳細が取得できない場合は、元の予約情報を使用
        setSelectedBooking(booking);
        
        // レポート編集用のデータも同様に設定
        // createdAtが日付型の場合は文字列に変換する
        const reportEditData: ExtendedBooking = {
          ...booking,
          reportStatus: booking.reportStatus || null,
          reportContent: booking.reportContent || '',
          tutorShiftId: booking.tutorShiftId || 0,
          status: booking.status || null,
          // 型の不一致を避けるため明示的に文字列型を使用
          createdAt: typeof booking.createdAt === 'object' 
            ? booking.createdAt.toISOString() 
            : booking.createdAt
        };
        setReportEditBooking(reportEditData);
        
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
      
      // エラー時もレポート編集用データを設定しておく
      // createdAtが日付型の場合は文字列に変換する
      const errorReportEditData: ExtendedBooking = {
        ...booking,
        reportStatus: booking.reportStatus || null,
        reportContent: booking.reportContent || '',
        tutorShiftId: booking.tutorShiftId || 0,
        status: booking.status || null,
        // 型の不一致を避けるため明示的に文字列型を使用
        createdAt: typeof booking.createdAt === 'object' 
          ? booking.createdAt.toISOString() 
          : booking.createdAt
      };
      setReportEditBooking(errorReportEditData);
    }
    
    // 予約詳細情報の基本的な処理（共通）
    
    // レポート作成済みかどうかチェック - selectedBookingが更新されたあとに実行
    const isCompletedWithReport = 
      booking.reportStatus === 'completed' || 
      (booking.reportStatus && booking.reportStatus.startsWith('completed:'));
      
    // レポートが作成済み && 内容があれば直接レポート詳細モーダルを表示
    if (isCompletedWithReport && booking.reportContent) {
      console.log("レポート作成済みのため、直接レポート詳細モーダルを表示します");
      setShowReportViewModal(true);
    } else {
      // 通常の予約詳細モーダルを表示
      setShowBookingDetailModal(true);
    }
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
      
      {/* 緊急デバッグ用テストボタン - さらに目立つようにするバージョン */}
      <div className="mb-8 flex justify-center items-center">
        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg animate-pulse shadow-xl">
          <Button 
            onClick={() => {
              console.log("新レポート編集テストボタンがクリックされました");
              
              // テスト用のデータ
              const testBooking: ExtendedBooking = {
                id: 999,
                userId: 3,
                tutorId: 2,
                studentId: 4,
                tutorShiftId: 46,
                date: "2025-05-06",
                timeSlot: "16:00-17:30",
                subject: "テスト科目",
                status: "confirmed",
                reportStatus: "completed",
                reportContent: "【単元】\nテスト単元\n\n【伝言事項】\nテストメッセージ\n\n【来週までの目標(課題)】\nテスト目標",
                createdAt: new Date().toISOString(),
                studentName: "テスト生徒"
              };
              
              // 一度確実にfalseに
              setShowReportEditModal(false);
              
              // データを設定
              setReportEditBooking(testBooking);
              
              // 確実に遅延させる
              setTimeout(() => {
                // モーダルを表示
                setShowReportEditModal(true);
                
                console.log("新版レポート編集モーダルを表示しました", {
                  modal: true,
                  booking: testBooking
                });
              }, 50);
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 text-lg shadow-lg"
            size="lg"
          >
            ⚠️ 緊急テスト：新レポート編集ボタン ⚠️
          </Button>
        </div>
      </div>
      
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
              onBookingClick={(booking) => {
                console.log("カレンダーから予約がクリックされました:", booking);
                // レポートが作成済みかどうかチェック
                const hasReport = booking.reportStatus === 'completed' || 
                  (booking.reportStatus && booking.reportStatus.startsWith('completed:'));
                  
                if (hasReport && booking.reportContent) {
                  console.log("レポート作成済みの予約 - 直接授業レポート表示モーダルを開きます");
                  // API呼び出しで詳細情報を取得
                  fetch(`/api/bookings/${booking.id}`)
                    .then(response => {
                      if (response.ok) return response.json();
                      throw new Error("Failed to fetch booking details");
                    })
                    .then(bookingDetails => {
                      // 詳細情報を設定
                      const enhancedBooking = {
                        ...bookingDetails,
                        studentName: bookingDetails.studentName || getStudentName(bookingDetails.studentId),
                        tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
                      };
                      
                      // 生徒詳細情報があれば設定
                      if (bookingDetails.studentDetails) {
                        setStudentDetails(bookingDetails.studentDetails);
                      }
                      
                      // 状態を更新して授業レポートモーダルを表示
                      setSelectedBooking(enhancedBooking);
                      setReportEditBooking(enhancedBooking);
                      setShowReportViewModal(true);
                    })
                    .catch(error => {
                      console.error("詳細情報取得エラー:", error);
                      // エラー発生時は通常のハンドラにフォールバック
                      handleBookingClick(booking);
                    });
                } else {
                  // 通常のハンドラを実行
                  handleBookingClick(booking);
                }
              }} // 直接インラインで実装
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
            id: selectedBooking.id,
            userId: selectedBooking.userId,
            tutorId: selectedBooking.tutorId,
            studentId: selectedBooking.studentId,
            tutorShiftId: selectedBooking.tutorShiftId || 0,
            date: selectedBooking.date,
            timeSlot: selectedBooking.timeSlot,
            subject: selectedBooking.subject,
            status: selectedBooking.status,
            reportStatus: selectedBooking.reportStatus || null,
            reportContent: selectedBooking.reportContent || null,
            createdAt: selectedBooking.createdAt,
            studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId),
            openEditAfterClose: selectedBooking.openEditAfterClose
          }}
          studentDetails={studentDetails}
          onClose={() => {
            setShowBookingDetailModal(false);
            
            // 詳細モーダルが閉じられたときに、編集ボタンがクリックされたのであれば
            // 少し遅延してからレポート編集モーダルを開く
            if (selectedBooking && selectedBooking.openEditAfterClose) {
              console.log("フラグによるレポート編集処理を実行します");
              // レポート編集用のデータを準備 - 明示的に全プロパティを設定
              const reportEditData: ExtendedBooking = {
                id: selectedBooking.id,
                userId: selectedBooking.userId,
                tutorId: selectedBooking.tutorId,
                studentId: selectedBooking.studentId,
                tutorShiftId: selectedBooking.tutorShiftId || 0,
                date: selectedBooking.date,
                timeSlot: selectedBooking.timeSlot,
                subject: selectedBooking.subject,
                status: selectedBooking.status,
                reportStatus: selectedBooking.reportStatus || null,
                reportContent: selectedBooking.reportContent || '',
                // 型の不一致を避けるため明示的に文字列型を使用
                createdAt: typeof selectedBooking.createdAt === 'object' 
                  ? selectedBooking.createdAt.toISOString() 
                  : selectedBooking.createdAt,
                studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId)
              };
              
              // 明示的にフラグをリセット
              selectedBooking.openEditAfterClose = false;
              
              // データを設定して編集モーダルを開く
              setTimeout(() => {
                setReportEditBooking(reportEditData);
                setShowReportEditModal(true);
                console.log("詳細モーダル閉じた後、レポート編集モーダルを表示", reportEditData);
              }, 300);
            }
          }}
          onEditReport={() => {
            // 直接コールバック方式
            console.log("onEditReport コールバックが呼び出されました");
            
            if (!selectedBooking) return;
            
            // レポート編集用のデータを準備 - 明示的に全プロパティを設定
            const reportEditData: ExtendedBooking = {
              id: selectedBooking.id,
              userId: selectedBooking.userId,
              tutorId: selectedBooking.tutorId,
              studentId: selectedBooking.studentId,
              tutorShiftId: selectedBooking.tutorShiftId || 0,
              date: selectedBooking.date,
              timeSlot: selectedBooking.timeSlot,
              subject: selectedBooking.subject,
              status: selectedBooking.status,
              reportStatus: selectedBooking.reportStatus || null,
              reportContent: selectedBooking.reportContent || '',
              // 型の不一致を避けるため明示的に文字列型を使用
              createdAt: typeof selectedBooking.createdAt === 'object' 
                ? selectedBooking.createdAt.toISOString() 
                : selectedBooking.createdAt,
              studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId)
            };
            
            // データを設定して編集モーダルを開く
            setReportEditBooking(reportEditData);
            setShowReportEditModal(true);
            console.log("レポート編集モーダルを表示（コールバック方式）", reportEditData);
          }}
          onViewReport={() => {
            setShowBookingDetailModal(false);
            setShowReportViewModal(true);
          }}
        />
      )}
      
      {/* テスト用ボタン - デバッグのためページ上部に配置 */}
      <div className="fixed top-20 right-5 z-50 flex flex-col gap-2">
        <Button 
          onClick={async () => {
            console.log("テスト用編集ボタンがクリックされました - 実際の予約ID:7を取得");
            
            // 実際の予約データを取得（より確実に実際のデータを使用）
            try {
              const response = await fetch("/api/bookings/7");
              if (response.ok) {
                const bookingData = await response.json();
                console.log("テスト用に取得した実際の予約データ:", bookingData);
                
                // まずモーダルを閉じる
                setShowReportEditModal(false);
                
                // 編集用の予約データを設定
                // reportContentがあることを確認し、明示的に設定
                const realBookingData: ExtendedBooking = {
                  id: bookingData.id,
                  userId: bookingData.userId,
                  tutorId: bookingData.tutorId,
                  studentId: bookingData.studentId,
                  tutorShiftId: bookingData.tutorShiftId || 0,
                  date: bookingData.date,
                  timeSlot: bookingData.timeSlot,
                  subject: bookingData.subject,
                  status: bookingData.status,
                  reportStatus: bookingData.reportStatus || "completed",
                  reportContent: bookingData.reportContent || 
                    "【単元】\nテスト\n\n【伝言事項】\nテスト\n\n【来週までの目標(課題)】\nテスト",
                  createdAt: bookingData.createdAt,
                  studentName: bookingData.studentName || "テスト 花子"
                };
                setReportEditBooking(realBookingData);
                
                // 少し遅延させてからモーダルを表示
                setTimeout(() => {
                  setShowReportEditModal(true);
                  console.log("テスト用レポート編集モーダルが表示されました - モーダル用データ:", reportEditBooking);
                }, 100);
              } else {
                console.error("テスト用予約データの取得に失敗しました");
                // 取得に失敗した場合はハードコードされたデータを使用
                const testBooking: ExtendedBooking = {
                  id: 7,
                  userId: 3,
                  tutorId: 2,
                  studentId: 4,
                  tutorShiftId: 61,
                  date: "2025-05-01",
                  timeSlot: "16:00-17:30",
                  subject: "小学算数",
                  status: "confirmed",
                  reportStatus: "completed",
                  reportContent: "【単元】\nテスト用単元\n\n【伝言事項】\nテスト用伝言\n\n【来週までの目標(課題)】\nテスト用課題",
                  createdAt: new Date().toISOString(),
                  studentName: "テスト 花子"
                };
                
                // 編集用の予約データを設定
                setReportEditBooking(testBooking);
                
                // 少し遅延させてからモーダルを表示
                setTimeout(() => {
                  setShowReportEditModal(true);
                }, 100);
              }
            } catch (error) {
              console.error("テスト用データ取得中にエラーが発生しました:", error);
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white p-2 font-bold animate-pulse"
        >
          レポート編集テスト (ID:7)
        </Button>
      </div>
      
      {/* レポート表示モーダル */}
      {selectedBooking && (
        <ReportViewModal
          isOpen={showReportViewModal}
          booking={{
            id: selectedBooking.id,
            userId: selectedBooking.userId,
            tutorId: selectedBooking.tutorId,
            studentId: selectedBooking.studentId,
            tutorShiftId: selectedBooking.tutorShiftId || 0,
            date: selectedBooking.date,
            timeSlot: selectedBooking.timeSlot,
            subject: selectedBooking.subject,
            status: selectedBooking.status,
            reportStatus: selectedBooking.reportStatus || null,
            reportContent: selectedBooking.reportContent || null,
            createdAt: selectedBooking.createdAt,
            studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
          }}
          onClose={() => setShowReportViewModal(false)}
          onEdit={() => {
            console.log("レポート編集ボタンがクリックされました", selectedBooking);
            
            // レポート編集用のデータを準備
            const reportEditData: ExtendedBooking = {
              id: selectedBooking.id,
              userId: selectedBooking.userId,
              tutorId: selectedBooking.tutorId,
              studentId: selectedBooking.studentId,
              tutorShiftId: selectedBooking.tutorShiftId || 0,
              date: selectedBooking.date,
              timeSlot: selectedBooking.timeSlot,
              subject: selectedBooking.subject || '',
              status: selectedBooking.status || '',
              reportStatus: selectedBooking.reportStatus || null,
              reportContent: selectedBooking.reportContent || '',
              createdAt: typeof selectedBooking.createdAt === 'object' 
                ? selectedBooking.createdAt.toISOString() 
                : selectedBooking.createdAt,
              studentName: selectedBooking.studentName || getStudentName(selectedBooking.studentId)
            };
            
            // 編集用データをセットして編集モーダルを表示
            setReportEditBooking(reportEditData);
            setShowReportEditModal(true);
          }}
        />
      )}
      
      {/* レポート編集モーダル - 専用の状態変数を使用 */}
      {showReportEditModal && reportEditBooking && (
        <ReportEditModal
          isOpen={showReportEditModal}
          booking={{
            id: reportEditBooking.id,
            userId: reportEditBooking.userId,
            tutorId: reportEditBooking.tutorId,
            studentId: reportEditBooking.studentId,
            tutorShiftId: reportEditBooking.tutorShiftId || 0,
            date: reportEditBooking.date,
            timeSlot: reportEditBooking.timeSlot,
            subject: reportEditBooking.subject,
            status: reportEditBooking.status,
            // 明示的にreportStatusとreportContentを設定
            reportStatus: reportEditBooking.reportStatus || null,
            reportContent: reportEditBooking.reportContent || "",
            createdAt: reportEditBooking.createdAt,
            // 追加情報
            studentName: reportEditBooking.studentName || 
                        getStudentName(reportEditBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName
          }}
          onClose={() => {
            setShowReportEditModal(false);
            // 状態をリセット
            setReportEditBooking(null);
          }}
          onSuccess={() => {
            // レポート編集が成功したら予約情報を再取得
            // 自動的にinvalidateQueriesで再取得されるので、ここでは何もしない
          }}
        />
      )}
    </div>
  );
}

