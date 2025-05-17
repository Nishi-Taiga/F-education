// calendar-view.tsx
import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, isToday, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  bookings: any[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onBookingClick: (booking: any) => void;
}

export function CalendarView({
  bookings,
  currentDate,
  onDateChange,
  onBookingClick,
}: CalendarViewProps) {
  const [visibleDate, setVisibleDate] = useState(currentDate);

  // 月を変更するハンドラー
  const handlePreviousMonth = () => {
    const newDate = subMonths(visibleDate, 1);
    setVisibleDate(newDate);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = addMonths(visibleDate, 1);
    setVisibleDate(newDate);
    onDateChange(newDate);
  };

  // 月のカレンダー日付を生成
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleDate);
    const monthEnd = endOfMonth(visibleDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // 週の最初の日（日曜日 = 0）を考慮して空のスペースを追加
    const startDay = getDay(monthStart);
    const blanks = Array(startDay).fill(null);
    
    return [...blanks, ...daysInMonth];
  }, [visibleDate]);

  // 指定された日付の予約を取得
  const getBookingsForDate = (date: Date | null) => {
    if (!date) return [];
    return bookings.filter(booking => isSameDay(new Date(booking.date), date));
  };

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(visibleDate, 'yyyy年MM月', { locale: ja })}
        </h2>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const today = new Date();
              setVisibleDate(today);
              onDateChange(today);
            }}
          >
            今日
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {/* 曜日ヘッダー */}
        {weekdays.map((day, index) => (
          <div
            key={index}
            className={cn(
              "h-10 flex items-center justify-center text-sm font-medium",
              index === 0 && "text-red-500", // 日曜日
              index === 6 && "text-blue-500"  // 土曜日
            )}
          >
            {day}
          </div>
        ))}

        {/* カレンダー日数 */}
        {calendarDays.map((day, dayIdx) => {
          const dayBookings = day ? getBookingsForDate(day) : [];
          const isCurrentMonth = day ? isSameMonth(day, visibleDate) : false;
          const isCurrentDay = day ? isToday(day) : false;
          
          return (
            <div
              key={dayIdx}
              className={cn(
                "min-h-[100px] md:min-h-[120px] lg:min-h-[140px] border rounded-md p-1 overflow-hidden",
                !day && "bg-gray-50",
                day && !isCurrentMonth && "bg-gray-50 text-gray-400",
                day && isCurrentMonth && "bg-white",
                day && isCurrentDay && "bg-blue-50 border-blue-200",
                getDay(day || new Date()) === 0 && "text-red-500", // 日曜日
                getDay(day || new Date()) === 6 && "text-blue-500"  // 土曜日
              )}
            >
              {day && (
                <>
                  <div className="text-right text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[100px]">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={cn(
                          "text-xs p-1 rounded cursor-pointer truncate",
                          booking.status === 'confirmed' && "bg-green-100 text-green-800",
                          booking.status === 'completed' && "bg-blue-100 text-blue-800",
                          booking.status === 'cancelled' && "bg-gray-100 text-gray-800 line-through"
                        )}
                      >
                        {booking.startTime.substring(0, 5)} {booking.subject}
                        <div className="text-xs truncate">
                          {booking.studentName || booking.tutorName}
                        </div>
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-center text-gray-500">
                        +{dayBookings.length - 3}件
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 justify-end text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-green-100 mr-1"></div>
          <span>予定</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-blue-100 mr-1"></div>
          <span>完了</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-gray-100 mr-1"></div>
          <span>キャンセル</span>
        </div>
      </div>
    </div>
  );
}