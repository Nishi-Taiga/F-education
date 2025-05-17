"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { BookOpen, User, X, AlertCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface BookingCardProps {
  booking: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
    subject: string;
    studentId: string;
    tutorId: string;
    studentName?: string;
    tutorName?: string;
    reportId?: string | null;
    reportStatus?: string | null;
    reportContent?: string | null;
  };
  onClick: () => void;
  onViewReport?: () => void;
}

export function BookingCard({ booking, onClick, onViewReport }: BookingCardProps) {
  // 日付のフォーマット
  const formattedDate = format(booking.date, "M月d日 (EEE)", { locale: ja });

  // 現在の日時
  const now = new Date();
  
  // 予約日時（時間も含める）
  const [hours, minutes] = booking.startTime.split(':').map(Number);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(hours || 0, minutes || 0, 0, 0);
  
  // 過去の予約かどうか
  const isInPast = bookingDateTime < now;
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer" onClick={onClick}>
      <div className="flex-grow">
        {/* 日付 */}
        <div className="text-sm font-medium">{formattedDate}</div>
        {/* 時間帯 */}
        <div className="text-xs text-gray-600">{booking.startTime} - {booking.endTime}</div>
        {/* 生徒名 */}
        {booking.studentName && (
          <div className="text-xs text-gray-600 mt-0.5">
            生徒: <span className="font-medium">{booking.studentName}</span>
          </div>
        )}
        {/* 科目 */}
        {booking.subject && (
          <div className="text-xs text-gray-600 mt-0.5">
            科目: <span className="font-medium">{booking.subject}</span>
          </div>
        )}
        {/* 担当講師情報 */}
        {booking.tutorName && (
          <div className="text-xs text-gray-600 mt-0.5">
            担当講師: <span className="font-medium">{booking.tutorName}</span>
          </div>
        )}
      </div>
      
      {/* レポート表示ボタン - 過去の授業でレポートが存在する場合のみ表示 */}
      {onViewReport && isInPast && booking.reportStatus === 'completed' && (
        <Button 
          variant="ghost" 
          size="sm"
          className="text-gray-500 hover:text-green-500 hover:bg-green-50 h-8 shrink-0 flex items-center gap-1 mr-1" 
          onClick={(e) => {
            e.stopPropagation();
            onViewReport();
          }}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span className="text-xs">レポート</span>
        </Button>
      )}
      
      {/* ステータス表示 */}
      {isCancelled && (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 mr-1">
          キャンセル済
        </Badge>
      )}
      
      {isCompleted && booking.reportId && !onViewReport && (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 mr-1">
          レポート済
        </Badge>
      )}
    </div>
  );
}