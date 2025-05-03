import { type Booking } from "@shared/schema";
import { format, parse, formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, CalendarDays, BookOpen, ChevronRight, Calendar, Clock } from "lucide-react";

interface ReportViewModalProps {
  isOpen: boolean;
  booking: Booking & { studentName?: string; tutorName?: string };
  onClose: () => void;
}

export function ReportViewModal({
  isOpen,
  booking,
  onClose,
}: ReportViewModalProps) {
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
  
  // レポート作成日時を取得（新フォーマット: "completed:2023-05-03T12:34:56.789Z"）
  let reportDate: Date | null = null;
  let reportDateStr = "";
  
  if (booking.reportStatus && booking.reportStatus.startsWith('completed:')) {
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
  
  // レポート内容を分解（新フォーマット: 【単元】【伝言事項】【来週までの目標(課題)】）
  let unit = "";
  let message = "";
  let goal = "";
  
  if (booking.reportContent) {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>レッスンレポート</DialogTitle>
          <DialogDescription>
            {formattedDate} {booking.timeSlot}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 基本情報 */}
          <div className="space-y-2">
            <div className="flex items-center">
              <User className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">生徒:</span>
              <span className="text-sm ml-2">{booking.studentName || `生徒ID: ${booking.studentId}`}</span>
            </div>
            
            {booking.tutorName && (
              <div className="flex items-center">
                <User className="h-4 w-4 text-primary mr-2" />
                <span className="text-sm font-medium">講師:</span>
                <span className="text-sm ml-2">{booking.tutorName}</span>
              </div>
            )}
            
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">日時:</span>
              <span className="text-sm ml-2">{formattedDate} {booking.timeSlot}</span>
            </div>
            
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">科目:</span>
              <span className="text-sm ml-2">{booking.subject}</span>
            </div>
          </div>
          
          <Separator />
          
          {/* レポート内容 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">レポート内容</h4>
              
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
        
        <DialogFooter className="mt-4">
          <Button onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}