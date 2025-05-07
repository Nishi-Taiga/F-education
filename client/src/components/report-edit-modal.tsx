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
  // 開発用コンソールログを削除
  
  const { toast } = useToast();
  const [, setLocation] = useLocation(); // wouter hook
  
  // 初期レポート内容を取得する関数（複数ソースから最適な値を取得）
  const getInitialReportData = () => {
    // 1. まずbooking.lessonReportから取得を試みる
    if (booking.lessonReport) {
      return {
        unitContent: booking.lessonReport.unitContent || "",
        messageContent: booking.lessonReport.messageContent || "",
        goalContent: booking.lessonReport.goalContent || ""
      };
    }
    
    // 2. レポートコンテンツから解析を試みる
    if (booking.reportContent) {
      if (booking.reportContent.includes('【単元】')) {
        try {
          const unitMatch = booking.reportContent.match(/【単元】([\s\S]*?)(?=【伝言事項】)/);
          const messageMatch = booking.reportContent.match(/【伝言事項】([\s\S]*?)(?=【来週までの目標\(課題\)】)/);
          const goalMatch = booking.reportContent.match(/【来週までの目標\(課題\)】([\s\S]*)/);
          
          return {
            unitContent: unitMatch ? unitMatch[1].trim() : "",
            messageContent: messageMatch ? messageMatch[1].trim() : "",
            goalContent: goalMatch ? goalMatch[1].trim() : ""
          };
        } catch (e) {
          // 解析エラー - 空の値を返す
        }
      } else {
        const parts = booking.reportContent.split("\n");
        return {
          unitContent: parts[0] || "",
          messageContent: parts[1] || "",
          goalContent: parts[2] || ""
        };
      }
    }
    
    // 3. 何も見つからない場合は空の値を返す
    return {
      unitContent: "",
      messageContent: "",
      goalContent: ""
    };
  };
  
  // メモリ使用量最適化: レポート内容を一つのオブジェクトにまとめる 
  // 既存レポートデータがある場合は初期値として設定
  const [reportContent, setReportContent] = useState(getInitialReportData());
  // 個別の setters - 内部的には一つの状態更新を使用
  const setUnitContent = (value: string) => setReportContent(prev => ({ ...prev, unitContent: value }));
  const setMessageContent = (value: string) => setReportContent(prev => ({ ...prev, messageContent: value }));
  const setGoalContent = (value: string) => setReportContent(prev => ({ ...prev, goalContent: value }));
  
  // アクセス用の変数（パフォーマンス向上のため）
  const { unitContent, messageContent, goalContent } = reportContent;
  
  const [isSaving, setIsSaving] = useState(false);
  
  // 不要なuseEffectを削除

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
    // 無効な日付フォーマットはデフォルト表示に戻す
  }

  // 新しいAPIを使用してレッスンレポートを取得
  const { data: lessonReport, isLoading: isLoadingReport } = useLessonReportByBookingId(
    isOpen && booking && booking.id ? booking.id : null
  );
  
  // APIから取得したレポートをbookingに直接設定
  useEffect(() => {
    // APIでレポートデータが取得できたら、それをbookingオブジェクトに設定
    if (lessonReport && !booking.lessonReport) {
      booking.lessonReport = lessonReport;
      console.log("APIからのレスポンスをbookingに設定しました:", lessonReport);
    }
  }, [lessonReport, booking]);
  
  // レッスンレポートの型安全なアクセス用のヘルパー関数（エラー耐性向上）
  const getReportField = (report: any, field: string, defaultValue: string = ""): string => {
    if (!report) return defaultValue;
    return (report[field] as string) || defaultValue;
  };
  
  // 初期値をログとして出力（デバッグ用）
  console.log("レポート編集モーダル - 初期データ:", { 
    bookingId: booking.id,
    hasLessonReport: !!booking.lessonReport, 
    lessonReportFields: booking.lessonReport,
    apiReport: lessonReport,
    currentState: reportContent
  });
  
  // パフォーマンス最適化: モーダルが開かれたときに既存のレポート内容を即時設定する
  useEffect(() => {
    if (!isOpen) return; // 閉じている場合は早期リターン
    
    // デバッグ情報を出力
    console.log("レポート編集フォーム初期化:", { 
      hasBookingLessonReport: !!booking.lessonReport, 
      hasAPILessonReport: !!lessonReport,
      hasReportContent: !!booking.reportContent
    });
    
    let unitContent = "";
    let messageContent = "";
    let goalContent = "";
    
    // 優先順位1: まずbooking.lessonReportを確認（最も確実）
    if (booking.lessonReport) {
      unitContent = booking.lessonReport.unitContent || "";
      messageContent = booking.lessonReport.messageContent || "";
      goalContent = booking.lessonReport.goalContent || "";
      
      console.log("bookingから初期値を設定:", { unitContent, messageContent, goalContent });
    }
    // 優先順位2: APIレスポンスを確認
    else if (lessonReport) {
      if (typeof lessonReport === 'object') {
        unitContent = getReportField(lessonReport, 'unitContent');
        messageContent = getReportField(lessonReport, 'messageContent');
        goalContent = getReportField(lessonReport, 'goalContent');
        
        console.log("APIレスポンスから初期値を設定:", { unitContent, messageContent, goalContent });
      }
    }
    
    // 優先順位3: 従来のreportContentをチェック（フォールバック）
    if ((!unitContent && !messageContent && !goalContent) && booking.reportContent) {
      // 新フォーマットのレポートの場合
      if (booking.reportContent.includes('【単元】')) {
        try {
          const unitMatch = booking.reportContent.match(/【単元】([\s\S]*?)(?=【伝言事項】)/);
          const messageMatch = booking.reportContent.match(/【伝言事項】([\s\S]*?)(?=【来週までの目標\(課題\)】)/);
          const goalMatch = booking.reportContent.match(/【来週までの目標\(課題\)】([\s\S]*)/);
          
          unitContent = unitMatch ? unitMatch[1].trim() : "";
          messageContent = messageMatch ? messageMatch[1].trim() : "";
          goalContent = goalMatch ? goalMatch[1].trim() : "";
          
          console.log("reportContentから初期値を設定 (新形式):", { unitContent, messageContent, goalContent });
        } catch (e) {
          unitContent = booking.reportContent;
          console.log("reportContentのパースに失敗:", e);
        }
      } else {
        // 古いフォーマットのレポートの場合
        const parts = booking.reportContent.split("\n");
        unitContent = parts[0] || "";
        messageContent = parts[1] || "";
        goalContent = parts[2] || "";
        
        console.log("reportContentから初期値を設定 (旧形式):", { unitContent, messageContent, goalContent });
      }
    }
    
    // すべてのソースから有効な値が取得できなかった場合の最終フォールバック
    if (!unitContent && !messageContent && !goalContent) {
      console.log("初期値が取得できませんでした - 空の値を使用します");
    }
    
    // フォームの状態更新（一度に全フィールドを更新）
    setReportContent({
      unitContent,
      messageContent,
      goalContent
    });
    
    // 初期値設定完了をログに出力
    console.log("レポート編集フォームの初期値を設定しました:", { unitContent, messageContent, goalContent });
  }, [isOpen, booking?.id, lessonReport]);

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

      // 優先度1: booking.lessonReportが存在する場合はそのIDを使用
      if (booking.lessonReport?.id) {
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
      else if (lessonReport && typeof lessonReport === 'object' && 'id' in lessonReport && lessonReport.id) {
        // 既存のレポートを更新
        await updateReportMutation.mutateAsync({ 
          reportId: lessonReport.id as number,
          data: {
            unitContent,
            messageContent,
            goalContent
          }
        });
      } else {
        // 新規レポートを作成
        await createReportMutation.mutateAsync(reportData);
      }
      
      // パフォーマンス向上: すべての更新とデータリフレッシュ処理を並列実行
      // すべての処理を並列で実行して応答時間を最適化
      await Promise.all([
        // 1. 後方互換性のために旧フォーマットのデータを更新（失敗しても続行）
        (async () => {
          try {
            const response = await fetch(`/api/bookings/${booking.id}/report`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Priority": "high"
              },
              body: JSON.stringify({
                unit: unitContent,
                message: messageContent,
                goal: goalContent,
              }),
            });
          } catch (error) {
            // エラーをキャッチしても処理を続行
          }
        })(),
        
        // 2. キャッシュデータをバックグラウンドで最適化して無効化（一括処理）
        (async () => {
          // すべてのキャッシュ関連操作を一括で処理
          const cacheOperations = [
            // グローバルキャッシュの無効化
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/bookings"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/lesson-reports"] }),
            
            // 個別キャッシュの無効化
            queryClient.invalidateQueries({ queryKey: [`/api/bookings/${booking.id}`] }),
            
            // レポートIDが存在する場合はそのキャッシュも無効化
            booking.lessonReport?.id 
              ? queryClient.invalidateQueries({ queryKey: [`/api/lesson-reports/${booking.lessonReport.id}`] })
              : Promise.resolve(),
            
            // バックグラウンドでデータの再取得も開始
            queryClient.prefetchQuery({ queryKey: ["/api/tutor/bookings"] })
          ];
          
          await Promise.all(cacheOperations);
        })()
      ]);
      
      // 成功メッセージを表示
      toast({
        title: "保存完了",
        description: "レポートを保存しました。マイページに戻ります。",
        variant: "default",
      });
      
      // 成功コールバックを呼び出し（親コンポーネントにも通知）
      if (onSuccess) {
        onSuccess();
      }
      
      // モーダルを閉じる
      onClose();
      
      // オプティミスティックUIとして即座にリダイレクト
      // キャッシュ更新は既にバックグラウンドで行われているため遅延は最小限
      setLocation("/");
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
      <DialogContent className="w-[95vw] sm:w-auto sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center sm:text-left">レポート編集</DialogTitle>
          <DialogDescription className="text-center sm:text-left">
            {formattedDate} {booking.timeSlot}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 基本情報 */}
          <div className="space-y-3 bg-gray-50 p-3 rounded-md">
            {/* 日時 */}
            <div className="flex flex-wrap items-center gap-x-2">
              <div className="flex items-center min-w-[4rem] sm:min-w-[5rem]">
                <CalendarDays className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">日時:</span>
              </div>
              <span className="text-sm">{formattedDate} {booking.timeSlot}</span>
            </div>
            
            {/* 生徒名 */}
            <div className="flex flex-wrap items-center gap-x-2">
              <div className="flex items-center min-w-[4rem] sm:min-w-[5rem]">
                <User className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">生徒:</span>
              </div>
              <span className="text-sm">{booking.studentName || `生徒ID: ${booking.studentId}`}</span>
            </div>
            
            {/* 科目 */}
            <div className="flex flex-wrap items-center gap-x-2">
              <div className="flex items-center min-w-[4rem] sm:min-w-[5rem]">
                <BookOpen className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">科目:</span>
              </div>
              <span className="text-sm">{booking.subject}</span>
            </div>
          </div>
          
          {/* 警告メッセージ - 既存のレポートがある場合のみ表示 */}
          {(lessonReport || booking.reportContent) && (
            <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md flex flex-wrap items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                このレポートは既に保存されています。編集内容は上書き保存されます。
              </p>
            </div>
          )}

          {/* レポート編集フォーム */}
          <div className="space-y-5">
            <div>
              <Label htmlFor="unit" className="text-sm font-medium mb-1.5 block">単元</Label>
              <Textarea
                id="unit"
                value={unitContent}
                onChange={(e) => setUnitContent(e.target.value)}
                placeholder="授業で扱った単元・内容"
                className="min-h-[80px] w-full resize-y"
              />
            </div>
            
            <div>
              <Label htmlFor="message" className="text-sm font-medium mb-1.5 block">伝言事項</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="保護者への伝言（褒めたいこと、改善点など）"
                className="min-h-[80px] w-full resize-y"
              />
            </div>
            
            <div>
              <Label htmlFor="goal" className="text-sm font-medium mb-1.5 block">来週までの目標(課題)</Label>
              <Textarea
                id="goal"
                value={goalContent}
                onChange={(e) => setGoalContent(e.target.value)}
                placeholder="次回までの目標または宿題"
                className="min-h-[80px] w-full resize-y"
              />
            </div>
          </div>
        
          <DialogFooter className="pt-5 flex-col sm:flex-row gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              キャンセル
            </Button>
            <Button 
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto order-1 sm:order-2"
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