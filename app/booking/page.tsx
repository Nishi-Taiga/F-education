"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Calendar as CalendarIcon, Clock, User, BookOpen, Ticket } from "lucide-react";

// 講師情報の型
type Tutor = {
  id: number;
  firstName: string;
  lastName: string;
  specialization?: string;
  bio?: string;
};

// 予約時間スロットの型
type TimeSlot = {
  id: string;
  tutorId: number;
  date: Date;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export default function BookingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTutor, setSelectedTutor] = useState<string>("all");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [remainingTickets, setRemainingTickets] = useState(0);

  // ユーザー情報とチケット情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          router.push('/');
          return;
        }
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        setUserId(userData.id);
        
        // チケット残数の取得
        const { data: ticketData, error: ticketError } = await supabase
          .from('student_tickets')
          .select('quantity')
          .eq('studentId', userData.id)
          .order('createdAt', { ascending: false })
          .limit(1);
          
        if (!ticketError && ticketData && ticketData.length > 0) {
          setRemainingTickets(ticketData[0].quantity);
        } else {
          setRemainingTickets(0);
        }
        
        // 講師一覧の取得
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutors')
          .select('*');
          
        if (tutorError) {
          console.error("講師情報取得エラー:", tutorError);
          toast({
            title: "エラー",
            description: "講師情報の取得に失敗しました",
            variant: "destructive",
          });
        } else if (tutorData) {
          setTutors(tutorData);
        }
        
        // 初期の時間スロットを取得
        if (selectedDate) {
          fetchTimeSlots(selectedDate, selectedTutor, selectedSubject);
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, toast]);

  // 日付、講師、科目が変更されたら時間スロットを再取得
  const fetchTimeSlots = async (date: Date, tutorId: string, subject: string) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // 講師シフトから利用可能な時間スロットを取得
      let query = supabase
        .from('tutor_shifts')
        .select(`
          *,
          tutors (id, firstName, lastName, specialization)
        `)
        .eq('date', formattedDate)
        .eq('isBooked', false);
      
      // 講師フィルターを適用
      if (tutorId !== "all") {
        query = query.eq('tutorId', parseInt(tutorId));
      }
      
      const { data: shiftData, error: shiftError } = await query;
      
      if (shiftError) {
        console.error("シフト情報取得エラー:", shiftError);
        setTimeSlots([]);
        return;
      }
      
      // シフトデータをTimeSlot形式に変換
      const slots: TimeSlot[] = (shiftData || []).map(shift => ({
        id: shift.id.toString(),
        tutorId: shift.tutorId,
        date: new Date(shift.date),
        startTime: shift.startTime,
        endTime: shift.endTime,
        isAvailable: !shift.isBooked,
      }));
      
      setTimeSlots(slots);
    } catch (error) {
      console.error("時間スロット取得エラー:", error);
      setTimeSlots([]);
    }
  };

  // 日付が変更されたときの処理
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      fetchTimeSlots(date, selectedTutor, selectedSubject);
    }
  };

  // 講師が変更されたときの処理
  const handleTutorChange = (tutorId: string) => {
    setSelectedTutor(tutorId);
    if (selectedDate) {
      fetchTimeSlots(selectedDate, tutorId, selectedSubject);
    }
  };

  // 科目が変更されたときの処理
  const handleSubjectChange = (subject: string) => {
    setSelectedSubject(subject);
    if (selectedDate) {
      fetchTimeSlots(selectedDate, selectedTutor, subject);
    }
  };

  // 時間スロットが選択されたときの処理
  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!slot.isAvailable) return;
    
    setSelectedTimeSlot(slot);
    setShowConfirmModal(true);
  };

  // 予約を確定する処理
  const confirmBooking = async () => {
    if (!selectedTimeSlot || !userId || !selectedDate) return;
    
    try {
      setIsLoading(true);
      
      // チケットの残数チェック
      if (remainingTickets <= 0) {
        toast({
          title: "チケット不足",
          description: "予約にはチケットが必要です。チケットを購入してください。",
          variant: "destructive",
        });
        router.push('/tickets');
        return;
      }
      
      // 予約データの作成
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            studentId: userId,
            tutorId: selectedTimeSlot.tutorId,
            date: format(selectedDate, 'yyyy-MM-dd'),
            startTime: selectedTimeSlot.startTime,
            endTime: selectedTimeSlot.endTime,
            status: 'pending',
            ticketsUsed: 1,
          }
        ]);
        
      if (error) {
        throw error;
      }
      
      // シフトを予約済みに更新
      const { error: shiftError } = await supabase
        .from('tutor_shifts')
        .update({ isBooked: true })
        .eq('id', parseInt(selectedTimeSlot.id));
        
      if (shiftError) {
        console.error("シフト更新エラー:", shiftError);
      }
      
      // チケット残数を更新
      const newRemainingTickets = remainingTickets - 1;
      const { error: ticketError } = await supabase
        .from('student_tickets')
        .update({ quantity: newRemainingTickets })
        .eq('studentId', userId);
        
      if (ticketError) {
        console.error("チケット更新エラー:", ticketError);
      }
      
      setRemainingTickets(newRemainingTickets);
      
      toast({
        title: "予約完了",
        description: "授業の予約が完了しました。",
      });
      
      // モーダルを閉じる
      setShowConfirmModal(false);
      
      // ダッシュボードに戻る
      router.push('/dashboard');
    } catch (error: any) {
      console.error("予約エラー:", error);
      toast({
        title: "予約エラー",
        description: error.message || "予約の作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">授業予約</h1>
            <p className="text-gray-600">希望の日時と講師を選択してください</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <Ticket className="h-4 w-4 text-blue-600" />
          <span className="font-medium">残り {remainingTickets} 枚</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左側: フィルターとカレンダー */}
        <div className="lg:col-span-1 space-y-6">
          {/* フィルター */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>フィルター</span>
              </CardTitle>
              <CardDescription>条件を選択してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">科目</label>
                <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="科目を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての科目</SelectItem>
                    <SelectItem value="math">数学</SelectItem>
                    <SelectItem value="english">英語</SelectItem>
                    <SelectItem value="science">理科</SelectItem>
                    <SelectItem value="japanese">国語</SelectItem>
                    <SelectItem value="social">社会</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">講師</label>
                <Select value={selectedTutor} onValueChange={handleTutorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="講師を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての講師</SelectItem>
                    {tutors.map((tutor) => (
                      <SelectItem key={tutor.id} value={tutor.id.toString()}>
                        {tutor.lastName} {tutor.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* カレンダー */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5" />
                <span>日付選択</span>
              </CardTitle>
              <CardDescription>授業を受けたい日を選択</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                className="rounded-md border"
                locale={ja}
                disabled={(date) => date < new Date() || date.getDay() === 0} // 過去の日付と日曜日を無効化
              />
            </CardContent>
          </Card>
          
          {/* チケット情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Ticket className="h-5 w-5" />
                <span>チケット情報</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">残りチケット</span>
                  <span className="font-bold text-lg">{remainingTickets} 枚</span>
                </div>
                {remainingTickets <= 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/tickets')}
                  >
                    チケットを購入
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 右側: 時間スロット */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>
                  {selectedDate && format(selectedDate, 'yyyy年MM月dd日 (EEE)', { locale: ja })}の授業時間
                </span>
              </CardTitle>
              <CardDescription>
                {selectedTutor !== "all" 
                  ? `講師: ${tutors.find(t => t.id.toString() === selectedTutor)?.lastName} ${tutors.find(t => t.id.toString() === selectedTutor)?.firstName}`
                  : "すべての講師の予約枠を表示しています"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {timeSlots.map((slot) => {
                    const tutor = tutors.find(t => t.id === slot.tutorId);
                    return (
                      <button
                        key={slot.id}
                        className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                          slot.isAvailable 
                            ? 'hover:bg-blue-50 hover:border-blue-300 border-gray-200 cursor-pointer hover:shadow-md' 
                            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        onClick={() => slot.isAvailable && handleTimeSlotSelect(slot)}
                        disabled={!slot.isAvailable}
                      >
                        <div className="space-y-2">
                          <div className="font-medium text-lg">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div className="text-sm text-gray-600">
                            <User className="h-3 w-3 inline mr-1" />
                            {tutor ? `${tutor.lastName} ${tutor.firstName}` : "未設定"}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            slot.isAvailable 
                              ? "bg-green-100 text-green-700" 
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {slot.isAvailable ? "予約可能" : "予約不可"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">この日の授業スケジュールはありません</p>
                  <p className="text-sm text-gray-400 mt-2">別の日付を選択してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* 予約確認モーダル */}
      {showConfirmModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
              予約確認
            </h3>
            <p className="mb-6 text-gray-600">以下の内容で予約を確定しますか？</p>
            
            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600">日付:</span>
                <span className="font-medium">
                  {selectedDate && format(selectedDate, 'yyyy年MM月dd日 (EEE)', { locale: ja })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">時間:</span>
                <span className="font-medium">{selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">講師:</span>
                <span className="font-medium">
                  {tutors.find(t => t.id === selectedTimeSlot.tutorId)?.lastName} 
                  {tutors.find(t => t.id === selectedTimeSlot.tutorId)?.firstName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">使用チケット:</span>
                <span className="font-medium">1枚</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">予約後の残りチケット:</span>
                <span className="font-medium">{remainingTickets - 1}枚</span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={confirmBooking}
                disabled={isLoading || remainingTickets <= 0}
              >
                {isLoading ? "処理中..." : "予約確定"}
              </Button>
            </div>
            
            {remainingTickets <= 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm text-center">
                  チケットが不足しています。先にチケットを購入してください。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
