"use client";

import { useRouter } from "next/navigation";
// import { useAuth } from "@/hooks/use-auth"; // useAuth の import を削除
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
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'; // User を import に追加
import { ReportCreationModal } from "@/components/report-creation-modal";
import { ReportEditModal } from "@/components/report-edit-modal";

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  // useAuth から user と isLoading を取得するのをやめる
  // const { user, isLoading: isAuthLoadingFromHook } = useAuth();

  // 認証状態とユーザー情報を管理するローカルステートを追加
  const [user, setUser] = useState<User | null>(null);
  // 認証情報および初期ユーザーデータロード中のステート
  const [isLoadingAuthAndData, setIsLoadingAuthAndData] = useState(true);

  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [isLoadingParentId, setIsLoadingParentId] = useState(true);
  // isAuthenticated は不要になる可能性が高いですが、削除またはコメントアウトを検討
  // const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  // isInitialLoadingComplete は使用しないため削除
  // const [isInitialLoadingComplete, setIsInitialLoadingComplete] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentTutorId, setCurrentTutorId] = useState<number | null>(null);
  const [isReportEditModalOpen, setIsReportEditModalOpen] = useState(false);

  // 予約情報を取得する関数 (保護者用)
  const fetchBookingsForParent = async (parentId: number) => {
    setIsLoadingBookings(true);
    console.log('Inside fetchBookingsForParent for parentId:', parentId);
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        student_profile (last_name, first_name),
        tutor_profile (last_name, first_name)
      `)
      .eq('parent_id', parentId)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (!bookingsError && bookingsData) {
      console.log('Fetched bookingsData for parent:', bookingsData.length, 'bookings:', bookingsData);
      const formattedBookings = bookingsData.map(booking => ({
        id: booking.id.toString(),
        date: new Date(booking.date + 'T' + booking.time_slot.split(' - ')[0] + ':00'),
        startTime: booking.time_slot.split(' - ')[0],
        endTime: booking.time_slot.split(' - ')[1],
        status: booking.status,
        subject: booking.subject,
        studentId: booking.student_id?.toString(),
        tutorId: booking.tutor_id?.toString(),
        studentName: booking.student_profile ? `${booking.student_profile.last_name} ${booking.student_profile.first_name}` : '生徒',
        tutorName: booking.tutor_profile ? `${booking.tutor_profile.last_name} ${booking.tutor_profile.first_name}` : '講師',
        onCancelClick: user?.role === 'parent' ? () => {
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
        } : undefined,
      }));
      setBookings(formattedBookings);
      console.log('Bookings state updated for parent:', formattedBookings);
    }

    if (bookingsError) {
      console.error('Error fetching bookings for parent:', bookingsError);
      toast({
        title: '予約情報の取得に失敗しました',
        description: `データの読み込み中に問題が発生しました: ${bookingsError.message}`,
        variant: 'destructive',
      });
    }

    setIsLoadingBookings(false);
  };

  // 予約情報を取得する関数 (講師用)
  const fetchBookingsForTutor = async (tutorId: number) => {
    setIsLoadingBookings(true);
    console.log('Inside fetchBookingsForTutor for tutorId:', tutorId);
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        student_profile (last_name, first_name),
        parent_profile (name)
      `)
      .eq('tutor_id', tutorId)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (!bookingsError && bookingsData) {
      console.log('Fetched bookingsData for tutor:', bookingsData.length, 'bookings:', bookingsData);
      const formattedBookings = bookingsData.map(booking => ({
        id: booking.id.toString(),
        date: new Date(booking.date + 'T' + booking.time_slot.split(' - ')[0] + ':00'),
        startTime: booking.time_slot.split(' - ')[0],
        endTime: booking.time_slot.split(' - ')[1],
        status: booking.status,
        subject: booking.subject,
        studentId: booking.student_id?.toString(),
        tutorId: booking.tutor_id?.toString(),
        studentName: booking.student_profile ? `${booking.student_profile.last_name} ${booking.student_profile.first_name}` : '生徒',
        tutorName: booking.tutor_profile ? `${booking.tutor_profile.last_name} ${booking.tutor_profile.first_name}` : '講師',
        // 講師側では予約キャンセルボタンは表示しない
        onCancelClick: undefined,
      }));
      setBookings(formattedBookings);
      console.log('Bookings state updated for tutor:', formattedBookings);
    }

    if (bookingsError) {
      console.error('Error fetching bookings for tutor:', bookingsError);
      toast({
        title: '予約情報の取得に失敗しました',
        description: `データの読み込み中に問題が発生しました: ${bookingsError.message}`,
        variant: 'destructive',
      });
    }

    setIsLoadingBookings(false);
  };

  // 予約リストを再取得する関数 (レポート作成後に使用)
  const refetchBookings = async () => {
      console.log("refetchBookings 開始");
      // 現在のユーザーロールとIDに基づいて予約を再取得
      // user が null の可能性があるため、チェックを追加
      if (!user) {
          console.warn("refetchBookings: user is null. Cannot refetch bookings.");
          setIsLoadingBookings(false);
          return;
      }

      const userRole = (user as any).role; // ロールを取得

      if (userRole === 'parent' && currentParentId !== null) {
          await fetchBookingsForParent(currentParentId);
      } else if (userRole === 'tutor' && currentTutorId !== null) {
          await fetchBookingsForTutor(currentTutorId);
      } else {
           console.warn("refetchBookings: 予約再取得に必要な情報が不足しています。", { userRole, currentParentId, currentTutorId });
           setIsLoadingBookings(false);
      }
      console.log("refetchBookings 完了");
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

    toast({
      title: 'キャンセル完了',
      description: '予約が正常にキャンセルされました。チケットの返却に問題があった場合はお問い合わせください。'
    });

    // ページ全体を再読み込み
    window.location.reload();
  };

  // ユーザーデータロード関数 (認証済みの user オブジェクトを受け取る)
  const loadUserData = async (authenticatedUser: User) => {
    console.log("loadUserData 開始:", authenticatedUser.id);
    setIsLoadingParentId(true);
    setIsLoadingBookings(true);
    setIsDataLoaded(false); // loadUserDataが呼ばれたらデータはまだロード中とマーク

    if (!authenticatedUser || !authenticatedUser.id) {
        console.log("loadUserData: authenticatedUser or id is null, exiting.");
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        setIsDataLoaded(true); // データロードは行わないが、ロード処理としては完了とマーク
        // isInitialLoadingComplete は使用しない
        // setIsInitialLoadingComplete(true); // 削除
        // ユーザーがいない場合はリダイレクトされるので、ここではローディング状態を更新しない
        // setIsLoadingAuthAndData(false); // ここではまだロード完了としない
        return;
    }

    // ロール情報は user オブジェクトの app_metadata から取得することを推奨
    // 現在は user オブジェクトに直接 role があることを想定
    const userRole = (authenticatedUser as any).role; // Supabase Auth の user メタデータに role が含まれていることを想定

    let parentOrTutorLoaded = false;

    if (userRole === 'parent') {
      console.log("loadUserData: ロールは保護者です。");
      const { data: parent, error: parentError } = await supabase
        .from('parent_profile')
        .select('id')
        .eq('user_id', authenticatedUser.id)
        .single();

      console.log("親データ取得結果", parent, parentError);

      if (!parent || parentError) {
        console.error('親プロフィール取得エラー', parentError);
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        // データロードは失敗したが、このパスでの処理は完了
      } else {
        console.log("親IDが取得できました:", parent.id);
        setCurrentParentId(parent.id);
        setIsLoadingParentId(false);

        await fetchBookingsForParent(parent.id);

        const { data: studentsData, error: studentsError } = await supabase
          .from('student_profile')
          .select('id, last_name, first_name')
          .eq('parent_id', parent.id);

        console.log("生徒データ取得結果", studentsData, studentsError);

        if (!studentsError && studentsData) {
          const studentsWithTickets = await Promise.all(studentsData.map(async student => {
            const { data: ticketsData, error: ticketsError } = await supabase
              .from('student_tickets')
              .select('quantity')
              .eq('student_id', student.id);

            const ticketCount = ticketsError || !ticketsData ? 0 : ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0);

            return { ...student, ticketCount: ticketCount };
          }));

          console.log("生徒情報＋チケット数", studentsWithTickets);
          setStudents(studentsWithTickets);
        } else {
          console.error("生徒情報取得エラー", studentsError);
        }
        parentOrTutorLoaded = true; // 親データのロードが成功
      }

    } else if (userRole === 'tutor') {
      console.log("loadUserData: ロールは講師です。");
      const { data: tutor, error: tutorError } = await supabase
        .from('tutor_profile')
        .select('id')
        .eq('user_id', authenticatedUser.id)
        .single();

      console.log("講師データ取得結果", tutor, tutorError);

      if (!tutor || tutorError) {
        console.error('講師プロフィール取得エラー', tutorError);
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        // データロードは失敗したが、このパスでの処理は完了
      } else {
        console.log("講師IDが取得できました:", tutor.id);
        setCurrentTutorId(tutor.id);
        setIsLoadingParentId(false);

        await fetchBookingsForTutor(tutor.id);
        parentOrTutorLoaded = true; // 講師データのロードが成功
      }

    } else {
        console.warn("loadUserData: 未対応のユーザーロールです", userRole);
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        toast({
          title: "エラー",
          description: `未対応のユーザーロールです: ${userRole}`,
          variant: "destructive",
        });
        // 未対応ロールの場合、データロードは完了したものとして扱う
        parentOrTutorLoaded = true;
    }

    // ユーザーロールに基づいたデータのロードが完了した場合のみ isDataLoaded を true にする
    // エラーまたは未対応ロールの場合も、ロード処理としては完了
    setIsDataLoaded(true);
    console.log("loadUserData 完了: isDataLoaded =", true);

    // ユーザーデータロードが完了したら、全体のローディング状態を解除
    setIsLoadingAuthAndData(false); // ここで全体のロード完了と見なす
    console.log("setIsLoadingAuthAndData を false に設定");
  };

  // Effect for initial auth state check and setting up auth state change listener
  useEffect(() => {
    console.log("useEffect: Setting up auth listener and checking session...");

    // Initial auth state check
    const checkInitialSession = async () => {
      console.log("Checking initial session...");
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log("getSession 結果:", { session, error });

      if (error) {
        console.error("Error getting session:", error);
        toast({
          title: '認証情報の取得に失敗しました',
          description: `エラー: ${error.message}`,
          variant: 'destructive',
        });
        setUser(null); // エラー時はユーザーなし
        setIsLoadingAuthAndData(false); // ロード完了（失敗）
        router.push("/auth/"); // ログインページへリダイレクト
      } else if (!session) {
        console.log("No active session. Redirecting to /auth/.");
        setUser(null); // セッションなし
        setIsLoadingAuthAndData(false); // ロード完了（ユーザーなし）
        router.push("/auth/"); // ログインページへリダイレクト
      } else {
        console.log("Active session found. User:", session.user);
        // セッションがあり、ユーザーがいる場合、user state を設定
        // user state の変更をトリガーに別の useEffect でデータロードを開始
        setUser(session.user);
        // setIsLoadingAuthAndData(false); // ここではまだ全体のロード完了としない
      }
    };

    checkInitialSession();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Supabase auth event: ${event}`, { session });
      if (event === 'SIGNED_IN' && session) {
          console.log('Auth event: SIGNED_IN', session.user);
          setUser(session.user); // user state を更新
          // SIGNED_IN イベント後、user state の変更をトリガーにデータロード useEffect が走る
          // setIsLoadingAuthAndData(true); // データロード中はローディング状態に戻す
          setIsDataLoaded(false); // データ再ロードが必要
      } else if (event === 'SIGNED_OUT') {
          console.log('Auth event: SIGNED_OUT');
          setUser(null); // user state をクリア
          setIsDataLoaded(false); // データもクリア
          setCurrentParentId(null);
          setCurrentTutorId(null);
          setStudents([]);
          setBookings([]);
          setIsLoadingAuthAndData(false); // ロード完了（ユーザーなし）
          // ログアウト時はログインページへリダイレクト
          console.log("Auth state changed to signed out. Redirecting to /auth/.");
          router.push("/auth/");
      } else if (session && event === 'INITIAL_SESSION') {
           console.log('Auth event: INITIAL_SESSION', session.user);
           // INITIAL_SESSION は getSession とほぼ同じだが、リスナー経由で来る場合がある
           // user state がまだ設定されていなければ設定
           if (!user) {
             setUser(session.user);
             // setIsLoadingAuthAndData(true); // データロード中はローディング状態に戻す
             setIsDataLoaded(false); // データロードが必要
           }
      }
       // 他のイベント (PASSWORD_RECOVERY, TOKEN_REFRESHED) などはここでは特に処理しない
    });

    // クリーンアップ関数でリスナーを解除
    return () => {
      console.log("Cleaning up auth listener.");
      authListener?.unsubscribe();
    };
  }, [router]); // 依存配列はシンプルに router のみ（Supabase クライアント自体は変更されないと仮定）

  // Effect to load user data once user state is set and data is not loaded
  useEffect(() => {
      console.log("useEffect: User state or isDataLoaded changed.", { user: !!user, isDataLoaded, isLoadingAuthAndData });

      // ユーザーがセットされ、データがまだロードされておらず、かつ全体のロードが進行中の場合
      // この条件は、認証が成功し user が設定された後で、loadUserData がまだ呼ばれていない状態を捉える
      if (user && !isDataLoaded) { // && isLoadingAuthAndData は不要、loadUserData内で false にするため
          console.log("User is present and data not loaded. Calling loadUserData...");
          // loadUserData 開始前にローディング状態を true にセット（既に true のはずだが念のため）
          setIsLoadingAuthAndData(true);
          loadUserData(user);
      } else if (!user && !isLoadingAuthAndData && !isDataLoaded) {
          // ユーザーがおらず、全体のロードが完了し、データもロードされていない場合
          // これは主に SIGNED_OUT 後に到達しうる状態。リダイレクト済みか確認。
          console.log("User is null, overall loading complete, data not loaded. Ensure redirect...");
           if (window.location.pathname !== "/auth/") {
              console.log("User is null and not on auth page. Redirecting.");
              router.push("/auth/");
           }
      } else if (user && isDataLoaded && isLoadingAuthAndData) {
           // ユーザーがいて、データもロード済みだが、全体のローディングがまだtrueの場合
           // これは loadUserData の最後で isLoadingAuthAndData(false) が呼ばれるべきケース
           // 何らかの理由で呼ばれなかった場合のフォールバック
           console.log("User present, data loaded, but overall loading is true. Setting isLoadingAuthAndData to false.");
           setIsLoadingAuthAndData(false);
      }

      // 依存配列に user, isDataLoaded を含める
      // isLoadingAuthAndData はこの Effect の中で更新されるため含めない
  }, [user, isDataLoaded, router]);

  // ローディング状態の表示
  // isLoadingAuthAndData が true の間、ローディングを表示
  if (isLoadingAuthAndData) {
    console.log('Rendering loading state:', { isLoadingAuthAndData, user: !!user, isDataLoaded });
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // 認証されていない状態の表示 (isLoadingAuthAndData が false かつ user が null の場合)
  // リダイレクトされるはずなので、通常この状態にはならないが、フォールバックとして残す
  if (!user) {
      console.log('Rendering not authenticated state (isLoadingAuthAndData is false, user is null)...');
      return <div className="flex flex-col items-center justify-center h-screen">認証情報がありません。ログインしてください。<Button onClick={() => router.push("/auth/")} className="ml-4">ログイン</Button></div>;
  }

  // 認証済みかつデータロード完了状態の表示
  console.log('Rendering dashboard (isLoadingAuthAndData is false, user is present)...');
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto flex flex-col">
        {/* ユーザーロールに基づいたコンテンツの表示 */}
        {/* user?.role の代わりに (user as any)?.role を使用するか、User 型を拡張 */}
        {(user as any)?.role === 'parent' && (
          <div className="flex flex-col items-end mb-4">
            <div className="flex flex-col gap-1">
              {students.length === 0 ? (
                <div className="text-gray-400 text-xs">生徒情報がありません</div>
              ) : (
                students.map(student => (
                  <div key={student.id} className="flex items-center bg-gray-50 py-0.5 px-2 rounded-md whitespace-nowrap text-xs border border-gray-200 mb-1">
                    <span className="font-medium truncate mr-2">{student.last_name} {student.first_name}</span>
                    <Ticket className="h-3 w-3 mr-1 text-green-600" />
                    <span className="font-bold text-green-700">{student.ticketCount}枚</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* SimpleCalendar も userRole を使用 */}
        <SimpleCalendar bookings={bookings} userRole={(user as any)?.role} />

        {(user as any)?.role === 'parent' && (
           <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>予約をキャンセルしますか？</DialogTitle>
                <DialogDescription>
                  この操作は元に戻せません。予約をキャンセルし、チケット1枚を返却します。
                </DialogDescription>
              </DialogHeader>
              {bookingToCancel && currentParentId !== null && (
                <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm">
                  <p><strong>日時:</strong> {bookingToCancel.date.toLocaleDateString()} {bookingToCancel.startTime} - {bookingToCancel.endTime}</p>
                  <p><strong>科目:</strong> {bookingToCancel.subject}</p>
                  <p><strong>生徒:</strong> {bookingToCancel.studentName}</p>
                  <p><strong>講師:</strong> {bookingToCancel.tutorName}</p>
                </div>
              )}
              {/* currentParentId が null の可能性があるためチェック */}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelModal(false)}>キャンセル</Button>
                {bookingToCancel && currentParentId !== null && (
                  <Button onClick={() => handleCancelBooking(bookingToCancel.id, bookingToCancel.studentId, currentParentId!)}>確定</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {(user as any)?.role === 'tutor' && (
          <div className="mt-4">
            <h2 className="text-2xl font-semibold mb-4">担当予約一覧</h2>
            {bookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    userRole="tutor"
                    onViewReport={() => router.push(`/reports/${booking.reportId}`)}
                  />
                ))}
              </div>
            ) : (
              <p>現在担当している予約はありません。</p>
            )}
          </div>
        )}

         {(user as any)?.role === 'parent' && (
          <div className="mt-4">
            <h2 className="text-2xl font-semibold mb-4">予約一覧</h2>
             {bookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    userRole="parent"
                    onParentCancelClick={() => {
                      setBookingToCancel({
                         id: booking.id.toString(),
                         date: booking.date,
                         startTime: booking.startTime,
                         endTime: booking.endTime,
                         subject: booking.subject,
                         studentName: booking.studentName,
                         tutorName: booking.tutorName,
                         studentId: booking.studentId
                      });
                      setShowCancelModal(true);
                    }}
                    onViewReport={() => router.push(`/reports/${booking.reportId}`)}
                  />
                ))}
              </div>
            ) : (
              <p>現在予約はありません。</p>
            )}
          </div>
         )}

        {/* 未対応ロールの場合の表示 */}
        {user && (user as any).role !== 'parent' && (user as any).role !== 'tutor' && !isLoadingAuthAndData && (
             <div className="flex flex-col items-center justify-center mt-8">
                 <p className="text-lg text-gray-600">このユーザーロール({(user as any).role})に対応するダッシュボード表示は未実装です。</p>
                  <Button onClick={() => router.push('/')} className="mt-4">
                     ログインページへ戻る
                  </Button>
             </div>
         )}

      </main>

      {/* アクションボタン */}
      {user && (
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-md py-3 pb-4 mt-4 z-10">
              <div className="max-w-7xl mx-auto px-4">
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {(user as any)?.role === 'tutor' ? (
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
                                  // currentTutorId が null でないことを確認してからモーダルを開く
                                  onClick={() => { if (currentTutorId !== null) setIsReportModalOpen(true); else console.warn("Tutor ID not available, cannot open report modal."); }}
                                  // disabled={currentTutorId === null} // もしボタンを無効にしたい場合
                              >
                                  <FileText className="h-4 w-4 mr-2 text-green-600" />
                                  <span className="text-xs md:text-sm font-medium text-gray-900">新規レポート</span>
                              </Button>
                              <Button
                                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                                  // currentTutorId が null でないことを確認してからモーダルを開く
                                   onClick={() => { if (currentTutorId !== null) setIsReportEditModalOpen(true); else console.warn("Tutor ID not available, cannot open report edit modal."); }}
                                   // disabled={currentTutorId === null} // もしボタンを無効にしたい場合
                              >
                                  <FileText className="h-4 w-4 mr-2 text-gray-600" />
                                  <span className="text-xs md:text-sm font-medium text-gray-900">過去レポート</span>
                              </Button>
                          </>
                      ) : (user as any)?.role === 'parent' ? (
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
                      ) : (
                          // 未対応ロールの場合、何も表示しないか、別のメッセージを表示
                          null
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* レポート作成モーダル */}
      {(user as any)?.role === 'tutor' && currentTutorId !== null && (
          <ReportCreationModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              tutorId={currentTutorId}
              onReportCreated={refetchBookings}
          />
      )}

      {/* レポート編集モーダル */}
      {(user as any)?.role === 'tutor' && currentTutorId !== null && (
          <ReportEditModal
              isOpen={isReportEditModalOpen}
              onClose={() => setIsReportEditModalOpen(false)}
              tutorId={currentTutorId}
              onReportUpdated={refetchBookings}
          />
      )}
    </div>
  );
}