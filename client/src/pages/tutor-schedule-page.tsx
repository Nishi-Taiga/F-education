import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfWeek, subDays, addWeeks, subWeeks, isEqual, parseISO, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { timeSlots } from "@shared/schema";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Home, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// シフト情報の型定義
type Shift = {
  id: number;
  tutorId: number;
  date: string;
  timeSlot: string;
  subject: string;
  schoolLevel: string | null;
  isAvailable: boolean;
  createdAt: string;
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
    };
  };
};

export default function TutorSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [pendingShifts, setPendingShifts] = useState<Array<{
    date: string;
    timeSlot: string;
    isAvailable: boolean;
  }>>([]);
  
  // 現在の週の開始日（日曜日）
  const [weekStart, setWeekStart] = useState(() => {
    // 今日の日付から直近の日曜日を計算
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });
  
  // 講師プロフィールの取得
  const { data: tutorProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/tutor/profile"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor profile");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor profile:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!user && user.role === "tutor"
  });
  
  // シフト情報の取得
  const { data: shifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ["/api/tutor/shifts"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/shifts");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor shifts");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor shifts:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!tutorProfile
  });
  
  // シフト更新のミューテーション
  const updateShiftMutation = useMutation({
    mutationFn: async (data: { date: string; timeSlot: string; isAvailable: boolean }) => {
      const res = await apiRequest("POST", "/api/tutor/shifts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/shifts"] });
      toast({
        title: "シフトを更新しました",
        description: "シフト情報が正常に保存されました。",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // 一週間分の日付を生成
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date: format(date, "yyyy-MM-dd"),
      formattedDate: format(date, "M/d", { locale: ja }),
      dayOfWeek: format(date, "E", { locale: ja }),
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
        shift.date === day.date && shift.timeSlot === timeSlot
      );
      
      dayShifts.shifts[timeSlot] = {
        exists: !!existingShift,
        isAvailable: existingShift ? existingShift.isAvailable : false, // デフォルトでOFF（不可）に設定
        id: existingShift?.id
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
      shift => shift.date === date && shift.timeSlot === timeSlot
    );
    
    // 新しい値
    const newIsAvailable = !currentValue;
    
    if (existingIndex >= 0) {
      // 既に変更が予定されている場合は更新
      const updatedShifts = [...pendingShifts];
      updatedShifts[existingIndex] = {
        ...updatedShifts[existingIndex],
        isAvailable: newIsAvailable
      };
      setPendingShifts(updatedShifts);
    } else {
      // 新しい変更を追加
      setPendingShifts([
        ...pendingShifts,
        {
          date,
          timeSlot,
          isAvailable: newIsAvailable
        }
      ]);
    }
  };
  
  // すべての保留中のシフト変更を保存
  const saveAllPendingShifts = async () => {
    if (pendingShifts.length === 0) {
      toast({
        title: "変更はありません",
        description: "保存する変更がありません。",
      });
      return;
    }
    
    // シフト変更を一括保存
    for (const shift of pendingShifts) {
      try {
        await updateShiftMutation.mutateAsync(shift);
      } catch (error) {
        // エラーが発生してもすべてのシフトを保存するために続行
        console.error("シフト保存エラー:", error);
      }
    }
    
    // 保存完了後に保留中のシフトをクリア
    setPendingShifts([]);
    
    toast({
      title: "シフトの変更を保存しました",
      description: `${pendingShifts.length}件のシフト変更が保存されました。`,
    });
  };
  
  // 講師でない場合はリダイレクト
  useEffect(() => {
    if (user && user.role !== "tutor") {
      navigate("/");
    }
  }, [user, navigate]);
  
  // プロフィールが未登録の場合はプロフィール設定ページにリダイレクト
  useEffect(() => {
    if (user?.role === "tutor" && !isLoadingProfile && !tutorProfile) {
      toast({
        title: "プロフィールを登録してください",
        description: "シフトを登録する前に、まずプロフィール情報を入力してください。",
        variant: "destructive",
      });
      navigate("/tutor/profile");
    }
  }, [tutorProfile, isLoadingProfile, navigate, toast, user]);
  
  // 今日の日付
  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");
  
  // 読み込み中の表示
  if (isLoadingProfile) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">シフト管理</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            ホームに戻る
          </Button>
          <Button
            variant="default"
            onClick={saveAllPendingShifts}
            disabled={pendingShifts.length === 0 || updateShiftMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            変更を保存 {pendingShifts.length > 0 && `(${pendingShifts.length}件)`}
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
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              前の週
            </Button>
            
            <div className="text-center">
              <h3 className="text-lg font-medium">
                {format(weekStart, "yyyy年M月d日", { locale: ja })} 〜{" "}
                {format(addDays(weekStart, 6), "M月d日", { locale: ja })}
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToCurrentWeek} 
                className="text-sm text-muted-foreground mt-1"
              >
                今週に戻る
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextWeek}
            >
              次の週
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
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
                        shift => shift.date === day.date && shift.timeSlot === timeSlot
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
                          <div className="flex justify-center">
                            <Switch
                              checked={
                                // 保留中の変更があればそれを表示
                                pendingShifts.find(
                                  shift => shift.date === day.date && shift.timeSlot === timeSlot
                                )?.isAvailable ?? 
                                // なければ既存の設定を表示
                                (shiftInfo?.isAvailable ?? false)
                              }
                              onCheckedChange={() => 
                                handleShiftToggle(
                                  day.date, 
                                  timeSlot, 
                                  // 保留中の変更があればそれを基準に切り替え
                                  pendingShifts.find(
                                    shift => shift.date === day.date && shift.timeSlot === timeSlot
                                  )?.isAvailable ?? 
                                  // なければ既存の設定を基準に切り替え
                                  (shiftInfo?.isAvailable ?? false)
                                )
                              }
                              disabled={isPast || updateShiftMutation.isPending}
                            />
                          </div>
                          <div className={`text-xs mt-1 ${isPending ? "font-medium text-yellow-600" : "text-muted-foreground"}`}>
                            {pendingShifts.find(
                              shift => shift.date === day.date && shift.timeSlot === timeSlot
                            )?.isAvailable ?? 
                            (shiftInfo?.isAvailable ?? false) ? "可能" : "不可"}
                            {isPending && " (未保存)"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button
              variant="default"
              onClick={saveAllPendingShifts}
              disabled={pendingShifts.length === 0 || updateShiftMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              変更を保存 {pendingShifts.length > 0 && `(${pendingShifts.length}件)`}
            </Button>
          </div>
          
          <div className="mt-6">
            <Separator className="my-4" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>※ 過去の日付のシフトは変更できません</p>
              <p>※ 変更は「変更を保存」ボタンを押すまで反映されません</p>
              <p>※ 黄色でハイライトされている項目は未保存の変更です</p>
              <p>※ 既に予約が入っている時間帯は、予約をキャンセルしない限りシフトを変更できません</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}