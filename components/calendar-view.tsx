// calendar-view.tsx
import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, isToday, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
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
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">
            {format(visibleDate, 'yyyy年MM月', { locale: ja })}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handlePreviousMonth}
            className="border-gray-300 shadow-sm"
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
            className="border-gray-300 shadow-sm text-sm font-medium"
          >
            今日
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleNextMonth}
            className="border-gray-300 shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* 曜日ヘッダー */}
        {weekdays.map((day, index) => (
          <div
            key={index}
            className={cn(
              "h-10 flex items-center justify-center text-sm font-medium rounded-md",
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
                "min-h-[100px] md:min-h-[120px] lg:min-h-[150px] border rounded-md p-1 transition-all",
                !day && "bg-gray-50 border-transparent",
                day && !isCurrentMonth && "bg-gray-50 text-gray-400 border-gray-100",
                day && isCurrentMonth && "bg-white border-gray-200 hover:border-gray-300",
                day && isCurrentDay && "bg-blue-50 border-blue-200 shadow-sm",
                getDay(day || new Date()) === 0 && "text-red-500", // 日曜日
                getDay(day || new Date()) === 6 && "text-blue-500"  // 土曜日
              )}
            >
              {day && (
                <>
                  <div className={cn(
                    "text-right font-medium mb-1.5 pr-1",
                    isCurrentDay ? "text-blue-600" : "text-gray-700",
                    "text-sm"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[110px] scrollbar-hide">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={cn(
                          "text-xs py-1.5 px-2 rounded-md cursor-pointer truncate transition-colors",
                          booking.status === 'confirmed' && "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
                          booking.status === 'completed' && "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200",
                          booking.status === 'cancelled' && "bg-gray-100 text-gray-800 line-through hover:bg-gray-200 border border-gray-200",
                          "shadow-sm"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{booking.startTime.substring(0, 5)}</span>
                          <span className="truncate ml-1">{booking.subject}</span>
                        </div>
                        <div className="text-xs truncate mt-0.5">
                          {booking.studentName || booking.tutorName}
                        </div>
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-center text-gray-500 bg-gray-50 py-1 rounded mt-1 border border-gray-200">
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
      <div className="flex flex-wrap gap-4 justify-end text-xs pt-2">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200 mr-1.5"></div>
          <span className="text-sm">予定</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200 mr-1.5"></div>
          <span className="text-sm">完了</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200 mr-1.5"></div>
          <span className="text-sm">キャンセル</span>
        </div>
      </div>
    </div>
  );
}