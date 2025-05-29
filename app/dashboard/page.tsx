"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BookingCard } from "@/components/booking-card";
import { CommonHeader } from "@/components/common-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Calendar, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SimpleCalendar } from "@/components/simple-calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoadingFromHook } = useAuth();
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [isLoadingParentId, setIsLoadingParentId] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 予約情報を取得する関数
  const fetchBookings = async (parentId: number) => {
    setIsLoadingBookings(true);
    console.log('Inside fetchBookings for parentId:', parentId); // デバッグログ追加
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,\n
        student_profile (last_name, first_name),\n
        tutor_profile (last_name, first_name)\n
      `)
      .eq('parent_id', parentId)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (!bookingsError && bookingsData) {
      // BookingCardの型に合うようにデータを整形
      console.log('Fetched bookingsData:', bookingsData.length, 'bookings:', bookingsData); // デバッグログ追加
      const formattedBookings = bookingsData.map(booking => ({
        id: booking.id.toString(),
        date: new Date(booking.date + 'T' + booking.time_slot.split(' - ')[0] + ':00'), // Adjust time_slot to be parseable
        startTime: booking.time_slot.split(' - ')[0],
        endTime: booking.time_slot.split(' - ')[1],
        status: booking.status,
        subject: booking.subject,
        studentId: booking.student_id?.toString(),
        tutorId: booking.tutor_id?.toString(),
        studentName: booking.student_profile ? `${booking.student_profile.last_name} ${booking.student_profile.first_name}` : '生徒',
        tutorName: booking.tutor_profile ? `${booking.tutor_profile.last_name} ${booking.tutor_profile.first_name}` : '講師',
        onCancelClick: user?.role === 'parent' ? () => { // 保護者の場合のみonCancelClick関数を定義
          setBookingToCancel({
            id: booking.id.toString(),
            date: new Date(booking.date + 'T' + booking.time_slot.split(' - ')[0] + ':00'),
            startTime: booking.time_slot.split(' - ')[0],
            endTime: booking.time_slot.split(' - ')[1],
            subject: booking.subject,
            studentName: booking.student_profile ? `${booking.student_profile.last_name} ${booking.student_profile.first_name}` : '生徒',
            tutorName: booking.tutor_profile ? `${booking.tutor_profile.last_name} ${booking.tutor_profile.first_name}` : '講師',
            studentId: booking.student_id?.toString(),
          });
          setShowCancelModal(true);
        } : undefined, // 保護者でない場合はundefined
      }));
      setBookings(formattedBookings);
      console.log('Bookings state updated:', formattedBookings); // デバッグログ追加
    }

    // エラーが発生した場合もローディングを終了
    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      // 必要であればユーザーにエラーを通知するトーストなどを表示
      toast({
        title: '予約情報の取得に失敗しました',
        description: `データの読み込み中に問題が発生しました: ${bookingsError.message}`,
        variant: 'destructive',
      });
    }

    setIsLoadingBookings(false); // ここでfalseになる
  };

  const handleCancelBooking = async (bookingId: string, studentId: string, parentId: number) => {
    // 確認モーダルを閉じる
    setShowCancelModal(false);
    setBookingToCancel(null);

    // bookingsテーブルから予約を削除
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (deleteError) {
      toast({
        title: 'キャンセルの失敗',
        description: `予約の削除に失敗しました: ${deleteError.message}`,
        variant: 'destructive',
      });
      console.error('Booking deletion failed:', deleteError);
      return;
    }

    // student_ticketsにチケット返却（quantity +1）レコードを挿入
    const { error: ticketInsertError } = await supabase
      .from('student_tickets')
      .insert({
        student_id: studentId,
        quantity: 1,
        parent_id: parentId,
      });

    if (ticketInsertError) {
      toast({
        title: 'チケット返却の失敗',
        description: `チケットの返却に失敗しました: ${ticketInsertError.message}`,
        variant: 'destructive',
      });
      console.error('Ticket return failed:', ticketInsertError);
      // Note: Booking status was already updated. Consider a compensating action if ticket insert fails critically.
    }

    // 全ての処理が成功したらトースト表示とページ再読み込み
    // 注意：チケット返却が失敗してもここでは成功とみなして次に進みます
    toast({
      title: 'キャンセル完了',
      description: '予約が正常にキャンセルされました。チケットの返却に問題があった場合はお問い合わせください。'
    });

    // ページ全体を再読み込み
    window.location.reload();
  };

  // データフェッチのロジックを分離した関数
  const loadUserData = async (authUid: string) => {
    setIsLoadingParentId(true);
    setIsLoadingBookings(true); // データフェッチ開始時にローディングを設定
    console.log('Loading user data for authUid:', authUid); // デバッグログ

    // parent_profileからid取得
    const { data: parent, error: parentError } = await supabase
      .from('parent_profile')
      .select('id')
      .eq('user_id', authUid) // UUIDカラムに対して正しいUUIDを渡す
      .single();

    console.log('Fetched parent_profile:', parent, 'Error:', parentError);

    if (!parent || parentError) {
      setIsLoadingParentId(false);
      setIsLoadingBookings(false); // 親プロフィールが取得できない場合もローディングを終了
      console.error('Error fetching parent profile:', parentError);
      // toastなどでユーザーに通知することも検討
      return;
    }

    setCurrentParentId(parent.id);
    setIsLoadingParentId(false); // 親プロフィール取得完了

    // 予約情報の取得
    console.log('Fetching bookings for parentId:', parent.id);
    await fetchBookings(parent.id); // fetchBookings内でisLoadingBookingsが設定・解除される

    // 生徒情報とチケット数の取得
    console.log('Fetching students for parentId:', parent.id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('student_profile')
      .select('id, last_name, first_name')
      .eq('parent_id', parent.id); // parent_idはnumber型のはず

    console.log('Fetched student_profile:', studentsData, 'Error:', studentsError);

    if (!studentsError && studentsData) {
      const studentsWithTickets = await Promise.all(studentsData.map(async student => {
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('student_tickets')
          .select('quantity')
          .eq('student_id', student.id);

        const ticketCount = ticketsError || !ticketsData ? 0 : ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0);

        return {
          ...student,
          ticketCount: ticketCount,
        };
      }));
      setStudents(studentsWithTickets);
      console.log('Students state updated:', studentsWithTickets);
    } else if (studentsError) {
      console.error('Error fetching students:', studentsError);
      toast({
        title: '生徒情報の取得に失敗しました',
        description: `データの読み込み中に問題が発生しました: ${studentsError.message}`,
        variant: 'destructive',
      });
    }
    // すべてのデータフェッチが完了したことを示すログ
    console.log('User data loading complete.');
  };

  // Supabaseの認証状態変更をリッスンするEffect
  useEffect(() => {
    console.log('Setting up auth state change listener.');
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event, 'Session:', session);
        if (session?.user) {
          // 認証された場合
          setIsAuthenticated(true); // 認証状態をtrueに設定
          loadUserData(session.user.id); // セッションから取得した正しいuser.idでデータフェッチ
        } else {
          // 認証解除またはセッションがない場合
          setIsAuthenticated(false); // 認証状態をfalseに設定
          setStudents([]);
          setBookings([]);
          setCurrentParentId(null);
          setIsLoadingParentId(false);
          setIsLoadingBookings(false);
          console.log('User is not authenticated.');
          // リダイレクトはuseAuthの判定に任せるか、ここで明示的に行うかを検討
        }
      }
    );

    // コンポーネントのアンマウント時にリスナーを解除
    return () => {
      console.log('Cleaning up auth state change listener.');
      authListener?.unsubscribe();
    };
  }, []); // 依存配列は空で、マウント時に一度だけ設定

  // ページの初期ロード時（isAuthLoadingFromHookがtrueの間）や、データフェッチ中はローディングを表示
  // isAuthLoadingFromHook はuseAuthフックがuserオブジェクトの解決を試みている間true
  if (isAuthLoadingFromHook || isLoadingParentId || isLoadingBookings || !isAuthenticated) {
    // 認証状態が不明確な間、または認証が完了していない間もLoadingを表示
    // isAuthLoadingFromHook または !isAuthenticated が true の間は、認証状態が確定していない
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // useAuthフックで認証済みユーザーが確認できない場合、ログインページへリダイレクト
  // onAuthStateChangeで認証済みと判断されていても、useAuthのuserがnullの場合はリダイレクト
  // これはuseAuthの実装に依存するが、安全のためuseAuthの判定も使用
  if (!user) {
     router.push('/auth/login'); // 前回の修正を維持
     return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto flex flex-col">
        {/* チケット残数表示 (親/生) */}
        {user?.role === 'parent' && (
          <div className="flex flex-col items-end mb-4">
            <div className="flex flex-col gap-1">
              {students.length === 0 ? (
                <div className="text-gray-400 text-xs">生徒情報がありません</div>
              ) : (
                students.map(student => (
                  <div key={student.id} className="flex items-center bg-gray-50 py-0.5 px-2 rounded-md whitespace-nowrap text-xs border border-gray-200 mb-1">
                    <span className="font-medium truncate mr-2">{student.last_name} {student.first_name}</span>
                    <Ticket className="text-green-600 h-3 w-3 mr-1" />
                    <span className="font-bold text-green-700">{student.ticketCount}枚</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* カレンダー表示 */}
        <SimpleCalendar bookings={bookings} />

        {/* キャンセル確認モーダル */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>予約をキャンセルしますか？</DialogTitle>
              <DialogDescription>
                この操作は元に戻せません。予約をキャンセルし、チケット1枚を返却します。
              </DialogDescription>
            </DialogHeader>
            {bookingToCancel && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm">
                <p><span className="font-semibold">生徒:</span> {bookingToCancel.studentName}</p>
                <p><span className="font-semibold">講師:</span> {bookingToCancel.tutorName}</p>
                <p><span className="font-semibold">日時:</span> {new Date(bookingToCancel.date).toLocaleDateString()} {bookingToCancel.startTime} - {bookingToCancel.endTime}</p>
                <p><span className="font-semibold">科目:</span> {bookingToCancel.subject}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>キャンセル</Button>
              <Button
                onClick={() => {
                  if (bookingToCancel && currentParentId !== null) {
                    handleCancelBooking(bookingToCancel.id, bookingToCancel.studentId, currentParentId);
                  } else if (currentParentId === null) {
                    console.error('Parent ID is not available.');
                    toast({
                      title: 'エラー',
                      description: 'ユーザー情報の取得に失敗しました。ページを再読み込みしてください。',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                キャンセルを確定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 講師用：本日の授業予定エリア */}
        {user?.role === 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-900">本日の授業予定</h3>
            </div>
            <div className="space-y-2">
              {/* 本来は本日の授業のみ抽出。ここではダミーデータから今日の日付分のみ表示 */}
              {bookings.filter(b => {
                const today = new Date();
                return b.date.getFullYear() === today.getFullYear() &&
                  b.date.getMonth() === today.getMonth() &&
                  b.date.getDate() === today.getDate();
              }).length === 0 ? (
                <div className="text-gray-400 text-xs">本日の授業予定はありません</div>
              ) : (
                bookings.filter(b => {
                  const today = new Date();
                  return b.date.getFullYear() === today.getFullYear() &&
                    b.date.getMonth() === today.getMonth() &&
                    b.date.getDate() === today.getDate();
                }).map(booking => (
                  <BookingCard key={booking.id} booking={booking} onClick={() => {}} />
                ))
              )}
            </div>
          </Card>
        )}
        {user?.role === 'student' && (
          <div className="bg-white shadow-sm rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">チケット残数</h3>
              <div className="flex items-center bg-green-50 py-1 px-3 rounded-full">
                <Ticket className="text-green-600 h-4 w-4 mr-1.5" />
                <span className="font-bold text-green-700">0枚</span>
              </div>
            </div>
          </div>
        )}
        {/* 予約一覧（保護者・生徒向け） */}
        {user?.role !== 'tutor' && (
          <Card className="p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-900">予約一覧</h3>
            </div>
            <div className="space-y-2">
              {isLoadingBookings ? (
                <div className="text-gray-400 text-sm">予約情報を読み込み中...</div>
              ) : bookings.length === 0 ? (
                <div className="text-gray-400 text-sm">予約はありません</div>
              ) : (
                bookings.filter(booking => {
                  // 今日の日付を取得 (時間をゼロに設定)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  // 予約の日付を取得 (時間をゼロに設定)
                  const bookingDate = new Date(booking.date);
                  bookingDate.setHours(0, 0, 0, 0);
                  // 予約日付が今日以降であるかを判定
                  return bookingDate >= today;
                }).map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={{
                      ...booking,
                    }}
                    onClick={() => { /* 予約カードクリック時の挙動が必要であればここに実装 */ }}
                  />
                ))
              )}
            </div>
          </Card>
        )}
        {/* アクションボタン例 */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-md py-3 pb-4 mt-4 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {user?.role === 'tutor' ? (
                <>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/tutor/schedule")}
                  >
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">シフト管理</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports/new")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-green-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">新規レポート</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">過去レポート</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/tickets")}
                  >
                    <Ticket className="h-4 w-4 mr-2 text-green-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">チケット購入</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/booking")}
                  >
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">授業予約</span>
                  </Button>
                  <Button
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                    onClick={() => router.push("/reports")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-xs md:text-sm font-medium text-gray-900">授業レポート</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}