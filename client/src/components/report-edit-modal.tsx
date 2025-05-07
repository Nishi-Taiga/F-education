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
  // パフォーマンス向上: 開発用のデバッグ情報は本番環境ではスキップ
  if (process.env.NODE_ENV === 'development') {
    console.log("レポート編集モーダルが呼び出されました", { isOpen, bookingId: booking?.id });
  }
  
  const { toast } = useToast();
  const [, setLocation] = useLocation(); // wouter hook
  
  // メモリ使用量最適化: レポート内容を一つのオブジェクトにまとめる
  const [reportContent, setReportContent] = useState({
    unitContent: "",
    messageContent: "",
    goalContent: ""
  });
  // 個別の setters - 内部的には一つの状態更新を使用
  const setUnitContent = (value: string) => setReportContent(prev => ({ ...prev, unitContent: value }));
  const setMessageContent = (value: string) => setReportContent(prev => ({ ...prev, messageContent: value }));
  const setGoalContent = (value: string) => setReportContent(prev => ({ ...prev, goalContent: value }));
  
  // アクセス用の変数（パフォーマンス向上のため）
  const { unitContent, messageContent, goalContent } = reportContent;
  
  const [isSaving, setIsSaving] = useState(false);
  
  // パフォーマンス向上: useEffect内の不要なログを削除
  useEffect(() => {
    if (isOpen && process.env.NODE_ENV === 'development') {
      console.log("ReportEditModal - モーダルが開かれました。予約情報:", booking);
    }
  }, [isOpen, booking]);

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
    isOpen && booking && booking.id ? booking.id : null
  );
  
  // レッスンレポートの型安全なアクセス用のヘルパー関数
  const getReportField = (report: any, field: string, defaultValue: string = ""): string => {
    if (!report) return defaultValue;
    return (report[field] as string) || defaultValue;
  };
  
  // パフォーマンス最適化: モーダルが開かれたときに既存のレポート内容を即時設定する
  useEffect(() => {
    if (!isOpen) return; // 閉じている場合は早期リターン
    
    // 開発環境でのみログを出力
    if (process.env.NODE_ENV === 'development') {
      console.log("ReportEditModal - モーダルが開かれました。予約情報:", booking);
    }
    
    // 一度のstate更新で全フィールドを設定することでパフォーマンス向上
    const setAllFields = (unit: string, message: string, goal: string) => {
      // 即時に状態を更新
      setReportContent({
        unitContent: unit,
        messageContent: message,
        goalContent: goal
      });
    };
    
    // データソースの優先順位を設定:
    
    // 1. まずbooking.lessonReportを優先的に使用（最もレスポンスが早い）
    if (booking.lessonReport) {
      if (process.env.NODE_ENV === 'development') {
        console.log("予約オブジェクト内のlessonReportデータを即時使用します");
      }
      // 即時設定
      setAllFields(
        getReportField(booking.lessonReport, 'unitContent'),
        getReportField(booking.lessonReport, 'messageContent'),
        getReportField(booking.lessonReport, 'goalContent')
      );
    } 
    // 2. その次にAPIレスポンスを使用（レスポンスが遅い場合がある）
    else if (lessonReport) {
      if (process.env.NODE_ENV === 'development') {
        console.log("APIから取得したレッスンレポートデータを即時使用します");
      }
      // 即時設定
      setAllFields(
        getReportField(lessonReport, 'unitContent'),
        getReportField(lessonReport, 'messageContent'),
        getReportField(lessonReport, 'goalContent')
      );
    }
    
    // パターン3: 従来のreportContentを使用（後方互換性）
    if (booking.reportContent) {
      if (process.env.NODE_ENV === 'development') {
        console.log("従来の予約レポートデータを解析します");
      }
      
      // 高速化: 新フォーマットの正規表現によるパース（一度に解析）
      if (booking.reportContent.includes('【単元】')) {
        try {
          // 一度の正規表現実行で全要素を抽出（パフォーマンス向上）
          const unitMatch = booking.reportContent.match(/【単元】([\s\S]*?)(?=【伝言事項】)/);
          const messageMatch = booking.reportContent.match(/【伝言事項】([\s\S]*?)(?=【来週までの目標\(課題\)】)/);
          const goalMatch = booking.reportContent.match(/【来週までの目標\(課題\)】([\s\S]*)/);
          
          setAllFields(
            unitMatch ? unitMatch[1].trim() : "",
            messageMatch ? messageMatch[1].trim() : "",
            goalMatch ? goalMatch[1].trim() : ""
          );
        } catch (e) {
          // エラー時はログだけ出力し、レポート全体を単元欄に表示
          if (process.env.NODE_ENV === 'development') {
            console.error("レポート解析エラー:", e);
          }
          setAllFields(booking.reportContent, "", "");
        }
      } else {
        // 古いフォーマット（分割処理の高速化）
        const parts = booking.reportContent.split("\n");
        setAllFields(
          parts[0] || "",
          parts[1] || "",
          parts[2] || ""
        );
      }
      return; // 早期リターンで後続処理をスキップ
    }
    
    // パターン4: レポート内容なし - フィールドクリア
    if (process.env.NODE_ENV === 'development') {
      console.log("レポート内容がありません、フィールドをクリアします");
    }
    setAllFields("", "", "");
    
  }, [isOpen, booking, lessonReport, setReportContent]);

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
      else if (lessonReport && typeof lessonReport === 'object' && 'id' in lessonReport && lessonReport.id) {
        // 既存のレポートを更新
        console.log(`APIで取得したlessonReportのID ${lessonReport.id} を使用して更新します`);
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
        console.log("新規レポートを作成します");
        await createReportMutation.mutateAsync(reportData);
      }
      
      // パフォーマンス向上: すべての更新とデータリフレッシュ処理を並列実行
      // すべての処理を並列で実行して応答時間を最適化
      await Promise.all([
        // 1. 後方互換性のために旧フォーマットのデータを更新（失敗しても続行）
        (async () => {
          if (process.env.NODE_ENV === 'development') {
            console.log("旧形式のデータも並列で更新します");
          }
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
            
            if (!response.ok && process.env.NODE_ENV === 'development') {
              console.warn("旧フォーマットデータの更新に失敗しましたが処理を続行します");
            }
          } catch (error) {
            // エラーをキャッチしても処理を続行
            if (process.env.NODE_ENV === 'development') {
              console.warn("旧フォーマットデータの更新でエラーが発生:", error);
            }
          }
        })(),
        
        // 2. キャッシュデータをバックグラウンドで最適化して無効化（一括処理）
        (async () => {
          if (process.env.NODE_ENV === 'development') {
            console.log("キャッシュを並列処理で無効化・更新します");
          }
          
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
          
          if (process.env.NODE_ENV === 'development') {
            console.log("キャッシュの更新が完了しました");
          }
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