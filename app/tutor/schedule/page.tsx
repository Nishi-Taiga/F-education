'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfWeek, subDays, addWeeks, subWeeks, parseISO, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Home, Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// シフト情報の型定義
type Shift = {
  id: number;
  tutor_id: string;
  date: string;
  time_slot: string;
  subject: string;
  is_available: boolean;
  created_at: string;
};

type DayShift = {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  shifts: {
    [key: string]: {
      exists: boolean;
      isAvailable: boolean;
      id?: number;
      subject?: string;
    };
  };
};

// 利用可能な時間枠の定義
const timeSlots = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
  '20:00-21:00'
];

export default function TutorSchedulePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [pendingShifts, setPendingShifts] = useState<Array<{
    date: string;
    time_slot: string;
    is_available: boolean;
  }>>([]);
  
  // 現在の週の開始日（日曜日）
  const [weekStart, setWeekStart] = useState(() => {
    // 今日の日付から直近の日曜日を計算
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });
  
  // 講師プロフィールの取得
  const [tutorProfile, setTutorProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  // シフト情報の取得
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // ユーザー情報を取得
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // ユーザーの役割を取得
          const { data: userData, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (error) throw error;
          
          setUser({ ...user, role: userData.role });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        toast({
          title: 'エラーが発生しました',
          description: 'ユーザー情報の取得中にエラーが発生しました。',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingUser(false);
      }
    };
    
    fetchUser();
  }, [supabase]);
  
  // 講師プロフィールを取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      if (!user || user.role !== 'tutor') return;
      
      setIsLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('tutors')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        
        setTutorProfile(data);
      } catch (error) {
        console.error('Error fetching tutor profile:', error);
        toast({
          title: 'エラーが発生しました',
          description: '講師プロフィールの取得中にエラーが発生しました。',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchTutorProfile();
  }, [user, supabase]);
  
  // シフト情報を取得
  useEffect(() => {
    const fetchShifts = async () => {
      if (!tutorProfile) return;
      
      setIsLoadingShifts(true);
      try {
        const { data, error } = await supabase
          .from('tutor_shifts')
          .select('*')
          .eq('tutor_id', tutorProfile.id);
        
        if (error) throw error;
        
        setShifts(data || []);
      } catch (error) {
        console.error('Error fetching shifts:', error);
        toast({
          title: 'エラーが発生しました',
          description: 'シフト情報の取得中にエラーが発生しました。',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingShifts(false);
      }
    };
    
    fetchShifts();
  }, [tutorProfile, supabase]);
  
  // 一週間分の日付を生成
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      formattedDate: format(date, 'M/d', { locale: ja }),
      dayOfWeek: format(date, 'E', { locale: ja }),
    };
  });
  
  // 一週間のシフトデータを整形
  const weekShifts: DayShift[] = weekDays.map(day => {
    const dayShifts: DayShift = {
      ...day,
      shifts: {}
    };
    
    // 各時間枠についてシフト情報を設定
    timeSlots.forEach(timeSlot => {
      const existingShift = shifts?.find((shift: Shift) => 
        shift.date === day.date && shift.time_slot === timeSlot
      );
      
      dayShifts.shifts[timeSlot] = {
        exists: !!existingShift,
        isAvailable: existingShift ? existingShift.is_available : false, // デフォルトでOFF（不可）に設定
        id: existingShift?.id,
        subject: existingShift?.subject
      };
    });
    
    return dayShifts;
  });
  
  // 前の週に移動
  const goToPreviousWeek = () => {
    setWeekStart(prevWeekStart => subWeeks(prevWeekStart, 1));
  };
  
  // 次の週に移動
  const goToNextWeek = () => {
    setWeekStart(prevWeekStart => addWeeks(prevWeekStart, 1));
  };
  
  // 今週に移動
  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };
  
  // シフトの変更を処理（保留中の変更として保存）
  const handleShiftToggle = (date: string, timeSlot: string, currentValue: boolean) => {
    // 既存のシフト情報を確認
    const existingIndex = pendingShifts.findIndex(
      shift => shift.date === date && shift.time_slot === timeSlot
    );
    
    // 新しい値
    const newIsAvailable = !currentValue;
    
    if (existingIndex >= 0) {
      // 既に変更が予定されている場合は更新
      const updatedShifts = [...pendingShifts];
      updatedShifts[existingIndex] = {
        ...updatedShifts[existingIndex],
        is_available: newIsAvailable
      };
      setPendingShifts(updatedShifts);
    } else {
      // 新しい変更を追加
      setPendingShifts([
        ...pendingShifts,
        {
          date,
          time_slot: timeSlot,
          is_available: newIsAvailable
        }
      ]);
    }
  };
  
  // すべての保留中のシフト変更を保存
  const saveAllPendingShifts = async () => {
    if (pendingShifts.length === 0) {
      toast({
        title: '変更はありません',
        description: '保存する変更がありません。',
      });
      return;
    }
    
    // 保存開始の通知
    toast({
      title: 'シフト設定を保存中...',
      description: `${pendingShifts.length}件のシフト変更を保存しています。`,
    });
    
    setIsSaving(true);
    
    // 保存の失敗回数をカウント
    let failCount = 0;
    
    // シフト変更を一括保存
    for (const shift of pendingShifts) {
      try {
        // 既存のシフトを探す
        const existingShift = shifts.find(
          s => s.date === shift.date && s.time_slot === shift.time_slot
        );
        
        if (existingShift) {
          // 既存のシフトを更新
          const { error } = await supabase
            .from('tutor_shifts')
            .update({ is_available: shift.is_available })
            .eq('id', existingShift.id);
          
          if (error) throw error;
        } else {
          // 新しいシフトを作成
          const { error } = await supabase
            .from('tutor_shifts')
            .insert([{
              tutor_id: tutorProfile.id,
              date: shift.date,
              time_slot: shift.time_slot,
              is_available: shift.is_available,
              subject: tutorProfile.subjects?.[0] || '' // 最初の科目をデフォルトに
            }]);
          
          if (error) throw error;
        }
      } catch (error) {
        // エラーが発生してもすべてのシフトを保存するために続行
        console.error('シフト保存エラー:', error);
        failCount++;
      }
    }
    
    // シフト情報を再取得
    try {
      const { data, error } = await supabase
        .from('tutor_shifts')
        .select('*')
        .eq('tutor_id', tutorProfile.id);
      
      if (error) throw error;
      
      setShifts(data || []);
    } catch (error) {
      console.error('Error refetching shifts:', error);
    }
    
    // 保存完了後に保留中のシフトをクリア
    const totalChanges = pendingShifts.length;
    setPendingShifts([]);
    setIsSaving(false);
    
    // 結果に応じた通知を表示
    if (failCount === 0) {
      toast({
        title: 'シフト設定の保存完了',
        description: `${totalChanges}件のシフト変更がすべて正常に保存されました。`,
        variant: 'default',
      });
    } else {
      toast({
        title: 'シフト設定の保存完了（一部エラー）',
        description: `${totalChanges}件中${totalChanges - failCount}件が保存され、${failCount}件が失敗しました。`,
        variant: 'destructive',
      });
    }
  };
  
  // 講師でない場合はリダイレクト
  useEffect(() => {
    if (!isLoadingUser && user && user.role !== 'tutor') {
      router.push('/');
    }
  }, [user, isLoadingUser, router]);
  
  // プロフィールが未登録の場合はプロフィール設定ページにリダイレクト
  useEffect(() => {
    if (user?.role === 'tutor' && !isLoadingProfile && !tutorProfile) {
      toast({
        title: 'プロフィールを登録してください',
        description: 'シフトを登録する前に、まずプロフィール情報を入力してください。',
        variant: 'destructive',
      });
      router.push('/tutor/profile');
    }
  }, [tutorProfile, isLoadingProfile, router, user]);
  
  // 今日の日付
  const today = new Date();
  const formattedToday = format(today, 'yyyy-MM-dd');
  
  // 読み込み中の表示
  if (isLoadingUser || isLoadingProfile) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">シフト管理</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="text-xs md:text-sm flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4"
          >
            <Home className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden md:inline">ホームに戻る</span>
            <span className="inline md:hidden">ホーム</span>
          </Button>
          <Button
            variant="default"
            onClick={saveAllPendingShifts}
            disabled={pendingShifts.length === 0 || isSaving}
            className="text-xs md:text-sm flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
            ) : (
              <Save className="h-3 w-3 md:h-4 md:w-4" />
            )}
            <span className="hidden md:inline">変更を保存</span>
            <span className="inline md:hidden">保存</span>
            {pendingShifts.length > 0 && <span className="font-medium">({pendingShifts.length})</span>}
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>シフト設定</CardTitle>
          <CardDescription>
            各時間帯ごとに授業可能なシフトを設定してください。
            スイッチがONの場合は授業可能、OFFの場合は授業不可を意味します。
            変更後は「変更を保存」ボタンをクリックして確定してください。
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* 週の選択 */}
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousWeek}
              className="h-8 px-2 text-xs md:text-sm"
            >
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
              <span className="hidden md:inline">前の週</span>
              <span className="inline md:hidden">前週</span>
            </Button>
            
            <div className="text-center mx-1">
              <h3 className="text-sm md:text-lg font-medium">
                <span className="hidden md:inline">
                  {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜{" "}
                  {format(addDays(weekStart, 6), 'M月d日', { locale: ja })}
                </span>
                <span className="inline md:hidden">
                  {format(weekStart, 'M/d', { locale: ja })} 〜{" "}
                  {format(addDays(weekStart, 6), 'M/d', { locale: ja })}
                </span>
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToCurrentWeek} 
                className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 h-6 md:h-8 px-2"
              >
                今週
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextWeek}
              className="h-8 px-2 text-xs md:text-sm"
            >
              <span className="hidden md:inline">次の週</span>
              <span className="inline md:hidden">次週</span>
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-0.5 md:ml-1" />
            </Button>
          </div>
          
          {isLoadingShifts ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">シフトデータを読み込み中...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium"></th>
                    {weekShifts.map((day) => {
                      const date = parseISO(day.date);
                      const dayNum = getDay(date);
                      let textColorClass = "";
                      
                      // 土曜日は青、日曜日は赤
                      if (dayNum === 6) { // 土曜日
                        textColorClass = "text-blue-600";
                      } else if (dayNum === 0) { // 日曜日
                        textColorClass = "text-red-600";
                      }
                      
                      return (
                        <th 
                          key={day.date} 
                          className={`p-2 text-center font-medium ${textColorClass} ${
                            day.date === formattedToday ? "bg-primary/10" : ""
                          }`}
                        >
                          <div>{day.formattedDate}</div>
                          <div className="text-sm">({day.dayOfWeek})</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot) => (
                    <tr key={timeSlot} className="border-t">
                      <td className="p-2 font-medium">{timeSlot}</td>
                      {weekShifts.map((day) => {
                        const date = parseISO(day.date);
                        const dayNum = getDay(date);
                        let textColorClass = "";
                        
                        // 土曜日は青、日曜日は赤
                        if (dayNum === 6) { // 土曜日
                          textColorClass = "text-blue-600";
                        } else if (dayNum === 0) { // 日曜日
                          textColorClass = "text-red-600";
                        }
                        
                        const shiftInfo = day.shifts[timeSlot];
                        const isPast = parseISO(day.date) < subDays(new Date(), 1);
                        
                        // シフトが変更待ちかどうかを確認
                        const isPending = pendingShifts.some(
                          shift => shift.date === day.date && shift.time_slot === timeSlot
                        );
                        
                        return (
                          <td 
                            key={`${day.date}-${timeSlot}`} 
                            className={`p-2 text-center ${textColorClass} ${
                              day.date === formattedToday ? "bg-primary/10" : ""
                            } ${
                              isPending ? "bg-yellow-50" : ""
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <Switch
                                checked={
                                  // 保留中の変更があればそれを表示
                                  pendingShifts.find(
                                    shift => shift.date === day.date && shift.time_slot === timeSlot
                                  )?.is_available ?? 
                                  // なければ既存の設定を表示
                                  (shiftInfo?.isAvailable ?? false)
                                }
                                onCheckedChange={() => 
                                  handleShiftToggle(
                                    day.date, 
                                    timeSlot, 
                                    // 保留中の変更があればそれを基準に切り替え
                                    pendingShifts.find(
                                      shift => shift.date === day.date && shift.time_slot === timeSlot
                                    )?.is_available ?? 
                                    // なければ既存の設定を基準に切り替え
                                    (shiftInfo?.isAvailable ?? false)
                                  )
                                }
                                disabled={isPast || isSaving}
                              />
                              
                              <div className={`text-xs mt-1 ${isPending ? "font-medium text-yellow-600" : "text-muted-foreground"}`}>
                                {pendingShifts.find(
                                  shift => shift.date === day.date && shift.time_slot === timeSlot
                                )?.is_available ?? 
                                (shiftInfo?.isAvailable ?? false) ? "可能" : "不可"}
                                {isPending && " (未保存)"}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            <Button
              variant="default"
              onClick={saveAllPendingShifts}
              disabled={pendingShifts.length === 0 || isSaving}
              className="text-xs md:text-sm flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Save className="h-3 w-3 md:h-4 md:w-4" />
              )}
              <span className="hidden md:inline">変更を保存</span>
              <span className="inline md:hidden">保存</span>
              {pendingShifts.length > 0 && <span className="font-medium">({pendingShifts.length})</span>}
            </Button>
          </div>
          
          <div className="mt-6">
            <Separator className="my-4" />
            <div className="text-xs md:text-sm text-muted-foreground space-y-1">
              <p>※ 過去の日付のシフトは変更できません</p>
              <p>※ 変更は「保存」ボタンを押すまで反映されません</p>
              <p>※ 黄色でハイライトされている項目は未保存の変更です</p>
              <p className="hidden md:block">※ 既に予約が入っている時間帯は、予約をキャンセルしない限りシフトを変更できません</p>
              <p className="block md:hidden">※ 予約済みの時間帯は変更できません</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
