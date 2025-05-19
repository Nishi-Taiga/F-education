"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, addDays, subDays, startOfWeek, addWeeks, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  CalendarRange, 
  Clock, 
  Save,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Database } from '@/types/supabase';

// 時間帯のオプション
const timeOptions = Array.from({ length: 15 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return { value: `${hour.toString().padStart(2, '0')}:${minute}`, label: `${hour}:${minute}` };
});

export default function TutorSchedulePage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tutorProfile, setTutorProfile] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 0 });
  });
  
  // シフト追加モーダル用の状態
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // 講師情報を取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      setLoading(true);
      
      try {
        // セッションチェック
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No active session found");
          // ログイン状態を先にチェックせずに、自動でリダイレクトされるようにする
          return;
        }
        
        console.log("Session found:", session.user.email);
        
        // 講師プロファイルを取得
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (tutorError) {
          console.error("Error fetching tutor profile:", tutorError);
          
          // メールで検索できない場合はIDで再試行
          const { data: tutorDataById, error: tutorErrorById } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (tutorErrorById) {
            console.error("Error fetching tutor profile by ID:", tutorErrorById);
            toast({
              title: "エラー",
              description: "講師情報の取得に失敗しました",
              variant: "destructive",
            });
            return;
          } else if (tutorDataById) {
            console.log("Found tutor profile by ID:", tutorDataById);
            setTutorProfile(tutorDataById);
            
            // シフト情報を取得
            await fetchShifts(tutorDataById.id);
          } else {
            toast({
              title: "講師プロフィールが見つかりません",
              description: "講師プロフィールの設定が必要です",
              variant: "destructive",
            });
            return;
          }
        } else if (tutorData) {
          console.log("Found tutor profile:", tutorData);
          setTutorProfile(tutorData);
          
          // シフト情報を取得
          await fetchShifts(tutorData.id);
        } else {
          toast({
            title: "講師プロフィールが見つかりません",
            description: "講師プロフィールの設定が必要です",
            variant: "destructive",
          });
          return;
        }
      } catch (error: any) {
        console.error("Error in fetchTutorProfile:", error);
        toast({
          title: "エラー",
          description: error.message || "講師情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchTutorProfile();
  }, []);
  
  // シフト情報を取得
  const fetchShifts = async (tutorId: number) => {
    try {
      const { data, error } = await supabase
        .from('tutor_shifts')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('date', { ascending: true });
        
      if (error) {
        throw error;
      }
      
      console.log("Fetched shifts:", data);
      
      // シフトデータを整形
      const formattedShifts = data.map(shift => ({
        id: shift.id,
        date: new Date(shift.date),
        startTime: shift.start_time,
        endTime: shift.end_time,
        isBooked: shift.is_booked,
      }));
      
      setShifts(formattedShifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "エラー",
        description: "シフト情報の取得に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // シフト保存
  const handleSaveShift = async () => {
    if (!selectedDate || !startTime || !endTime || !tutorProfile) {
      toast({
        title: "入力エラー",
        description: "日付と時間を入力してください",
        variant: "destructive",
      });
      return;
    }
    
    // 開始時間が終了時間より後の場合
    if (startTime >= endTime) {
      toast({
        title: "入力エラー",
        description: "終了時間は開始時間より後の時間を設定してください",
        variant: "destructive",
      });
      return;
    }
    
    setSaveLoading(true);
    
    try {
      if (!isRecurring) {
        // 単発シフトの保存
        await saveSingleShift(selectedDate, startTime, endTime);
      } else {
        // 繰り返しシフトの保存
        if (!recurringEndDate || recurringDays.length === 0) {
          toast({
            title: "入力エラー",
            description: "繰り返し設定を入力してください",
            variant: "destructive",
          });
          return;
        }
        
        await saveRecurringShifts(selectedDate, recurringEndDate, recurringDays, startTime, endTime);
      }
      
      toast({
        title: "シフトを保存しました",
        description: "シフト情報が正常に保存されました",
      });
      
      // モーダルを閉じてデータをリロード
      setShowAddShiftModal(false);
      if (tutorProfile) {
        await fetchShifts(tutorProfile.id);
      }
      
      // フォームをリセット
      resetShiftForm();
    } catch (error: any) {
      console.error("Error saving shift:", error);
      toast({
        title: "エラー",
        description: error.message || "シフト情報の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaveLoading(false);
    }
  };
  
  // 単発シフトの保存
  const saveSingleShift = async (date: Date, start: string, end: string) => {
    const { error } = await supabase
      .from('tutor_shifts')
      .insert({
        tutor_id: tutorProfile.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: start,
        end_time: end,
        is_booked: false,
      });
      
    if (error) {
      throw error;
    }
  };
  
  // 繰り返しシフトの保存
  const saveRecurringShifts = async (
    startDate: Date,
    endDate: Date,
    days: number[],
    startTime: string,
    endTime: string
  ) => {
    // 開始日から終了日までの日付を取得
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    // 指定曜日のみのシフトを抽出
    const shiftsToCreate = dateRange.filter(date => days.includes(getDay(date)))
      .map(date => ({
        tutor_id: tutorProfile.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        is_booked: false,
      }));
    
    if (shiftsToCreate.length === 0) {
      throw new Error("指定した条件では登録可能なシフトがありません");
    }
    
    // シフトを一括登録
    const { error } = await supabase
      .from('tutor_shifts')
      .insert(shiftsToCreate);
      
    if (error) {
      throw error;
    }
    
    return shiftsToCreate.length;
  };
  
  // シフト削除
  const handleDeleteShift = async (shiftId: number) => {
    try {
      const { error } = await supabase
        .from('tutor_shifts')
        .delete()
        .eq('id', shiftId);
        
      if (error) {
        throw error;
      }
      
      // シフト一覧を更新
      setShifts(shifts.filter(shift => shift.id !== shiftId));
      
      toast({
        title: "シフトを削除しました",
        description: "シフト情報が正常に削除されました",
      });
    } catch (error: any) {
      console.error("Error deleting shift:", error);
      toast({
        title: "エラー",
        description: error.message || "シフト情報の削除に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // 繰り返し曜日の選択
  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };
  
  // フォームリセット
  const resetShiftForm = () => {
    setSelectedDate(new Date());
    setStartTime('10:00');
    setEndTime('12:00');
    setIsRecurring(false);
    setRecurringEndDate(addDays(new Date(), 30));
    setRecurringDays([]);
  };
  
  // 前の週へ移動
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => subDays(prev, 7));
  };
  
  // 次の週へ移動
  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };
  
  // 今週へ移動
  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };
  
  // ダッシュボードに戻る処理
  const handleBackToDashboard = () => {
    try {
      // ログイン状態を保持するために、単純にルーターを使う
      router.push('/dashboard');
    } catch (error) {
      console.error("Error navigating to dashboard:", error);
      toast({
        title: "エラー",
        description: "ダッシュボードへの遷移に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // 曜日の配列
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  
  // 現在の週の日付を生成
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  // 指定された日付のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => 
      isSameDay(shift.date, date)
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-8">
      {/* ヘッダー部分 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToDashboard}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">シフト登録</h1>
            <p className="text-lg text-muted-foreground mt-1">
              授業可能な日時を登録してください
            </p>
          </div>
        </div>
        
        <Button onClick={() => setShowAddShiftModal(true)} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          シフトを追加
        </Button>
      </div>
      
      {/* メインコンテンツ */}
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center">
              <CalendarRange className="mr-2 h-5 w-5 text-blue-600" />
              <span className="text-xl">
                {format(currentWeekStart, 'yyyy年M月d日', { locale: ja })} -
                {format(addDays(currentWeekStart, 6), 'M月d日', { locale: ja })}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentWeek}
              >
                今週
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">読み込み中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {/* 曜日ヘッダー */}
              {weekdays.map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    "text-center font-medium py-2 rounded-md",
                    i === 0 && "text-red-500",
                    i === 6 && "text-blue-500"
                  )}
                >
                  {day}
                </div>
              ))}
              
              {/* 日付と予約 */}
              {weekDays.map((day, dayIndex) => {
                const dayShifts = getShiftsForDate(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border rounded-md p-2 min-h-[150px] flex flex-col",
                      isSameDay(day, new Date()) && "bg-blue-50 border-blue-200",
                      dayIndex === 0 && "text-red-500",
                      dayIndex === 6 && "text-blue-500"
                    )}
                  >
                    <div className="text-right mb-2 font-medium">
                      {format(day, 'd')}
                    </div>
                    <div className="flex-grow space-y-1 overflow-auto">
                      {dayShifts.length > 0 ? (
                        dayShifts.map(shift => (
                          <div
                            key={shift.id}
                            className={cn(
                              "text-xs p-2 rounded-md border flex justify-between items-center",
                              shift.isBooked
                                ? "bg-blue-100 border-blue-200 text-blue-800"
                                : "bg-green-100 border-green-200 text-green-800"
                            )}
                          >
                            <div>
                              <div className="font-medium">{shift.startTime} - {shift.endTime}</div>
                              <div>{shift.isBooked ? "予約済" : "空き"}</div>
                            </div>
                            {!shift.isBooked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteShift(shift.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-center text-gray-500 py-2">
                          シフトなし
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-2 border-t">
          <div className="w-full text-sm text-gray-500">
            <div className="flex items-center gap-6 justify-center">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200 mr-1.5"></div>
                <span>空きシフト</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200 mr-1.5"></div>
                <span>予約済み</span>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
      
      {/* シフト一覧表示 */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">登録済みシフト一覧</CardTitle>
          <CardDescription>今後の登録シフトを確認できます</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">読み込み中...</span>
            </div>
          ) : shifts.length > 0 ? (
            <div className="space-y-3">
              {shifts
                .filter(shift => shift.date >= new Date()) // 今日以降のシフトのみ表示
                .sort((a, b) => a.date.getTime() - b.date.getTime()) // 日付順にソート
                .slice(0, 10) // 最大10件まで
                .map(shift => (
                  <div
                    key={shift.id}
                    className={cn(
                      "p-3 border rounded-md flex justify-between items-center",
                      shift.isBooked
                        ? "bg-blue-50 border-blue-200"
                        : "bg-green-50 border-green-200"
                    )}
                  >
                    <div>
                      <div className="font-medium">
                        {format(shift.date, 'yyyy/MM/dd (EEE)', { locale: ja })}
                      </div>
                      <div className="text-sm flex items-center mt-1">
                        <Clock className="h-3.5 w-3.5 mr-1 text-gray-500" />
                        {shift.startTime} - {shift.endTime}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {shift.isBooked ? (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          予約済み
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteShift(shift.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          <span>削除</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed rounded-md">
              <CalendarRange className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-muted-foreground">
                登録済みのシフトはありません
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddShiftModal(true)}
              >
                シフトを追加する
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* シフト追加モーダル */}
      <Dialog open={showAddShiftModal} onOpenChange={setShowAddShiftModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>シフト追加</DialogTitle>
            <DialogDescription>
              授業可能な日時を登録してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* 単発 or 繰り返し選択 */}
            <Tabs defaultValue="single" className="w-full" onValueChange={(val) => setIsRecurring(val === 'recurring')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">単発シフト</TabsTrigger>
                <TabsTrigger value="recurring">繰り返しシフト</TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>日付を選択</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={{ before: new Date() }}
                      className="border rounded-md p-3"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="recurring" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>開始日</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: new Date() }}
                    className="border rounded-md p-3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>終了日</Label>
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={{ before: selectedDate }}
                    className="border rounded-md p-3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>繰り返す曜日</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((day, index) => (
                      <Button
                        key={day}
                        type="button"
                        variant={recurringDays.includes(index) ? "default" : "outline"}
                        className={cn(
                          "w-9 h-9 p-0",
                          index === 0 && !recurringDays.includes(index) && "text-red-500",
                          index === 6 && !recurringDays.includes(index) && "text-blue-500"
                        )}
                        onClick={() => toggleRecurringDay(index)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* 時間選択 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時間</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="開始時間を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">終了時間</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="終了時間を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShiftModal(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleSaveShift} 
              disabled={saveLoading}
              className="ml-2"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  シフトを保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}