import { useState, useEffect } from "react";
import { format, parse, formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, CalendarDays, BookOpen, ChevronRight, Calendar, Clock, Loader2 } from "lucide-react";

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

interface ReportViewModalProps {
  isOpen: boolean;
  booking: BookingForReport;
  onClose: () => void;
  onEdit?: () => void;  // 編集ボタンクリック時のコールバック
}

export function ReportViewModal({
  isOpen,
  booking,
  onClose,
  onEdit,
}: ReportViewModalProps) {
  // 日付処理を最適化 - 無駄な計算や変換を減らす
  // 日付をフォーマット（無効な日付値のエラー処理を追加）
  let formattedDate = "日付不明";
  try {
    if (booking.date && typeof booking.date === 'string' && booking.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // 一度だけDateオブジェクトに変換
      const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
      if (!isNaN(dateObj.getTime())) {
        formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
      }
    }
  } catch (error) {
    // エラーログは開発環境でのみ出力
    if (process.env.NODE_ENV === 'development') {
      console.error("Invalid date format:", booking.date);
    }
  }
  
  // 状態管理を追加
  const [isNavigatingToEdit, setIsNavigatingToEdit] = useState(false);
  
  // レポート作成日時を取得 - パフォーマンス最適化
  let reportDateStr = "";
  
  // レポート日時処理の共通ロジックを関数化して重複コードを削減
  const formatReportDate = (dateValue: Date | string) => {
    try {
      const reportDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
      
      // 有効な日付かチェック
      if (!isNaN(reportDate.getTime())) {
        // 何日前かを表示
        const relativeTime = formatDistanceToNow(reportDate, { locale: ja, addSuffix: true });
        
        // 日本時間に変換してフォーマット (UTC+9)
        const fullDateStr = format(reportDate, "yyyy年M月d日 H:mm", { locale: ja });
        return `${relativeTime} (${fullDateStr})`;
      }
      return "日時不明";
    } catch (e) {
      return "日時不明";
    }
  };

  // 最新のAPIデータを優先
  if (booking.lessonReport?.createdAt) {
    reportDateStr = formatReportDate(booking.lessonReport.createdAt);
  } 
  // 後方互換性対応
  else if (booking.reportStatus?.startsWith('completed:')) {
    const timestamp = booking.reportStatus.split('completed:')[1];
    reportDateStr = formatReportDate(timestamp);
  }
  
  // lesson_reportsテーブルからデータを取得して表示
  let unit = "";
  let message = "";
  let goal = "";
  
  // レポートデータ取得の高速化 - 処理を最適化
  if (booking.lessonReport) {
    // 最新のAPIデータからレポート内容を取得
    unit = booking.lessonReport.unitContent || "";
    message = booking.lessonReport.messageContent || "";
    goal = booking.lessonReport.goalContent || "";
  } 
  // 後方互換性のため、レポートが既存のフォーマットで保存されている場合は解析
  else if (booking.reportContent) {
    if (booking.reportContent.includes('【単元】')) {
      // 新フォーマットの場合
      try {
        // 正規表現を使った一回の処理で高速化
        const unitMatch = booking.reportContent.match(/【単元】([\s\S]*?)(?=【伝言事項】)/);
        const messageMatch = booking.reportContent.match(/【伝言事項】([\s\S]*?)(?=【来週までの目標\(課題\)】)/);
        const goalMatch = booking.reportContent.match(/【来週までの目標\(課題\)】([\s\S]*)/);
        
        unit = unitMatch ? unitMatch[1].trim() : "";
        message = messageMatch ? messageMatch[1].trim() : "";
        goal = goalMatch ? goalMatch[1].trim() : "";
      } catch (e) {
        // フォーマットエラーの場合は単純にそのまま表示
        unit = booking.reportContent;
      }
    } else {
      // 古いフォーマット（単純に分割）- 無駄な比較を避ける
      const parts = booking.reportContent.split("\n");
      unit = parts[0] || "";
      message = parts[1] || "";
      goal = parts[2] || "";
    }
  }
  
  // デバッグ情報は開発環境でのみ出力
  if (process.env.NODE_ENV === 'development') {
    // 軽量なデバッグ情報のみを出力
    const debugInfo = {
      hasReport: !!booking.lessonReport || !!booking.reportContent,
      reportSource: booking.lessonReport ? 'lessonReport' : (booking.reportContent ? 'reportContent' : 'none')
    };
    console.debug("レポート表示モーダル:", debugInfo);
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>授業レポート</DialogTitle>
          <DialogDescription>
            {formattedDate} {booking.timeSlot}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 基本情報 - 順序: 1.日時 2.生徒名 3.科目 */}
          <div className="space-y-2">
            {/* 1. 日時 */}
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">日時:</span>
              <span className="text-sm ml-2">{formattedDate} {booking.timeSlot}</span>
            </div>
            
            {/* 2. 生徒名 */}
            <div className="flex items-center">
              <User className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">生徒:</span>
              <span className="text-sm ml-2">{booking.studentName || `生徒ID: ${booking.studentId}`}</span>
            </div>
            
            {/* 3. 科目 */}
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">科目:</span>
              <span className="text-sm ml-2">{booking.subject}</span>
            </div>
            
            {/* 講師情報 */}
            {booking.tutorName && (
              <div className="flex items-center">
                <User className="h-4 w-4 text-primary mr-2" />
                <span className="text-sm font-medium">講師:</span>
                <span className="text-sm ml-2">{booking.tutorName}</span>
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* レポート内容 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">授業レポート内容</h4>
              
              {reportDateStr && (
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>作成: {reportDateStr}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3 bg-gray-50 p-3 rounded-md">
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  <span>単元</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{unit || "-"}</p>
              </div>
              
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  <span>伝言事項</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message || "-"}</p>
              </div>
              
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  <span>来週までの目標（課題）</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{goal || "-"}</p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="mt-4 gap-2 flex">
          {isNavigatingToEdit ? (
            <div className="flex items-center justify-center w-full gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
              <span className="text-primary font-medium text-sm">レポート編集画面を表示中...</span>
            </div>
          ) : (
            <>
              {/* 編集ボタン - パフォーマンス最適化 */}
              <Button 
                variant="default" 
                onClick={() => {
                  // 編集モードに入ったことを表示
                  setIsNavigatingToEdit(true);
                  
                  // 必要なデータを先に準備
                  const reportId = booking.lessonReport?.id;
                  const bookingId = booking.id;
                  const params = new URLSearchParams();
                  
                  // 最適化：事前に全てのデータを準備してからURLパラメータを設定
                  if (reportId) {
                    params.set('reportId', reportId.toString());
                  } else {
                    params.set('bookingId', bookingId.toString());
                    
                    // レポートデータがある場合はセッションストレージに保存
                    if (unit || message || goal) {
                      const initialData = {
                        unitContent: unit,
                        messageContent: message,
                        goalContent: goal
                      };
                      try {
                        sessionStorage.setItem('INITIAL_REPORT_DATA', JSON.stringify(initialData));
                      } catch (err) {
                        // エラーは静かに処理
                      }
                    }
                  }
                  
                  // 編集画面で必要な予約情報をセッションストレージに保存
                  try {
                    const essentialBookingData = {
                      id: booking.id,
                      date: booking.date,
                      timeSlot: booking.timeSlot, 
                      subject: booking.subject || "",
                      studentId: booking.studentId,
                      studentName: booking.studentName || "",
                      tutorId: booking.tutorId
                    };
                    sessionStorage.setItem('EDIT_BOOKING_DATA', JSON.stringify(essentialBookingData));
                  } catch (err) {
                    // エラーは静かに処理
                  }
                  
                  // 即時に画面遷移する
                  // まずモーダルを閉じて編集コールバックを実行
                  onClose();
                  if (typeof onEdit === 'function') {
                    onEdit();
                  }
                  
                  // 編集ページへ即時遷移
                  const reportEditUrl = `/report-edit?${params.toString()}`;
                  window.location.assign(reportEditUrl);
                }}
                disabled={isNavigatingToEdit}
              >
                レポートを編集
              </Button>
              
              <Button 
                variant="outline" 
                onClick={onClose}
                disabled={isNavigatingToEdit}
              >
                閉じる
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}