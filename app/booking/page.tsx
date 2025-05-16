"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

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
  const [selectedTutor, setSelectedTutor] = useState<number | null>(null);
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
        
        // チケット残数の取得（例）
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
          
        if (!tutorError && tutorData) {
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
  const fetchTimeSlots = async (date: Date, tutorId: number | null, subject: string) => {
    // この実装ではダミーデータを使用
    // 実際の実装では、サーバーからデータを取得する
    
    const formattedDate = format(date, 'yyyy-MM-dd');
    
    // ダミーの時間スロットを生成
    const dummySlots: TimeSlot[] = [];
    
    // 9:00から17:00まで1時間おきに生成
    for (let hour = 9; hour < 17; hour++) {
      const startHour = `${hour.toString().padStart(2, '0')}:00`;
      const endHour = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      // ランダムに利用可能かどうかを設定
      const isAvailable = Math.random() > 0.3;
      
      dummySlots.push({
        id: `slot-${formattedDate}-${hour}`,
        tutorId: tutorId || 1,
        date: date,
        startTime: startHour,
        endTime: endHour,
        isAvailable: isAvailable,
      });
    }
    
    setTimeSlots(dummySlots);
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
    const numericId = parseInt(tutorId, 10);
    setSelectedTutor(numericId);
    if (selectedDate) {
      fetchTimeSlots(selectedDate, numericId, selectedSubject);
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
        <div className="loader">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">授業予約</h1>
        <Button onClick={() => router.push('/dashboard')} variant="outline">戻る</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左側: フィルターと講師選択 */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>フィルター</CardTitle>
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
                <Select value={selectedTutor?.toString() || ""} onValueChange={handleTutorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="講師を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべての講師</SelectItem>
                    {tutors.map((tutor) => (
                      <SelectItem key={tutor.id} value={tutor.id.toString()}>
                        {tutor.lastName} {tutor.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4">
                <p className="text-sm font-medium mb-2">残りチケット: {remainingTickets}枚</p>
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
          
          {/* カレンダー */}
          <Card>
            <CardHeader>
              <CardTitle>日付選択</CardTitle>
              <CardDescription>授業を受けたい日を選択</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                className="rounded-md border"
                locale={ja}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* 右側: 時間スロット */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                {selectedDate && format(selectedDate, 'yyyy年MM月dd日 (EEE)', { locale: ja })}の授業時間
              </CardTitle>
              <CardDescription>
                {selectedTutor 
                  ? `講師: ${tutors.find(t => t.id === selectedTutor)?.lastName} ${tutors.find(t => t.id === selectedTutor)?.firstName}`
                  : "講師を選択してください"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        slot.isAvailable 
                          ? 'hover:bg-blue-50 border-blue-200 cursor-pointer' 
                          : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={() => slot.isAvailable && handleTimeSlotSelect(slot)}
                      disabled={!slot.isAvailable}
                    >
                      <div className="font-medium">{slot.startTime} - {slot.endTime}</div>
                      <div className="text-sm text-gray-500">
                        {slot.isAvailable ? "予約可能" : "予約不可"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  この日の授業スケジュールはありません
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* 予約確認モーダル */}
      {showConfirmModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">予約確認</h3>
            <p className="mb-4">以下の内容で予約を確定しますか？</p>
            
            <div className="space-y-2 mb-6">
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
                <span className="text-gray-600">残りチケット:</span>
                <span className="font-medium">{remainingTickets - 1}枚</span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
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
              <div className="mt-4 text-red-500 text-sm text-center">
                チケットが不足しています。先にチケットを購入してください。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
