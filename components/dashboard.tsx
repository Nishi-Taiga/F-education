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
import { 
  Plus, 
  Calendar, 
  CreditCard, 
  User, 
  FileText,
  Ticket,
  Book,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarRange
} from 'lucide-react';

type DashboardProps = {
  userProfile: any;
  students: any[];
  tutorProfile: any;
  parentProfile?: any;
  availableTickets: number;
};

// ダッシュボードコンポーネント
export const Dashboard = ({ userProfile, students, tutorProfile, parentProfile, availableTickets }: DashboardProps) => {
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
  const handleBookingSelect = (booking: any) => {
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
  const handleBookingPageClick = () => {
    router.push('/booking');
  };

  // チケット購入ページへの遷移
  const handleBuyTicketsClick = () => {
    router.push('/tickets');
  };

  // シフト登録ページへの遷移
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

  // 表示名を決定
  let displayName = userProfile?.display_name || '';
  if (!displayName) {
    if (isTutor && tutorProfile) {
      displayName = `${tutorProfile.last_name} ${tutorProfile.first_name}`;
    } else if (isParent && parentProfile) {
      displayName = parentProfile.parent_name;
    } else if (isStudent && students.length > 0) {
      displayName = `${students[0].last_name} ${students[0].first_name}`;
    } else {
      displayName = userProfile?.email || '';
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ダッシュボード</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {displayName}
            {isParent && 'さん、お子様の学習状況をご確認ください'}
            {isStudent && 'さん、授業の予定を確認しましょう'}
            {isTutor && '先生、本日もよろしくお願いします'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {(isParent || isStudent) && (
            <Button onClick={handleBookingPageClick} size="lg" className="shadow-sm">
              <Plus className="mr-2 h-5 w-5" />
              授業を予約する
            </Button>
          )}
          
          {isParent && (
            <Button variant="outline" size="lg" onClick={handleBuyTicketsClick} className="shadow-sm">
              <Ticket className="mr-2 h-5 w-5" />
              チケット購入 ({availableTickets}枚)
            </Button>
          )}
          
          {isTutor && (
            <>
              <Button onClick={handleScheduleClick} size="lg" className="shadow-sm">
                <CalendarRange className="mr-2 h-5 w-5" />
                シフト登録
              </Button>
              <Button variant="outline" size="lg" onClick={handleProfileClick} className="shadow-sm">
                <User className="mr-2 h-5 w-5" />
                プロフィール編集
              </Button>
            </>
          )}
          
          <Button variant="outline" size="lg" onClick={handleReportsClick} className="shadow-sm">
            <FileText className="mr-2 h-5 w-5" />
            レポート一覧
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">カレンダー</CardTitle>
            <CardDescription>授業の予定をカレンダーで確認できます</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-[450px] w-full rounded-lg" />
              </div>
            ) : (
              <CalendarView 
                bookings={bookings}
                currentDate={currentDate}
                onDateChange={handleMonthChange}
                onBookingClick={handleBookingSelect}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">授業予約一覧</CardTitle>
              <CardDescription>今後の授業予定や過去の授業履歴</CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="upcoming" className="text-sm">予定</TabsTrigger>
                  <TabsTrigger value="past" className="text-sm">過去</TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-sm">キャンセル</TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="space-y-3 mt-1">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : upcomingBookings.length > 0 ? (
                    upcomingBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingSelect(booking)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 px-4 border border-dashed rounded-lg">
                      <Calendar className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                      <p className="text-muted-foreground">
                        予定されている授業はありません
                      </p>
                      {(isStudent || isParent) && (
                        <Button 
                          variant="outline" 
                          className="mt-4" 
                          onClick={handleBookingPageClick}
                        >
                          授業を予約する
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="past" className="space-y-3 mt-1">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : pastBookings.length > 0 ? (
                    pastBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingSelect(booking)}
                        onViewReport={booking.reportId ? () => handleViewReport(booking) : undefined}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 px-4 border border-dashed rounded-lg">
                      <Clock className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                      <p className="text-muted-foreground">
                        過去の授業はありません
                      </p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="cancelled" className="space-y-3 mt-1">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
                    ))
                  ) : cancelledBookings.length > 0 ? (
                    cancelledBookings.slice(0, 5).map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onClick={() => handleBookingSelect(booking)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 px-4 border border-dashed rounded-lg">
                      <XCircle className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                      <p className="text-muted-foreground">
                        キャンセルされた授業はありません
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleReportsClick}
              >
                すべての予約を表示
              </Button>
            </CardFooter>
          </Card>

          {isParent && (
            <Card className="shadow-md bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Ticket className="mr-2 h-5 w-5 text-blue-600" />
                  チケット情報
                </CardTitle>
                <CardDescription>保有チケットと使用状況</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">保有チケット</p>
                    <p className="text-4xl font-bold text-blue-700">{availableTickets}<span className="text-xl ml-1">枚</span></p>
                  </div>
                  <Button 
                    onClick={handleBuyTicketsClick}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    チケットを購入
                  </Button>
                </div>
                <div className="text-sm text-gray-600 mt-2 bg-white p-3 rounded-md border border-blue-100">
                  <p>1チケットで1時間の授業を予約できます。</p>
                  <p>チケットはお子様全員で共有して使用できます。</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {isTutor && (
            <Card className="shadow-md bg-gradient-to-br from-green-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Book className="mr-2 h-5 w-5 text-green-600" />
                  授業情報
                </CardTitle>
                <CardDescription>今月の授業数と完了レポート</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 my-2">
                  <div className="border rounded-lg p-4 text-center bg-white shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">今月の授業</p>
                    <p className="text-3xl font-bold text-green-700">
                      {loading ? (
                        <Skeleton className="h-9 w-16 mx-auto" />
                      ) : (
                        bookings.filter(b => 
                          b.date.getMonth() === new Date().getMonth() && 
                          b.date.getFullYear() === new Date().getFullYear() &&
                          b.status !== 'cancelled'
                        ).length
                      )}
                      <span className="text-lg ml-1">件</span>
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 text-center bg-white shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">未提出レポート</p>
                    <p className="text-3xl font-bold text-amber-600">
                      {loading ? (
                        <Skeleton className="h-9 w-16 mx-auto" />
                      ) : (
                        pastBookings.filter(b => !b.reportId).length
                      )}
                      <span className="text-lg ml-1">件</span>
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-4 bg-white p-3 rounded-md border border-green-100">
                  <p className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mr-1.5" />
                    完了した授業のレポートを必ず提出してください。
                  </p>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleScheduleClick}
                >
                  シフト登録・管理
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