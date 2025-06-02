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
  CalendarRange,
  LogOut
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
        // 予約情報を取得
        let bookingsQuery = supabase
          .from('bookings')
          .select(`
            *,
            student:student_id(id, first_name, last_name),
            tutor:tutor_id(id, first_name, last_name)
          `)
          .order('date', { ascending: true });

        // ユーザーロールに応じてクエリを絞り込む
        if (isParent) {
          const studentIds = students.map(student => student.id);
          bookingsQuery = bookingsQuery.in('student_id', studentIds);
        } else if (isStudent) {
          bookingsQuery = bookingsQuery.eq('student_id', userProfile?.id);
        } else if (isTutor) {
          bookingsQuery = bookingsQuery.eq('tutor_id', tutorProfile?.id);
        }

        const { data: bookingsData, error: bookingsError } = await bookingsQuery;

        if (bookingsError) {
          throw bookingsError;
        }

        // 予約IDのリストを作成
        const bookingIds = bookingsData?.map(booking => booking.id) || [];
        
        // 予約IDに関連するレポート情報を取得
        const { data: reportsData, error: reportsError } = await supabase
          .from('lesson_reports')
          .select('*')
          .in('booking_id', bookingIds);

        if (reportsError) {
          throw reportsError;
        }

        // レポート情報をBooking情報とマージ
        const formattedBookings = bookingsData.map(booking => {
          // 対応するレポートを検索
          const report = reportsData?.find(report => report.booking_id === booking.id);
          
          return {
            id: booking.id,
            date: new Date(booking.date),
            startTime: booking.time_slot.split('-')[0],
            endTime: booking.time_slot.split('-')[1],
            status: booking.status,
            subject: booking.subject,
            studentId: booking.student_id,
            tutorId: booking.tutor_id,
            studentName: `${booking.student.last_name} ${booking.student.first_name}`,
            tutorName: booking.tutor ? `${booking.tutor.last_name} ${booking.tutor.first_name}` : '',
            reportId: report?.id || null,
            reportStatus: report?.status || null,
            reportContent: report?.unit_content || null,
          };
        });
        
        setBookings(formattedBookings);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        toast({
          title: "エラー",
          description: "予約情報の取得に失敗しました。",
          variant: "destructive",
        });
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
    try {
      // 前にセッションチェックを追加
      const session = supabase.auth.getSession();
      console.log("ナビゲーション前にセッションを確認:", session);
      
      // router.pushの前にconsole.logを追加
      console.log("シフト登録ページへ遷移します");
      
      // 直接ナビゲーションするのではなく、イベントループの次のティックで実行
      setTimeout(() => {
        router.push('/tutor/schedule');
      }, 0);
    } catch (error) {
      console.error("シフト登録ページへの遷移中にエラーが発生しました:", error);
      toast({
        title: "エラー",
        description: "ページ遷移に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    }
  };

  // 講師プロフィールページへの遷移
  const handleProfileClick = () => {
    router.push('/tutor/profile');
  };

  // レポート一覧ページへの遷移
  const handleReportsClick = () => {
    router.push('/reports');
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "ログアウト完了",
        description: "ログアウトしました。",
      });
      
      router.push('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました。",
        variant: "destructive",
      });
    }
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
          
          {/* ログアウトボタン追加 */}
          <Button variant="outline" size="lg" onClick={handleLogout} className="shadow-sm text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700">
            <LogOut className="mr-2 h-5 w-5" />
            ログアウト
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

      {userProfile?.role === 'student' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">予約・レポート</h2>
          <div className="flex flex-col space-y-4">
            <Button onClick={() => router.push('/search-tutors')} className="w-full">
              <Calendar className="mr-2 h-4 w-4" /> 授業を予約する
            </Button>
            {/* レポート確認ボタンを追加 */}
            <Button onClick={() => router.push('/reports')} className="w-full">
              <FileText className="mr-2 h-4 w-4" /> レポート一覧を見る
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};