import { type Booking } from "@shared/schema";
import { format, parse, addHours } from "date-fns";
import { ja } from "date-fns/locale";
import { BookOpen, User, X, AlertCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface BookingCardProps {
  booking: Booking & {
    studentName?: string;
    tutorName?: string;
  };
  onCancelClick?: (booking: Booking & { studentName?: string; tutorName?: string }) => void;
  onViewReportClick?: (booking: Booking & { studentName?: string; tutorName?: string }) => void;
}

export function BookingCard({ booking, onCancelClick, onViewReportClick }: BookingCardProps) {
  // Parse the date from string (YYYY-MM-DD) to a Date object
  const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
  
  // Format the date with Japanese locale
  const formattedDate = format(dateObj, "M月d日 (E)", { locale: ja });

  // 現在の日時
  const now = new Date();
  
  // 予約日時（時間も含める）
  const [timeStart] = booking.timeSlot.split('-')[0].split(':').map(Number);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(timeStart, 0, 0, 0);
  
  // 24時間前の時点
  const cancelDeadline = addHours(bookingDateTime, -24);
  
  // 過去の予約またはキャンセル期限を過ぎているかどうか
  const isInPast = bookingDateTime < now;
  const isPastCancelDeadline = now > cancelDeadline;

  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-md">
      <div className="flex-grow">
        <div className="text-sm font-medium">{formattedDate}</div>
        <div className="text-xs text-gray-600">{booking.timeSlot}</div>
        {booking.subject && (
          <div className="text-xs text-gray-600 mt-0.5">
            科目: <span className="font-medium">{booking.subject}</span>
          </div>
        )}
        {/* 担当講師情報 */}
        <div className="text-xs text-gray-600 mt-0.5">
          担当講師: <span className="font-medium">{booking.tutorName || `講師ID: ${booking.tutorId}`}</span>
        </div>
        {booking.studentId && (
          <div className="flex items-center mt-1">
            <span className="text-xs text-primary">
              {booking.studentName || `生徒ID: ${booking.studentId}`}
            </span>
          </div>
        )}
      </div>
      
      {/* レポート表示ボタン - 過去の授業でレポートが存在する場合のみ表示 */}
      {onViewReportClick && isInPast && booking.reportStatus === 'completed' && (
        <Button 
          variant="ghost" 
          size="sm"
          className="text-gray-500 hover:text-green-500 hover:bg-green-50 h-8 shrink-0 flex items-center gap-1 mr-1" 
          onClick={() => onViewReportClick(booking)}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span className="text-xs">レポート</span>
        </Button>
      )}
      
      {/* レポートが存在する場合のバッジ */}
      {isInPast && booking.reportStatus === 'completed' && !onViewReportClick && (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 mr-1">
          レポート済
        </Badge>
      )}
      
      {/* キャンセルボタン */}
      {onCancelClick && !isInPast && (
        isPastCancelDeadline ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-gray-400 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  <span>キャンセル不可</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>授業開始24時間前を過ぎているためキャンセルできません（葬儀等の緊急時はLINEにてご連絡ください）</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-500 hover:text-red-500 hover:bg-red-50 h-8 shrink-0 flex items-center gap-1" 
            onClick={() => onCancelClick(booking)}
          >
            <X className="h-3.5 w-3.5" />
            <span className="text-xs">キャンセル</span>
          </Button>
        )
      )}
    </div>
  );
}
