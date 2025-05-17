// dashboard.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarView } from '@/components/calendar-view';
import { BookingCard } from '@/components/booking-card';
import { BookingDetailModal } from '@/components/booking-detail-modal';
import { ReportViewModal } from '@/components/report-view-modal';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar, CreditCard, User, FileText } from 'lucide-react';

type DashboardProps = {
  userProfile: any;
  students: any[];
  tutorProfile: any;
  availableTickets: number;
};

export const Dashboard = ({ userProfile, students, tutorProfile, availableTickets }: DashboardProps) => {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { toast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [showReportViewModal, setShowReportViewModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');

  const isParent = userProfile?.role === 'parent';
  const isStudent = userProfile?.role === 'student';
  const isTutor = userProfile?.role === 'tutor';

  // 予約情報を取得
  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('bookings')
          .select(`
            *,
            student:student_id(id, first_name, last_name),
            tutor:tutor_id(id, first_name, last_name),
            lesson_report:lesson_report_id(id, content, status)
          `)
          .order('date', { ascending: true });

        // ユーザーロールに応じてクエリを絞り込む
        if (isParent) {
          const studentIds = students.map(student => student.id);
          query = query.in('student_id', studentIds);
        } else if (isStudent) {
          query = query.eq('student_id', userProfile?.id);
        } else if (isTutor) {
          query = query.eq('tutor_id', tutorProfile?.id);
        }

        const { data, error } = await query;

        if (error) {
          toast({
            title: "エラー",
            description: "予約情報の取得に失敗しました。",
            variant: "destructive",
          });
          console.error('Error fetching bookings:', error);
        } else {
          // データを整形
          const formattedBookings = data.map(booking => ({
            id: booking.id,
            date: new Date(booking.date),
            startTime: booking.start_time,
            endTime: booking.end_time,
            status: booking.status,
            subject: booking.subject,
            studentId: booking.student_id,
            tutorId: booking.tutor_id,
            studentName: `${booking.student.last_name} ${booking.student.first_name}`,
            tutorName: booking.tutor ? `${booking.tutor.last_name} ${booking.tutor.first_name}` : '',
            reportId: booking.lesson_report_id,
            reportStatus: booking.lesson_report?.status || null,
            reportContent: booking.lesson_report?.content || null,
          }));
          setBookings(formattedBookings);
        }
      } catch (error) {
        console.error('Error in fetchBookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [userProfile, tutorProfile, students, isParent, isStudent, isTutor, toast, supabase]);

  // 予約詳細を表示
  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowBookingDetailModal(true);
  };

  // レポート表示
  const handleViewReport = (booking: any) => {
    setSelectedBooking(booking);
    setShowReportViewModal(true);
  };

  // 予約キャンセルハンドラー
  const handleCancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // 予約一覧を更新
      setBookings(bookings.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: 'cancelled' } 
          : booking
      ));
      
      setShowBookingDetailModal(false);
      toast({
        title: "キャンセル完了",
        description: "予約をキャンセルしました。",
      });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "エラー",
        description: "予約のキャンセルに失敗しました。",
        variant: "destructive",
      });
    }
  };

  // 表示する予約をフィルタリング
  const upcomingBookings = bookings.filter(
    booking => booking.date >= new Date() && booking.status === 'confirmed'
  );
  
  const pastBookings = bookings.filter(
    booking => booking.date < new Date() || booking.status === 'completed'
  );

  const cancelledBookings = bookings.filter(
    booking => booking.status === 'cancelled'
  );

  // 月の変更ハンドラー
  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  // 予約ページへの遷移
  const handleBookingClick = () => {
    router.push('/booking');
  };

  // チケット購入ページへの遷移
  const handleBuyTicketsClick = () => {
    router.push('/tickets');
  };

  // 講師スケジュールページへの遷移
  const handleScheduleClick = () => {
    router.push('/tutor/schedule');
  };

  // 講師プロフィールページへの遷移
  const handleProfileClick = () => {
    router.push('/tutor/profile');
  };

  // レポート一覧ページへの遷移
  const handleReportsClick = () => {
    router.push('/reports');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground">
            {userProfile?.first_name ? `${userProfile.last_name} ${userProfile.first_name}` : ''}
            {userProfile?.role === 'parent' && 'さん、お子様の学習状況をご確認ください'}
            {userProfile?.role === 'student' && 'さん、授業の予定を確認しましょう'}
            {userProfile?.role === 'tutor' && '先生、本日もよろしくお願いします'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(isParent || isStudent) && (
            <Button onClick={handleBookingClick}>
              <Plus className="mr-2 h-4 w-4" />
              予約する
            </Button>
          )}
          
          {isParent && (
            <Button variant="outline" onClick={handleBuyTicketsClick}>
              <CreditCard className="mr-2 h-4 w-4" />
              チケット購入 ({availableTickets}枚)
            </Button>
          )}
          
          {isTutor && (
            <>
              <Button onClick={handleScheduleClick}>
                <Calendar className="mr-2 h-4 w-4" />
                スケジュール管理
              </Button>
              <Button variant="outline" onClick={handleProfileClick}>
                <User className="mr-2 h-4 w-4" />
                プロフィール
              </Button>
            </>
          )}
          
          <Button variant="outline" onClick={handleReportsClick}>
            <FileText className="mr-2 h-4 w-4" />
            レポート一覧
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>カレンダー</CardTitle>
            <CardDescription>授業の予定を確認できます</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-[400px] w-full rounded-lg" />
              </div>
            ) : (
              <CalendarView 
                bookings={bookings}
                currentDate={currentDate}
                onDateChange={handleMonthChange}
                onBookingClick={handleBookingClick}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>予約一覧</CardTitle>
              <CardDescription>授業の予約状況</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upcoming">予定</TabsTrigger>
                  <TabsTrigger value="past">過去</TabsTrigger>
                  <TabsTrigger value="cancelled">キャンセル</TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="space-y-4 mt-4">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : upcomingBookings.length > 0 ? (
                    upcomingBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingClick(booking)}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      予定されている授業はありません
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="past" className="space-y-4 mt-4">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : pastBookings.length > 0 ? (
                    pastBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingClick(booking)}
                        onViewReport={booking.reportId ? () => handleViewReport(booking) : undefined}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      過去の授業はありません
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="cancelled" className="space-y-4 mt-4">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : cancelledBookings.length > 0 ? (
                    cancelledBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingClick(booking)}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      キャンセルされた授業はありません
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={handleReportsClick}>
                すべての予約を表示
              </Button>
            </CardFooter>
          </Card>

          {isParent && (
            <Card>
              <CardHeader>
                <CardTitle>チケット情報</CardTitle>
                <CardDescription>保有チケットと使用状況</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">保有チケット</p>
                    <p className="text-2xl font-bold">{availableTickets}枚</p>
                  </div>
                  <Button onClick={handleBuyTicketsClick}>
                    チケットを購入
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {isTutor && (
            <Card>
              <CardHeader>
                <CardTitle>担当授業集計</CardTitle>
                <CardDescription>今月の授業数と完了レポート</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">今月の授業</p>
                    <p className="text-2xl font-bold">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mx-auto" />
                      ) : (
                        bookings.filter(b => 
                          b.date.getMonth() === new Date().getMonth() && 
                          b.date.getFullYear() === new Date().getFullYear() &&
                          b.status !== 'cancelled'
                        ).length
                      )}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">未提出レポート</p>
                    <p className="text-2xl font-bold">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mx-auto" />
                      ) : (
                        pastBookings.filter(b => !b.reportId).length
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={handleScheduleClick}>
                  スケジュール管理
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>

      {/* 予約詳細モーダル */}
      {selectedBooking && (
        <BookingDetailModal
          isOpen={showBookingDetailModal}
          booking={selectedBooking}
          onClose={() => setShowBookingDetailModal(false)}
          onCancel={() => handleCancelBooking(selectedBooking.id)}
          onViewReport={
            selectedBooking.reportId 
              ? () => {
                  setShowBookingDetailModal(false);
                  setShowReportViewModal(true);
                }
              : undefined
          }
          userRole={userProfile?.role || 'student'}
        />
      )}

      {/* レポート閲覧モーダル */}
      {selectedBooking && (
        <ReportViewModal
          isOpen={showReportViewModal}
          booking={{
            id: selectedBooking.id,
            date: selectedBooking.date,
            startTime: selectedBooking.startTime,
            endTime: selectedBooking.endTime,
            subject: selectedBooking.subject,
            studentId: selectedBooking.studentId,
            tutorId: selectedBooking.tutorId,
            reportStatus: selectedBooking.reportStatus || null,
            reportContent: selectedBooking.reportContent || null,
            studentName: selectedBooking.studentName,
            tutorName: selectedBooking.tutorName,
          }}
          onClose={() => setShowReportViewModal(false)}
          onEdit={isTutor ? () => {
            setShowReportViewModal(false);
            router.push(`/report-edit?bookingId=${selectedBooking.id}`);
          } : undefined}
        />
      )}
    </div>
  );
};