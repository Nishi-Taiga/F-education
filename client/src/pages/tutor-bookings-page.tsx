import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";

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
  
  // 読み込み中の表示
  if (isLoadingProfile || isLoadingBookings) {
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
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">予約管理</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* カレンダー表示（デスクトップのみ） */}
        <div className="hidden md:block md:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>予約カレンダー</CardTitle>
              <CardDescription>
                授業の予約がある日付はハイライトされます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                modifiers={{
                  booked: bookingDates
                }}
                modifiersStyles={{
                  booked: {
                    backgroundColor: "rgba(var(--primary), 0.1)",
                    fontWeight: "bold"
                  }
                }}
                locale={ja}
              />
              
              {bookingsOnSelectedDate.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">
                    {selectedDateStr ? format(parseISO(selectedDateStr), "yyyy年M月d日", { locale: ja }) : ""}
                    の予約 ({bookingsOnSelectedDate.length}件)
                  </h3>
                  <ul className="space-y-2">
                    {bookingsOnSelectedDate.map((booking: Booking) => (
                      <li key={booking.id} className="text-sm p-2 border rounded-md">
                        <div className="flex justify-between">
                          <div className="font-medium">{booking.timeSlot}</div>
                          <Badge variant={booking.status === "cancelled" ? "destructive" : "default"}>
                            {booking.status === "cancelled" ? "キャンセル" : "確定"}
                          </Badge>
                        </div>
                        <div>{booking.subject || "科目未設定"}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* 授業予約リスト */}
        <div className="col-span-1 md:col-span-8">
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
      </div>
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