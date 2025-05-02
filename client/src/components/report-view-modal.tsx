import { type Booking } from "@shared/schema";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, CalendarDays, BookOpen, ChevronRight } from "lucide-react";

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
  // 日付をフォーマット
  const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
  const formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
  
  // レポート内容を分解（フォーマット: 単元、伝言事項、来週までの目標（課題））
  let unit = "";
  let message = "";
  let goal = "";
  
  if (booking.reportContent) {
    const parts = booking.reportContent.split("\n");
    if (parts.length >= 1) unit = parts[0];
    if (parts.length >= 2) message = parts[1];
    if (parts.length >= 3) goal = parts[2];
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
            <h4 className="text-sm font-semibold">レポート内容</h4>
            
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