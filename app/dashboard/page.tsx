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
import { ReportCreationModal } from "@/components/report-creation-modal";
import { ReportEditModal } from "@/components/report-edit-modal";

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
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isInitialLoadingComplete, setIsInitialLoadingComplete] = useState(false);
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
      if (user?.role === 'parent' && currentParentId !== null) {
          await fetchBookingsForParent(currentParentId);
      } else if (user?.role === 'tutor' && currentTutorId !== null) {
          await fetchBookingsForTutor(currentTutorId);
      } else {
           console.warn("refetchBookings: 予約再取得に必要な情報が不足しています。");
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

  const loadUserData = async (authUid: string) => {
    console.log("loadUserData 開始:", authUid);
    setIsLoadingParentId(true);
    setIsLoadingBookings(true);
    setIsDataLoaded(false); // loadUserDataが呼ばれたらデータはまだロード中とマーク

    if (!user || !user.auth_id) {
        console.log("loadUserData: user or auth_id is null, exiting.");
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        setIsDataLoaded(true); // データロードは行わないが、ロード処理としては完了とマーク
        setIsInitialLoadingComplete(true); // 初期ロード完了
        return;
    }

    let parentOrTutorLoaded = false;

    if (user.role === 'parent') {
      console.log("loadUserData: ロールは保護者です。");
      const { data: parent, error: parentError } = await supabase
        .from('parent_profile')
        .select('id')
        .eq('user_id', authUid)
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

            return {
              ...student,
              ticketCount: ticketCount,
            };
          }));

          console.log("生徒情報＋チケット数", studentsWithTickets);
          setStudents(studentsWithTickets);
        } else {
          console.error("生徒情報取得エラー", studentsError);
        }
        parentOrTutorLoaded = true; // 親データのロードが成功
      }

    } else if (user.role === 'tutor') {
      console.log("loadUserData: ロールは講師です。");
      const { data: tutor, error: tutorError } = await supabase
        .from('tutor_profile')
        .select('id')
        .eq('user_id', authUid)
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
        console.warn("loadUserData: 未対応のユーザーロールです", user.role);
        setIsLoadingParentId(false);
        setIsLoadingBookings(false);
        toast({
          title: "エラー",
          description: `未対応のユーザーロールです: ${user.role}`,
          variant: "destructive",
        });
        // 未対応ロールの場合、データロードは完了したものとして扱う
        parentOrTutorLoaded = true;
    }

    // ユーザーロールに基づいたデータのロードが完了した場合のみ isDataLoaded を true にする
    // エラーまたは未対応ロールの場合も、ロード処理としては完了
    setIsDataLoaded(true);
    console.log("loadUserData 完了: isDataLoaded =", true);

    // loadUserDataが完了したら、setIsInitialLoadingCompleteをtrueに設定
    // これにより、ロードが完了するまでローディング表示が維持される
    setIsInitialLoadingComplete(true);
    console.log("setIsInitialLoadingComplete を true に設定");
  };

  // Main effect for authentication and data loading
  useEffect(() => {
    console.log(`useEffect: user is ${user ? "present" : "null"} and auth loading is ${isAuthLoadingFromHook ? "incomplete" : "complete"}.`);

    // 認証状態のロードが完了したら（isAuthLoadingFromHookがfalseになったら）処理を進める
    if (isAuthLoadingFromHook === false) {
      console.log('Auth loading complete. Final check on user state.', { userAtComplete: user });
      // userが確定的にnullであればログインページにリダイレクトし、初期ロード完了とする
      if (!user) {
        console.log('Auth loading complete and user is definitively null. Redirecting to /auth/.');
        router.push("/auth/");
        setIsInitialLoadingComplete(true); // ログインページにリダイレクトする場合も初期ロード完了とする
      } else { // userが確定的にnullでなければ（認証済みであれば）
         console.log('Auth loading complete and user is present. Proceeding with data load if needed.', user);
         // データがまだロードされていなければ、ロードを開始
         if (!isDataLoaded) {
            // loadUserData内でデータロード完了後、setIsDataLoaded(true)とsetIsInitialLoadingComplete(true)を呼び出す
            loadUserData(user.auth_id);
         } else {
            // User present and data already loaded (e.g., returning to the page, hot reload)
            console.log('User present and data already loaded. Initial loading complete.');
            setIsInitialLoadingComplete(true); // 認証済みでデータもすでにロード済みなら初期ロード完了
         }
      }
    } else {
        console.log('Auth loading still in progress or waiting for user state from hook. Setting initial loading incomplete.');
        // 認証情報のロード中は初期ロード未完了状態を維持
        setIsInitialLoadingComplete(false);
    }

    // 依存配列に isAuthLoadingFromHook, user, isDataLoaded, router を含める
    // isDataLoaded の変更も監視し、データロード完了時に setIsInitialLoadingComplete(true) が確実に呼ばれるようにする
  }, [isAuthLoadingFromHook, user, isDataLoaded, router]);

  // Effect to handle data loading completion (Remove as main logic is in the first useEffect)
  // useEffect(() => {
  //   if (isDataLoaded) {
  //     console.log('loadUserData 完了: isDataLoaded =', isDataLoaded);
  //   }
  // }, [isDataLoaded]);

  // Effect to log parent ID loading status
  useEffect(() => {
    if (!isLoadingParentId) {
      console.log('isLoadingParentId is now false. Current Parent ID:', currentParentId);
    }
  }, [isLoadingParentId, currentParentId]);

  // Effect to log tutor ID loading status
  useEffect(() => {
    if (currentTutorId !== null) {
      console.log('Tutor IDが取得できました:', currentTutorId);
    }
  }, [currentTutorId]);

  // Effect to log booking loading status
  useEffect(() => {
    console.log('isLoadingBookings state changed:', isLoadingBookings);
  }, [isLoadingBookings]);

  // Effect to log bookingToCancel state
  useEffect(() => {
    console.log('bookingToCancel state changed:', bookingToCancel);
  }, [bookingToCancel]);

  // Effect to log showCancelModal state
  useEffect(() => {
    console.log('showCancelModal state changed:', showCancelModal);
  }, [showCancelModal]);

  // Effect to log report modal state
  useEffect(() => {
    console.log('isReportModalOpen state changed:', isReportModalOpen);
  }, [isReportModalOpen]);

  // Effect to log report edit modal state
  useEffect(() => {
    console.log('isReportEditModalOpen state changed:', isReportEditModalOpen);
  }, [isReportEditModalOpen]);

  // Effect to log students state
  useEffect(() => {
    console.log('students state updated:', students);
  }, [students]);

  // Render loading state while initial loading is not complete
  // This includes waiting for auth to be fully resolved and data loaded
  if (!isInitialLoadingComplete) {
    console.log('Rendering initial loading state...');
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // Render not authenticated state if initial loading is complete but no user
  // This check happens ONLY after isInitialLoadingComplete is true
  if (!user) {
      console.log('Rendering not authenticated state...');
      return <div className="flex flex-col items-center justify-center h-screen">認証情報がありません。ログインしてください。<Button onClick={() => router.push("/auth/")} className="ml-4">ログイン</Button></div>;
  }

  // Render dashboard if authenticated and initial loading is complete
  console.log('Rendering dashboard...');
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto flex flex-col">
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
        <SimpleCalendar bookings={bookings} userRole={user?.role} />

        {user?.role === 'parent' && (
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
                  <p><strong>日時:</strong> {bookingToCancel.date.toLocaleDateString()} {bookingToCancel.startTime} - {bookingToCancel.endTime}</p>
                  <p><strong>科目:</strong> {bookingToCancel.subject}</p>
                  <p><strong>生徒:</strong> {bookingToCancel.studentName}</p>
                  <p><strong>講師:</strong> {bookingToCancel.tutorName}</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelModal(false)}>キャンセル</Button>
                <Button onClick={() => handleCancelBooking(bookingToCancel.id, bookingToCancel.studentId, currentParentId!)}>確定</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {user?.role === 'tutor' && (
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

         {user?.role === 'parent' && (
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

        {user && user.role !== 'parent' && user.role !== 'tutor' && isDataLoaded && (
             <div className="flex flex-col items-center justify-center mt-8">
                 <p className="text-lg text-gray-600">このユーザーロール({user.role})に対応するダッシュボード表示は未実装です。</p>
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
                      {user.role === 'tutor' ? (
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
                                  onClick={() => setIsReportModalOpen(true)}
                              >
                                  <FileText className="h-4 w-4 mr-2 text-green-600" />
                                  <span className="text-xs md:text-sm font-medium text-gray-900">新規レポート</span>
                              </Button>
                              <Button
                                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
                                  onClick={() => setIsReportEditModalOpen(true)}
                              >
                                  <FileText className="h-4 w-4 mr-2 text-gray-600" />
                                  <span className="text-xs md:text-sm font-medium text-gray-900">過去レポート</span>
                              </Button>
                          </>
                      ) : user.role === 'parent' ? (
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
      {user?.role === 'tutor' && (
          <ReportCreationModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              tutorId={currentTutorId}
              onReportCreated={refetchBookings}
          />
      )}

      {/* レポート編集モーダル */}
      {user?.role === 'tutor' && (
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