import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfWeek, subDays, addWeeks, subWeeks, isEqual, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { timeSlots } from "@shared/schema";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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
        isAvailable: existingShift ? existingShift.isAvailable : true,
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
  
  // シフトの変更を処理
  const handleShiftToggle = (date: string, timeSlot: string, currentValue: boolean) => {
    updateShiftMutation.mutate({
      date,
      timeSlot,
      isAvailable: !currentValue
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
      <h1 className="text-2xl font-bold mb-6">シフト管理</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>シフト設定</CardTitle>
          <CardDescription>
            各時間帯ごとに授業可能なシフトを設定してください。
            スイッチがONの場合は授業可能、OFFの場合は授業不可を意味します。
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
                  {weekShifts.map((day) => (
                    <th 
                      key={day.date} 
                      className={`p-2 text-center font-medium ${
                        day.date === formattedToday ? "bg-primary/10" : ""
                      }`}
                    >
                      <div>{day.formattedDate}</div>
                      <div className="text-sm">({day.dayOfWeek})</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot) => (
                  <tr key={timeSlot} className="border-t">
                    <td className="p-2 font-medium">{timeSlot}</td>
                    {weekShifts.map((day) => {
                      const shiftInfo = day.shifts[timeSlot];
                      const isPast = parseISO(day.date) < subDays(new Date(), 1);
                      
                      return (
                        <td 
                          key={`${day.date}-${timeSlot}`} 
                          className={`p-2 text-center ${
                            day.date === formattedToday ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="flex justify-center">
                            <Switch
                              checked={shiftInfo?.isAvailable ?? true}
                              onCheckedChange={() => 
                                handleShiftToggle(
                                  day.date, 
                                  timeSlot, 
                                  shiftInfo?.isAvailable ?? true
                                )
                              }
                              disabled={isPast || updateShiftMutation.isPending}
                            />
                          </div>
                          <div className="text-xs mt-1 text-muted-foreground">
                            {shiftInfo?.isAvailable ? "可能" : "不可"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6">
            <Separator className="my-4" />
            <div className="text-sm text-muted-foreground">
              <p>※ 過去の日付のシフトは変更できません</p>
              <p>※ シフトの変更は即時に反映されます</p>
              <p>※ 既に予約が入っている時間帯は、予約をキャンセルしない限りシフトを変更できません</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}