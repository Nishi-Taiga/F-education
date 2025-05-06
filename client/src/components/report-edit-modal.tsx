import { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, CalendarDays, BookOpen, Loader2, AlertTriangle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLessonReportByBookingId, useCreateLessonReport, useUpdateLessonReport } from "@/hooks/use-lesson-reports";
import { useLocation } from "wouter";

// 内部型定義を使用して柔軟性を確保
interface BookingForReport {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  tutorShiftId?: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string | Date;
  studentName?: string;
  tutorName?: string;
  openEditAfterClose?: boolean;
  // lesson_reportsテーブルから取得したデータ
  lessonReport?: {
    id: number;
    bookingId: number;
    tutorId: number;
    studentId: number | null;
    unitContent: string;
    messageContent: string | null;
    goalContent: string | null;
    createdAt: Date;
    updatedAt: Date;
    date?: string | null;
    timeSlot?: string | null;
  } | null;
}

interface ReportEditModalProps {
  isOpen: boolean;
  booking: BookingForReport;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportEditModal({
  isOpen,
  booking,
  onClose,
  onSuccess
}: ReportEditModalProps) {
  // デバッグ情報の出力
  console.log("レポート編集モーダルが呼び出されました", { isOpen, bookingId: booking?.id });
  
  // 強制的に表示するためのテスト
  useEffect(() => {
    if (isOpen) {
      console.log("レポート編集モーダルが開きました", booking);
    }
  }, [isOpen, booking]);
  const { toast } = useToast();
  const [, setLocation] = useLocation(); // wouter hook
  const [unitContent, setUnitContent] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [goalContent, setGoalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 日付をフォーマット（無効な日付値のエラー処理を追加）
  let formattedDate = "日付不明";
  try {
    if (booking.date && booking.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
      if (!isNaN(dateObj.getTime())) {
        formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
      }
    }
  } catch (error) {
    console.error("Invalid date format:", booking.date);
  }

  // 新しいAPIを使用してレッスンレポートを取得
  const { data: lessonReport, isLoading: isLoadingReport } = useLessonReportByBookingId(
    isOpen ? booking?.id : null
  );
  
  // レッスンレポートの型安全なアクセス用のヘルパー関数
  const getReportField = (report: any, field: string, defaultValue: string = ""): string => {
    if (!report) return defaultValue;
    return (report[field] as string) || defaultValue;
  };
  
  // モーダルが開かれたときに既存のレポート内容を設定する
  useEffect(() => {
    if (isOpen) {
      console.log("ReportEditModal - モーダルが開かれました。予約情報:", booking);
      
      // 1. まず直接渡されたbooking.lessonReportを優先（既にロードされているデータ）
      if (booking.lessonReport) {
        console.log("予約オブジェクト内のlessonReportデータを使用します:", booking.lessonReport);
        setUnitContent(getReportField(booking.lessonReport, 'unitContent'));
        setMessageContent(getReportField(booking.lessonReport, 'messageContent'));
        setGoalContent(getReportField(booking.lessonReport, 'goalContent'));
      }
      // 2. 次にAPIで取得したlessonReportを使用（大抵はこれが最新）
      else if (lessonReport) {
        // 新しいレッスンレポートデータがある場合はそれを使用
        console.log("APIから取得したレッスンレポートデータを使用します:", lessonReport);
        setUnitContent(getReportField(lessonReport, 'unitContent'));
        setMessageContent(getReportField(lessonReport, 'messageContent'));
        setGoalContent(getReportField(lessonReport, 'goalContent'));
      } 
      // 3. 最後に従来のreportContentを使用（後方互換性のため）
      else if (booking.reportContent) {
        // 従来の予約レポートデータがある場合は解析して使用（旧データ互換性のため）
        console.log("従来の予約レポートデータを解析します:", booking.reportContent);
        if (booking.reportContent.includes('【単元】')) {
          // 新フォーマットの場合
          try {
            const unitPart = booking.reportContent.split('【単元】')[1].split('【伝言事項】')[0].trim();
            const messagePart = booking.reportContent.split('【伝言事項】')[1].split('【来週までの目標(課題)】')[0].trim();
            const goalPart = booking.reportContent.split('【来週までの目標(課題)】')[1].trim();
            setUnitContent(unitPart);
            setMessageContent(messagePart);
            setGoalContent(goalPart);
          } catch (e) {
            // 解析に失敗した場合は、全てをユニットコンテンツに設定
            console.error("レポート解析エラー:", e);
            setUnitContent(booking.reportContent);
            setMessageContent("");
            setGoalContent("");
          }
        } else {
          // 古いフォーマットの場合
          const parts = booking.reportContent.split("\n");
          setUnitContent(parts.length >= 1 ? parts[0] : "");
          setMessageContent(parts.length >= 2 ? parts[1] : "");
          setGoalContent(parts.length >= 3 ? parts[2] : "");
        }
      } else {
        // レポート内容がない場合は空にする
        console.log("レポート内容がありません、フィールドをクリアします");
        setUnitContent("");
        setMessageContent("");
        setGoalContent("");
      }
    }
  }, [isOpen, booking, lessonReport]); // isOpen, booking, lessonReportの変更を監視

  // 新しいレッスンレポートAPI用のミューテーション
  const createReportMutation = useCreateLessonReport();
  const updateReportMutation = useUpdateLessonReport();

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 入力チェック
    if (!unitContent.trim() && !messageContent.trim() && !goalContent.trim()) {
      toast({
        title: "エラー",
        description: "少なくとも1つの項目を入力してください",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // レポートデータを準備
      const reportData = {
        bookingId: booking.id,
        studentId: booking.studentId,
        tutorId: booking.tutorId, // 講師IDは必須
        unitContent,
        messageContent,
        goalContent
      };

      console.log("レポート保存処理を開始します");
      
      // 優先度1: booking.lessonReportが存在する場合はそのIDを使用
      if (booking.lessonReport?.id) {
        console.log(`booking.lessonReportのID ${booking.lessonReport.id} を使用して更新します`);
        await updateReportMutation.mutateAsync({ 
          reportId: booking.lessonReport.id,
          data: {
            unitContent,
            messageContent,
            goalContent
          }
        });
      }
      // 優先度2: APIで取得したlessonReportを使用
      else if (lessonReport && 'id' in lessonReport) {
        // 既存のレポートを更新
        console.log(`APIで取得したlessonReportのID ${lessonReport.id} を使用して更新します`);
        await updateReportMutation.mutateAsync({ 
          reportId: lessonReport.id,
          data: {
            unitContent,
            messageContent,
            goalContent
          }
        });
      } else {
        // 新規レポートを作成
        console.log("新規レポートを作成します");
        await createReportMutation.mutateAsync(reportData);
      }
      
      // 成功した場合、旧フォーマットの予約データも更新（互換性のため）
      console.log("旧形式のデータも更新します");
      const response = await fetch(`/api/bookings/${booking.id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unit: unitContent,
          message: messageContent,
          goal: goalContent,
        }),
      });

      // 予約データの更新に失敗しても進む（レポートデータが正常に保存されていれば良い）
      if (!response.ok) {
        console.warn("旧フォーマットのレポートデータの更新に失敗しました。新フォーマットのみ更新されています。");
      }

      // データを再取得してUIを更新
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-reports"] });
      
      toast({
        title: "保存完了",
        description: "レポートを保存しました。マイページに戻ります。",
        variant: "default",
      });

      // マイページにリダイレクトする前にデータ再取得を待つ
      setTimeout(() => {
        // データが確実に更新されるまで待つ
        Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/tutor/bookings"] }),
          queryClient.refetchQueries({ queryKey: ["/api/bookings"] })
        ]).then(() => {
          // 現在のモーダルを閉じる
          if (onSuccess) onSuccess();
          onClose();
          
          // マイページへ移動
          setLocation("/");
        }).catch(error => {
          console.error("データ再取得エラー:", error);
          // エラーが発生してもマイページに移動
          if (onSuccess) onSuccess();
          onClose();
          setLocation("/");
        });
      }, 500);
    } catch (error: any) {
      toast({
        title: "レポート保存エラー",
        description: error.message || "レポートの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // グローバル変数を購読して変更があれば反映する
  useEffect(() => {
    // グローバル変数をチェックする関数
    const checkGlobalVars = () => {
      if ((window as any).REPORT_EDIT_MODAL_SHOULD_OPEN) {
        console.log("グローバル変数REPORT_EDIT_MODAL_SHOULD_OPENが検出されました");
        (window as any).REPORT_EDIT_MODAL_SHOULD_OPEN = false;
        // このコンポーネントは既に開いているので何もしない
      }
    };

    // 初回実行
    checkGlobalVars();

    // 定期的にチェック
    const interval = setInterval(checkGlobalVars, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>レポート編集</DialogTitle>
          <DialogDescription>
            {formattedDate} {booking.timeSlot}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 基本情報 */}
          <div className="space-y-2 bg-gray-50 p-3 rounded-md">
            {/* 日時 */}
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">日時:</span>
              <span className="text-sm ml-2">{formattedDate} {booking.timeSlot}</span>
            </div>
            
            {/* 生徒名 */}
            <div className="flex items-center">
              <User className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">生徒:</span>
              <span className="text-sm ml-2">{booking.studentName || `生徒ID: ${booking.studentId}`}</span>
            </div>
            
            {/* 科目 */}
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">科目:</span>
              <span className="text-sm ml-2">{booking.subject}</span>
            </div>
          </div>
          
          {/* 警告メッセージ - 既存のレポートがある場合のみ表示 */}
          {(lessonReport || booking.reportContent) && (
            <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md flex items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                このレポートは既に保存されています。編集内容は上書き保存されます。
              </p>
            </div>
          )}

          {/* レポート編集フォーム */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit">単元</Label>
              <Textarea
                id="unit"
                value={unitContent}
                onChange={(e) => setUnitContent(e.target.value)}
                placeholder="授業で扱った単元・内容"
                className="min-h-[80px]"
              />
            </div>
            
            <div>
              <Label htmlFor="message">伝言事項</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="保護者への伝言（褒めたいこと、改善点など）"
                className="min-h-[80px]"
              />
            </div>
            
            <div>
              <Label htmlFor="goal">来週までの目標(課題)</Label>
              <Textarea
                id="goal"
                value={goalContent}
                onChange={(e) => setGoalContent(e.target.value)}
                placeholder="次回までの目標または宿題"
                className="min-h-[80px]"
              />
            </div>
          </div>
        
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button 
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存する"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}