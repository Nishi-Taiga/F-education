"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BookingCard } from "@/components/booking-card";
import { CommonHeader } from "@/components/common-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SimpleCalendar } from "@/components/simple-calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { FileText } from "lucide-react";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoadingFromHook } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isInitialLoadingComplete, setIsInitialLoadingComplete] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null);

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
  };

  const loadStudentData = async (authUid: string) => {
    console.log("loadStudentData 開始:", authUid);
    setIsLoadingBookings(true);
    setIsDataLoaded(false);

    if (!authUid) {
      console.log("loadStudentData: authUid is null, exiting.");
      setIsLoadingBookings(false);
      setIsDataLoaded(true);
      setIsInitialLoadingComplete(true);
      return;
    }

    const { data: studentProfile, error: profileError } = await supabase
      .from('student_profile')
      .select('id')
      .eq('user_id', authUid)
      .single();

    console.log("生徒プロフィール取得結果", studentProfile, profileError);

    if (!studentProfile || profileError) {
      console.error('生徒プロフィール取得エラー', profileError);
      setIsLoadingBookings(false);
      toast({
        title: "プロフィール情報が見つかりません",
        description: "生徒プロフィール情報の取得に失敗しました。",
        variant: "destructive",
      });
      setIsDataLoaded(true);
      setIsInitialLoadingComplete(true);
      return;
    }

    console.log("生徒プロフィールIDが取得できました:", studentProfile.id);
    setCurrentStudentId(studentProfile.id);
    await fetchBookingsForStudent(studentProfile.id.toString());

    setIsDataLoaded(true);
    setIsInitialLoadingComplete(true);
    console.log("loadStudentData 完了");
  };

  useEffect(() => {
    if (!isAuthLoadingFromHook && user && user.id && !isDataLoaded) {
      if (user.role === 'student') {
        loadStudentData(user.id.toString());
      } else {
        console.warn("User role is not student:", user.role);
        setIsLoadingBookings(false);
        setIsDataLoaded(true);
        setIsInitialLoadingComplete(true);
      }
    }
  }, [user, isAuthLoadingFromHook, isDataLoaded]);

  if (isAuthLoadingFromHook || (user && user.role === 'student' && !isDataLoaded)) {
    return <div className="flex justify-center items-center h-screen">ローディング...</div>;
  }

  if (!user || user.role !== 'student') {
    console.log("ユーザーが認証されていないか、ロールが生徒ではありません:", user);
    return <div className="flex justify-center items-center h-screen">アクセス権限がありません。</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader title="生徒ダッシュボード" showBackButton={false} />

      <main className="flex-1 py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-2">
          {user?.role === 'student' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">予約・レポート</h2>
              <div className="flex flex-col space-y-4">
                <Button onClick={() => router.push('/search-tutors')} className="w-full">
                  <Calendar className="mr-2 h-4 w-4" /> 授業を予約する
                </Button>
                <Button variant="outline" onClick={() => router.push('/reports')} className="w-full">
                  <FileText className="mr-2 h-4 w-4 text-gray-600" /> 授業レポートを見る
                </Button>
              </div>
            </Card>
          )}

          <div className="md:col-span-1">
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
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">カレンダー</h2>
              <SimpleCalendar bookings={bookings} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
} 