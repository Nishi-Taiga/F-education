'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfWeek, subDays, addWeeks, subWeeks, parseISO, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Home, Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase/client';
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

// 利用可能な時間枠の定義 - 指定されたスロットに変更
const timeSlots = [
  '16:00-17:30',
  '18:00-19:30',
  '20:00-21:30'
];

export default function TutorSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
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
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // シフト情報の取得
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // ユーザー情報を取得
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true);
      setAuthError(null);
      
      try {
        // ユーザー情報取得
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setAuthError(error.message);
          return;
        }
        
        if (!session) {
          setAuthError('ユーザーが見つかりません。ログインしてください。');
          router.push('/auth');
          return;
        }
        
        const { data: userData, error: roleError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (roleError) {
          setAuthError(roleError.message);
          return;
        }
        
        setUser({ ...session.user, role: userData?.role || 'unknown' });
      } catch (error: any) {
        setAuthError(error.message || 'ユーザー情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoadingUser(false);
      }
    };
    
    fetchUser();
  }, [router]);
  
  // 講師プロフィールを取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      if (!user) return;
      
      setIsLoadingProfile(true);
      setProfileError(null);
      
      try {
        const { data, error } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            setProfileError('講師プロフィールが見つかりません。プロフィールの設定が必要です。');
          } else {
            setProfileError(error.message);
          }
          return;
        }
        
        setTutorProfile(data);
      } catch (error: any) {
        setProfileError(error.message || '講師プロフィールの取得中にエラーが発生しました。');
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchTutorProfile();
  }, [user]);
  
  // シフト情報を取得
  useEffect(() => {
    const fetchShifts = async () => {
      if (!tutorProfile) {
        setIsLoadingShifts(false);
        return;
      }
      
      setIsLoadingShifts(true);
      setShiftsError(null);
      
      try {
        const { data, error } = await supabase
          .from('tutor_shifts')
          .select('*')
          .eq('tutor_id', tutorProfile.id);
        
        if (error) {
          setShiftsError(error.message);
          return;
        }
        
        setShifts(data || []);
      } catch (error: any) {
        setShiftsError(error.message || 'シフト情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoadingShifts(false);
      }
    };
    
    fetchShifts();
  }, [tutorProfile, weekStart]); // weekStartを依存配列に追加して週が変わるたびにデータを取得
  
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
    let successCount = 0;
    
    try {
      for (const shift of pendingShifts) {
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
          successCount++;
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
          successCount++;
        }
      }
      
      // シフト情報を再取得
      const { data, error } = await supabase
        .from('tutor_shifts')
        .select('*')
        .eq('tutor_id', tutorProfile.id);
      
      if (error) throw error;
      
      setShifts(data || []);
    } catch (error: any) {
      console.error('Error saving shifts:', error);
      failCount = pendingShifts.length - successCount;
      toast({
        title: 'エラーが発生しました',
        description: error.message || 'シフトの保存中にエラーが発生しました。',
        variant: 'destructive',
      });
    } finally {
      // 保存完了後に保留中のシフトをクリア
      const totalChanges = pendingShifts.length;
      setPendingShifts([]);
      setIsSaving(false);
      
      // 結果の通知を表示
      if (failCount === 0) {
        toast({
          title: 'シフト設定の保存完了',
          description: `${totalChanges}件のシフト変更がすべて正常に保存されました。`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'シフト設定の保存完了（一部エラー）',
          description: `${totalChanges}件中${successCount}件が保存され、${failCount}件が失敗しました。`,
          variant: 'destructive',
        });
      }
    }
  };
  
  // 読み込み中の表示
  if (isLoadingUser) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>ユーザー情報を読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // 認証エラーの表示
  if (authError) {
    return (
      <div className="container py-8">
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-500">認証エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{authError}</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/auth')}
            >
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // ユーザーが存在しない場合
  if (!user) {
    return (
      <div className="container py-8">
        <Card className="border-yellow-300">
          <CardHeader>
            <CardTitle className="text-yellow-500">ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p>このページにアクセスするにはログインが必要です。</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/auth')}
            >
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // プロフィールの読み込み中
  if (isLoadingProfile) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>講師プロフィールを読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // プロフィールが未登録の場合
  if (!tutorProfile) {
    return (
      <div className="container py-8">
        <Card className="border-orange-300">
          <CardHeader>
            <CardTitle className="text-orange-500">プロフィール設定が必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{profileError || 'シフトを登録する前に、まずプロフィール情報を入力してください。'}</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/tutor/profile')}
            >
              プロフィール設定へ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // 今日の日付
  const today = new Date();
  const formattedToday = format(today, 'yyyy-MM-dd');
  
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
        <CardContent className="pt-6">
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
          ) : shiftsError ? (
            <div className="py-8 text-center">
              <p className="text-red-500 mb-4">{shiftsError}</p>
              <Button onClick={() => setShiftsError(null)}>再試行</Button>
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
                      const isPast = parseISO(day.date) < subDays(new Date(), 1);
                      let textColorClass = "";
                      
                      // 土曜日は青、日曜日は赤、過去の日付はグレー
                      if (isPast) {
                        textColorClass = "text-gray-400"; // 過去日付のグレーアウト
                      } else if (dayNum === 6) { // 土曜日
                        textColorClass = "text-blue-600"; // 土曜日は青色に
                      } else if (dayNum === 0) { // 日曜日
                        textColorClass = "text-red-600"; // 日曜日は赤色に
                      }
                      
                      return (
                        <th 
                          key={day.date} 
                          className={`p-2 text-center font-medium ${textColorClass} ${
                            day.date === formattedToday ? "bg-primary/10" : ""
                          } ${
                            isPast ? "bg-gray-50" : "" // 過去日付の背景も軽くグレーアウト
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
                        const isPast = parseISO(day.date) < subDays(new Date(), 1);
                        
                        const shiftInfo = day.shifts[timeSlot];
                        
                        // シフトが変更待ちかどうかを確認
                        const isPending = pendingShifts.some(
                          shift => shift.date === day.date && shift.time_slot === timeSlot
                        );

                        // 現在の可否状態を確認（保留中の変更があればそれを優先）
                        const isAvailable = pendingShifts.find(
                          shift => shift.date === day.date && shift.time_slot === timeSlot
                        )?.is_available ?? (shiftInfo?.isAvailable ?? false);
                        
                        return (
                          <td 
                            key={`${day.date}-${timeSlot}`} 
                            className={`p-2 text-center ${
                              day.date === formattedToday ? "bg-primary/10" : ""
                            } ${
                              isPending ? "bg-yellow-50" : ""
                            } ${
                              isPast ? "bg-gray-50 text-gray-400" : "" // 過去日付の背景と文字をグレーアウト
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <Switch
                                checked={isAvailable}
                                onCheckedChange={() => 
                                  handleShiftToggle(
                                    day.date, 
                                    timeSlot, 
                                    isAvailable
                                  )
                                }
                                disabled={isPast || isSaving}
                                className={isAvailable ? "data-[state=checked]:bg-blue-500" : ""} // 可能時（ON時）は青く表示
                              />
                              
                              <div className={`text-xs mt-1 ${
                                isAvailable 
                                  ? "font-medium text-blue-600" // 可能時は青くハイライト
                                  : "text-muted-foreground"
                              } ${
                                isPending ? "font-medium text-yellow-600" : ""
                              } ${
                                isPast ? "text-gray-400" : "" // 過去日付はグレーアウト
                              }`}>
                                {isAvailable ? "可能" : "不可"}
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
