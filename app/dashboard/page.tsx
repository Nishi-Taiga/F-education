"use client";

import { useRouter } from "next/navigation";
import { useAuth, User, UserRole } from "@/hooks/use-auth";
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
  const { user, isLoading: isAuthLoadingFromHook }: { user: User | null, isLoading: boolean } = useAuth();
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
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null);
  const [isParentDataLoaded, setIsParentDataLoaded] = useState(false);
  const [isTutorDataLoaded, setIsTutorDataLoaded] = useState(false);
  const [isStudentDataLoaded, setIsStudentDataLoaded] = useState(false);

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
        onParentCancelClick: user?.role === 'parent' ? () => {
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
    setIsParentDataLoaded(true);
  };

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
    setIsTutorDataLoaded(true);
  };

  const fetchBookingsForStudent = async (studentProfileId: string) => {
    setIsLoadingBookings(true);
    console.log('Inside fetchBookingsForStudent for studentProfileId:', studentProfileId);
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        student_profile (last_name, first_name),
        tutor_profile (last_name, first_name)
      `)
      .eq('student_id', studentProfileId)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (!bookingsError && bookingsData) {
      console.log('Fetched bookingsData for student:', bookingsData.length, 'bookings:', bookingsData);
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
        onCancelClick: undefined,
      }));
      setBookings(formattedBookings);
      console.log('Bookings state updated for student:', formattedBookings);
    }

    if (bookingsError) {
      console.error('Error fetching bookings for student:', bookingsError);
      toast({
        title: '予約情報の取得に失敗しました',
        description: `データの読み込み中に問題が発生しました: ${bookingsError.message}`,
        variant: 'destructive',
      });
    }

    setIsLoadingBookings(false);
    setIsStudentDataLoaded(true);
  };

  const refetchBookings = async () => {
    console.log("refetchBookings 開始");
    if (user?.role === 'parent' && currentParentId !== null) {
      await fetchBookingsForParent(currentParentId);
    } else if (user?.role === 'tutor' && currentTutorId !== null) {
      await fetchBookingsForTutor(currentTutorId);
    } else if (user?.role === 'student' && currentStudentId !== null) {
      await fetchBookingsForStudent(currentStudentId.toString());
    } else {
      console.warn("refetchBookings: 予約再取得に必要な情報が不足しています。");
      setIsLoadingBookings(false);
    }
    console.log("refetchBookings 完了");
  };

  const loadParentOrTutorData = async (authId: string, role: string) => {
    console.log(`loadParentOrTutorData 開始: ${role}`, authId);
    setIsLoadingBookings(true);
    
    if (!authId) {
      console.log(`loadParentOrTutorData: authId is null for ${role}, exiting.`);
      setIsLoadingBookings(false);
      if (role === 'parent') setIsParentDataLoaded(true);
      if (role === 'tutor') setIsTutorDataLoaded(true);
      return null;
    }

    let profileId = null;
    let profileError = null;

    if (role === 'parent') {
      const { data: parent, error } = await supabase
        .from('parent_profile')
        .select('id')
        .eq('user_id', authId)
        .single();
      profileId = parent?.id;
      profileError = error;
      console.log("親データ取得結果", parent, error);
      if (profileId) setCurrentParentId(profileId);
      setIsParentDataLoaded(true);

    } else if (role === 'tutor') {
      const { data: tutor, error } = await supabase
        .from('tutor_profile')
        .select('id')
        .eq('user_id', authId)
        .single();
      profileId = tutor?.id;
      profileError = error;
      console.log("講師データ取得結果", tutor, error);
      if (profileId) setCurrentTutorId(profileId);
      setIsTutorDataLoaded(true);
    }

    if (!profileId || profileError) {
      console.error(`${role} プロフィール取得エラー`, profileError);
      toast({
        title: "プロフィール情報が見つかりません",
        description: `${role === 'parent' ? '保護者' : '講師'}プロフィール情報の取得に失敗しました。`,
        variant: "destructive",
      });
      setIsLoadingBookings(false);
      return null;
    }
    
    if (role === 'parent') await fetchBookingsForParent(profileId);
    if (role === 'tutor') await fetchBookingsForTutor(profileId);

    console.log(`${role} loadData 完了`);
    return profileId;
  };

  const loadStudentData = async (authId: string) => {
    console.log("loadStudentData 開始:", authId);
    setIsLoadingBookings(true);
    
    if (!authId) {
      console.log("loadStudentData: authId is null, exiting.");
      setIsLoadingBookings(false);
      setIsStudentDataLoaded(true);
      return null;
    }

    const { data: studentProfile, error: profileError } = await supabase
      .from('student_profile')
      .select('id')
      .eq('user_id', authId)
      .single();

    console.log("生徒プロフィール取得結果", studentProfile, profileError);

    if (!studentProfile || profileError) {
      console.error('生徒プロフィール取得エラー', profileError);
      toast({
        title: "プロフィール情報が見つかりません",
        description: "生徒プロフィール情報の取得に失敗しました。",
        variant: "destructive",
      });
      setIsLoadingBookings(false);
      setIsStudentDataLoaded(true);
      return null;
    }

    console.log("生徒プロフィールIDが取得できました:", studentProfile.id);
    setCurrentStudentId(studentProfile.id);
    await fetchBookingsForStudent(studentProfile.id.toString());

    setIsLoadingBookings(false);
    setIsStudentDataLoaded(true);
    console.log("loadStudentData 完了");
    return studentProfile.id;
  };

  const handleCancelBooking = async (bookingId: string, studentId: string, parentId: number) => {
    setShowCancelModal(false);
    setBookingToCancel(null);

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
    }

    toast({
      title: 'キャンセル完了',
      description: '予約が正常にキャンセルされました。チケットの返却に問題があった場合はお問い合わせください。'
    });

    refetchBookings();
  };

  useEffect(() => {
    console.log("Dashboard useEffect running.", { user, isAuthLoadingFromHook, isParentDataLoaded, isTutorDataLoaded, isStudentDataLoaded });

    if (!isAuthLoadingFromHook && user && user.auth_id) {
      if (user.role === 'parent' && !isParentDataLoaded) {
        console.log("useEffect: Loading parent data...");
        loadParentOrTutorData(user.auth_id, 'parent');
      } else if (user.role === 'tutor' && !isTutorDataLoaded) {
        console.log("useEffect: Loading tutor data...");
        loadParentOrTutorData(user.auth_id, 'tutor');
      } else if (user.role === 'student' && !isStudentDataLoaded) {
        console.log("useEffect: Loading student data...");
        loadStudentData(user.auth_id);
      } else if (user.role && (isParentDataLoaded || isTutorDataLoaded || isStudentDataLoaded)) {
        console.log("useEffect: Data already loaded for role:", user.role);
        setIsInitialLoadingComplete(true);
      } else if (!user.role) {
        console.warn("useEffect: User object found but role is missing.", user);
        setIsInitialLoadingComplete(true);
      }
    } else if (!isAuthLoadingFromHook && !user) {
      console.log("useEffect: Auth loading complete, but no user found. User is not authenticated.");
      setIsInitialLoadingComplete(true);
      setIsLoadingBookings(false);
    }

    if (!isAuthLoadingFromHook) {
      if (user?.role === 'parent' && isParentDataLoaded) {
        setIsInitialLoadingComplete(true);
      } else if (user?.role === 'tutor' && isTutorDataLoaded) {
        setIsInitialLoadingComplete(true);
      } else if (user?.role === 'student' && isStudentDataLoaded) {
        setIsInitialLoadingComplete(true);
      } else if (!user) {
        setIsInitialLoadingComplete(true);
      }
    }

  }, [user, isAuthLoadingFromHook, isParentDataLoaded, isTutorDataLoaded, isStudentDataLoaded, loadParentOrTutorData, loadStudentData]);

  const isDashboardLoading = isAuthLoadingFromHook || (user?.role === 'parent' && !isParentDataLoaded) || (user?.role === 'tutor' && !isTutorDataLoaded) || (user?.role === 'student' && !isStudentDataLoaded);

  if (!isInitialLoadingComplete || !user || !user.role || !['parent', 'tutor', 'student'].includes(user.role)) {
    if (!isInitialLoadingComplete) {
      return <div className="flex justify-center items-center h-screen">初期データを読み込み中...</div>;
    } else if (!user) {
      return <div className="flex justify-center items-center h-screen">認証されていません。</div>;
    } else if (!user.role || !['parent', 'tutor', 'student'].includes(user.role)) {
      return <div className="flex justify-center items-center h-screen">アクセス権限がありません。</div>;
    }
    return <div className="flex justify-center items-center h-screen">ダッシュボードを読み込み中...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader userRole={user?.role} title={`${user?.role === 'parent' ? '保護者' : user?.role === 'tutor' ? '講師' : '生徒'}ダッシュボード`} showBackButton={false} />

      <main className="flex-1 py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-2">
          <Card className="p-6 md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">カレンダー</h2>
            {isLoadingBookings ? (
               <div>カレンダー情報を読み込み中...</div>
            ) : (
               <SimpleCalendar bookings={bookings} />
            )}
          </Card>

          {user?.role === 'parent' && (
            <>
            <div className="md:col-span-2">
               <Card className="p-6 mb-6">
                 <h2 className="text-xl font-semibold mb-4">今後の予約</h2>
                 {isLoadingBookings ? (
                   <div>予約情報を読み込み中...</div>
                 ) : bookings.length > 0 ? (
                   <div className="space-y-4 max-h-[400px] overflow-y-auto">
                     {bookings.map((booking: any) => (
                       <BookingCard key={booking.id} booking={booking} userRole={user?.role} onParentCancelClick={() => {
                           setBookingToCancel(booking);
                           setShowCancelModal(true);
                       }} />
                     ))}
                   </div>
                 ) : (
                   <div>今後の予約はありません。</div>
                 )}
               </Card>
            </div>
            </>
          )}

          {user?.role === 'student' && (
             <>
             <div className="md:col-span-2">
               <Card className="p-6 mb-6">
                 <h2 className="text-xl font-semibold mb-4">今後の予約</h2>
                 {isLoadingBookings ? (
                   <div>読み込み中...</div>
                 ) : bookings.length > 0 ? (
                   <div className="space-y-4 max-h-[400px] overflow-y-auto">
                     {bookings.map((booking: any) => (
                       <BookingCard
                         key={booking.id}
                         booking={booking}
                         userRole={'student'}
                       />
                     ))}
                   </div>
                 ) : (
                   <div>今後の予約はありません。</div>
                 )}
               </Card>
             </div>
             </>
          )}

          {user?.role === 'tutor' && (
             <>
            <div className="md:col-span-2">
               <Card className="p-6 mb-6">
                 <h2 className="text-xl font-semibold mb-4">今後の担当予約</h2>
                 {isLoadingBookings ? (
                   <div>担当予約情報を読み込み中...</div>
                 ) : bookings.length > 0 ? (
                   <div className="space-y-4 max-h-[400px] overflow-y-auto">
                     {bookings.map((booking: any) => (
                       <BookingCard key={booking.id} booking={booking} userRole={user?.role} />
                     ))}
                   </div>
                 ) : (
                   <div>今後の担当予約はありません。</div>
                 )}
               </Card>
            </div>
             </>
          )}

        </div>
      </main>

      {/* フッターボタン */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 flex justify-around items-center z-10">
        {user?.role === 'parent' && (
          <>
            <Button variant="outline" onClick={() => router.push('/tickets')} className="flex flex-col items-center text-center">
              <Ticket className="h-5 w-5" />
              <span>チケット購入</span>
            </Button>
            <Button variant="outline" onClick={() => router.push('/booking')} className="flex flex-col items-center text-center">
              <Calendar className="h-5 w-5" />
              <span>授業予約</span>
            </Button>
            <Button variant="outline" onClick={() => router.push('/reports')} className="flex flex-col items-center text-center">
              <FileText className="h-5 w-5" />
              <span>授業レポート</span>
            </Button>
          </>
        )}
        {user?.role === 'student' && (
          <>
            <Button variant="outline" onClick={() => router.push('/booking')} className="flex flex-col items-center text-center">
              <Calendar className="h-5 w-5" />
              <span>授業予約</span>
            </Button>
            <Button variant="outline" onClick={() => router.push('/reports')} className="flex flex-col items-center text-center">
              <FileText className="h-5 w-5" />
              <span>授業レポート</span>
            </Button>
          </>
        )}
        {user?.role === 'tutor' && (
          <>
            <Button variant="outline" onClick={() => router.push('/tutor/schedule')} className="flex flex-col items-center text-center">
              <Calendar className="h-5 w-5" />
              <span>シフト管理</span>
            </Button>
            <Button variant="outline" onClick={() => setIsReportModalOpen(true)} className="flex flex-col items-center text-center">
              <FileText className="h-5 w-5" />
              <span>新規レポート</span>
            </Button>
            <Button variant="outline" onClick={() => router.push('/reports?role=tutor')} className="flex flex-col items-center text-center">
              <FileText className="h-5 w-5" />
              <span>過去レポート</span>
            </Button>
          </>
        )}
      </footer>

      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予約をキャンセルしますか？</DialogTitle>
            <DialogDescription>
              以下の予約をキャンセルします。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          {bookingToCancel && (
            <div className="py-4">
              <p><strong>授業:</strong> {bookingToCancel.subject}</p>
              <p><strong>日時:</strong> {bookingToCancel.date.toLocaleDateString()} {bookingToCancel.startTime} - {bookingToCancel.endTime}</p>
              <p><strong>生徒:</strong> {bookingToCancel.studentName}</p>
              <p><strong>講師:</strong> {bookingToCancel.tutorName}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>キャンセルしない</Button>
            <Button variant="destructive" onClick={() => {
                if (bookingToCancel && user?.id && currentParentId !== null) {
                    handleCancelBooking(bookingToCancel.id, bookingToCancel.studentId, currentParentId);
                }
            }}>キャンセルする</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user?.role === 'tutor' && (
          <>
             <ReportCreationModal
               isOpen={isReportModalOpen}
               onClose={() => setIsReportModalOpen(false)}
               onReportCreated={() => {
                  setIsReportModalOpen(false);
                   refetchBookings();
               }}
               tutorId={currentTutorId}
             />
              {user.role === 'tutor' && currentTutorId !== null && (
                 <ReportEditModal
                   isOpen={isReportEditModalOpen}
                   onClose={() => setIsReportEditModalOpen(false)}
                    onReportUpdated={() => {
                      setIsReportEditModalOpen(false);
                       refetchBookings();
                    }}
                    tutorId={currentTutorId}
                  />
              )}
          </>
       )}

    </div>
  );
}