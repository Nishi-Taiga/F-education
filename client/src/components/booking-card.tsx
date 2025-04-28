import { type Booking } from "@shared/schema";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { BookOpen, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingCardProps {
  booking: Booking & {
    studentName?: string;
  };
  onCancelClick?: (booking: Booking & { studentName?: string }) => void;
}

export function BookingCard({ booking, onCancelClick }: BookingCardProps) {
  // Parse the date from string (YYYY-MM-DD) to a Date object
  const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
  
  // Format the date with Japanese locale
  const formattedDate = format(dateObj, "M月d日 (E)", { locale: ja });

  // 現在の日付と予約日を比較（過去の予約はキャンセル不可）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);
  const isInPast = bookingDate < today;

  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-md">
      <div className="w-10 h-10 flex-shrink-0 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mr-3">
        <BookOpen className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-grow">
        <div className="text-sm font-medium">{formattedDate}</div>
        <div className="text-xs text-gray-600">{booking.timeSlot}</div>
        {booking.subject && (
          <div className="text-xs text-gray-600 mt-0.5">
            科目: <span className="font-medium">{booking.subject}</span>
          </div>
        )}
        {booking.studentId && (
          <div className="flex items-center mt-1">
            <User className="h-3 w-3 text-primary mr-1" />
            <span className="text-xs text-primary">
              {booking.studentName || `生徒ID: ${booking.studentId}`}
            </span>
          </div>
        )}
      </div>
      
      {onCancelClick && !isInPast && (
        <Button 
          variant="ghost" 
          size="sm"
          className="text-gray-500 hover:text-red-500 hover:bg-red-50 h-8 shrink-0 flex items-center gap-1" 
          onClick={() => onCancelClick(booking)}
          title="この予約をキャンセル"
        >
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">キャンセル</span>
        </Button>
      )}
    </div>
  );
}
