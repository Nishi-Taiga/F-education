import { format, parse, formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, CalendarDays, BookOpen, ChevronRight, Calendar, Clock } from "lucide-react";

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
  // デバッグ情報の出力
  console.log("ReportViewModal: onEdit prop exists:", !!onEdit);
  console.log("ReportViewModal: booking reportStatus:", booking?.reportStatus);
  
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
  
  // レポート作成日時を取得
  let reportDate: Date | null = null;
  let reportDateStr = "";
  
  // lessonReportからレポート日時を取得
  if (booking.lessonReport && booking.lessonReport.createdAt) {
    try {
      reportDate = new Date(booking.lessonReport.createdAt);
      
      // 有効な日付かチェック
      if (!isNaN(reportDate.getTime())) {
        // 何日前かを表示
        reportDateStr = formatDistanceToNow(reportDate, { locale: ja, addSuffix: true });
        
        // 日本時間に変換してフォーマット
        const japanTime = new Date(reportDate.getTime() + (9 * 60 * 60 * 1000));
        const fullDateStr = format(japanTime, "yyyy年M月d日 H:mm", { locale: ja });
        reportDateStr = `${reportDateStr} (${fullDateStr})`;
      } else {
        reportDateStr = "日時不明";
      }
    } catch (e) {
      console.error("Invalid report date format:", booking.lessonReport.createdAt);
      reportDateStr = "日時不明";
    }
  } 
  // 後方互換性のため、reportStatusからも日時を取得
  else if (booking.reportStatus && booking.reportStatus.startsWith('completed:')) {
    try {
      // タイムスタンプ部分を抽出
      const timestamp = booking.reportStatus.split('completed:')[1];
      reportDate = new Date(timestamp);
      
      // 有効な日付かチェック
      if (!isNaN(reportDate.getTime())) {
        // 何日前かを表示
        reportDateStr = formatDistanceToNow(reportDate, { locale: ja, addSuffix: true });
        
        // 日本時間に変換してフォーマット
        const japanTime = new Date(reportDate.getTime() + (9 * 60 * 60 * 1000));
        const fullDateStr = format(japanTime, "yyyy年M月d日 H:mm", { locale: ja });
        reportDateStr = `${reportDateStr} (${fullDateStr})`;
      } else {
        reportDateStr = "日時不明";
      }
    } catch (e) {
      console.error("Invalid report date format:", booking.reportStatus);
      reportDateStr = "日時不明";
    }
  }
  
  // lesson_reportsテーブルからデータを取得して表示
  let unit = "";
  let message = "";
  let goal = "";
  
  // lessonReportオブジェクトが存在する場合は直接そこからデータを取得
  if (booking.lessonReport) {
    console.log("レポートをlessonReportから取得します:", booking.lessonReport);
    unit = booking.lessonReport.unitContent || "";
    message = booking.lessonReport.messageContent || "";
    goal = booking.lessonReport.goalContent || "";
  } 
  // 後方互換性のため、lessonReportがない場合は従来のreportContentを使用
  else if (booking.reportContent) {
    console.log("レポートをreportContentから取得します（旧形式）");
    if (booking.reportContent.includes('【単元】')) {
      // 新フォーマット
      try {
        const unitPart = booking.reportContent.split('【単元】')[1].split('【伝言事項】')[0].trim();
        const messagePart = booking.reportContent.split('【伝言事項】')[1].split('【来週までの目標(課題)】')[0].trim();
        const goalPart = booking.reportContent.split('【来週までの目標(課題)】')[1].trim();
        
        unit = unitPart;
        message = messagePart;
        goal = goalPart;
      } catch (e) {
        // フォーマットエラーの場合は単純にそのまま表示
        unit = booking.reportContent;
      }
    } else {
      // 古いフォーマット（単純に分割）
      const parts = booking.reportContent.split("\n");
      if (parts.length >= 1) unit = parts[0];
      if (parts.length >= 2) message = parts[1];
      if (parts.length >= 3) goal = parts[2];
    }
  }

  // デバッグ用：ステータス情報
  console.log("レポートステータス詳細:", {
    reportStatus: booking?.reportStatus,
    isCompleted: booking?.reportStatus === "completed" || (booking?.reportStatus && booking?.reportStatus.startsWith('completed:')),
    hasEditCallback: typeof onEdit === 'function',
    isPastLesson: true, // 簡易化：過去のレッスンとして扱う
  });
  
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
          {/* デバッグ情報 */}
          {(() => {
            // このIIFEはReactNodeを返すため型エラーを解消
            const hasEditFunction = typeof onEdit === 'function';
            console.log("DialogFooter内 - onEdit存在:", hasEditFunction);
            return null;
          })()}
          
          {/* 常に編集ボタンを表示（グローバル関数も使用） */}
          <Button 
            variant="outline" 
            onClick={() => {
              console.log("編集ボタンクリック - シンプルアプローチ");
              
              // モーダル閉じる処理を先に行う
              onClose();
              
              // まず親から渡されたコールバックを実行
              if (typeof onEdit === 'function') {
                console.log("親から渡された編集コールバックを実行します");
                
                // 少し遅延を入れてからコールバックを実行
                setTimeout(() => {
                  onEdit();
                }, 300); // 遅延を長くして確実に反映されるようにする
              } 
              // バックアップ: グローバル関数を使用
              else if (typeof window.openReportEditModal === 'function') {
                console.log("グローバル編集関数を使用します");
                setTimeout(() => {
                  // @ts-ignore - グローバル関数のアクセス
                  window.openReportEditModal(booking);
                }, 300);
              }
              else {
                console.error("編集コールバックが設定されていません");
              }
            }}
          >
            レポートを編集
          </Button>
          <Button onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}