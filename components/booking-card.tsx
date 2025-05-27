"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { BookOpen, User, X, AlertCircle, ClipboardCheck, Calendar, Clock, GraduationCap, BookIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    onCancelClick?: () => void;
  };
  onClick: () => void;
  onViewReport?: () => void;
}

export function BookingCard({ booking, onClick, onViewReport }: BookingCardProps) {
  // 日付のフォーマット
  const formattedDate = format(booking.date, "M月d日 (EEE)", { locale: ja });
  const { onCancelClick } = booking;

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
  const hasReport = booking.reportId && booking.reportStatus === 'completed';

  return (
    <div 
      className={cn(
        "p-4 rounded-lg hover:shadow-md transition-all cursor-pointer border",
        !isCancelled && !isInPast && "bg-gradient-to-r from-green-50 to-white border-green-200 hover:border-green-300",
        isCompleted && "bg-gradient-to-r from-blue-50 to-white border-blue-200 hover:border-blue-300",
        isCancelled && "bg-gradient-to-r from-gray-50 to-white border-gray-200 hover:border-gray-300",
        hasReport && "bg-gradient-to-r from-teal-50 to-white border-teal-200 hover:border-teal-300"
      )} 
      onClick={onClick}
    >
      <div className="flex items-start">
        {/* 左側のアイコン */}
        <div className={cn(
          "rounded-full p-2 mr-3 flex-shrink-0",
          !isCancelled && !isInPast && "bg-green-100 text-green-600",
          isCompleted && !hasReport && "bg-blue-100 text-blue-600",
          isCancelled && "bg-gray-100 text-gray-500",
          hasReport && "bg-teal-100 text-teal-600"
        )}>
          {!isCancelled && !isInPast && <Calendar className="h-5 w-5" />}
          {isCompleted && !hasReport && <Clock className="h-5 w-5" />}
          {isCancelled && <X className="h-5 w-5" />}
          {hasReport && <ClipboardCheck className="h-5 w-5" />}
        </div>
        
        {/* 右側の内容 */}
        <div className="flex-grow">
          <div className="flex items-center justify-between">
            {/* 日付と時間 */}
            <div className="flex flex-col">
              <div className={cn(
                "text-base font-semibold",
                isCancelled && "text-gray-500 line-through"
              )}>
                {formattedDate}
              </div>
              <div className={cn(
                "text-sm",
                !isCancelled && !isInPast && "text-green-700",
                isCompleted && "text-blue-700",
                isCancelled && "text-gray-500 line-through",
                hasReport && "text-teal-700"
              )}>
                {booking.startTime} - {booking.endTime}
              </div>
            </div>
            
            {/* ステータスバッジ */}
            {isCancelled && (
              <div className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                キャンセル済
              </div>
            )}
            
            {isCompleted && booking.reportId && !onViewReport && (
              <div className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded-full border border-teal-200">
                レポート済
              </div>
            )}
            
            {!isCancelled && !isInPast && (
              <div className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full border border-green-200">
                予定
              </div>
            )}
            
            {isCompleted && !booking.reportId && (
              <div className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                授業完了
              </div>
            )}
          </div>
          
          {/* 科目 */}
          <div className="mt-3 flex items-center gap-1.5">
            <BookIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">
              {booking.subject}
            </span>
          </div>
          
          {/* 生徒/講師情報 */}
          <div className="mt-1.5 flex flex-wrap gap-4">
            {booking.studentName && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {booking.studentName}
                </span>
              </div>
            )}
            
            {booking.tutorName && (
              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {booking.tutorName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* レポート表示ボタン */}
      {onViewReport && isInPast && hasReport && (
        <div className="mt-3 pt-3 border-t">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full text-teal-600 border-teal-200 hover:bg-teal-50 hover:text-teal-700" 
            onClick={(e) => {
              e.stopPropagation();
              onViewReport();
            }}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            レポートを表示
          </Button>
        </div>
      )}

      {/* キャンセルボタンを追加 */}
      {onCancelClick && !isCancelled && !isInPast && (
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation(); // 親要素のクリックイベントが発火するのを防ぐ
              onCancelClick();
            }}
          >
            <X className="h-4 w-4 mr-2" />
            予約をキャンセル
          </Button>
        </div>
      )}
    </div>
  );
}