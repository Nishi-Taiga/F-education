import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, parse, getDay } from "date-fns";
import { type Booking } from "@shared/schema";

// 予約情報に生徒名を追加するための拡張型
type ExtendedBooking = Booking & {
  studentName?: string;
};

interface CalendarViewProps {
  bookings: ExtendedBooking[];
  onSelectDate?: (date: string) => void;
  interactive?: boolean;
}

export function CalendarView({ bookings, onSelectDate, interactive = false }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  useEffect(() => {
    // Generate array of all days in current month
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    setCalendarDays(daysInMonth);
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // Get bookings for a specific day
  const getBookingsForDay = (day: Date) => {
    const dateString = format(day, "yyyy-MM-dd");
    return bookings.filter(booking => booking.date === dateString);
  };

  // Format the month header with Japanese locale
  const formattedMonth = format(currentDate, "yyyy年M月");

  // Handle day click
  const handleDayClick = (day: Date) => {
    if (!interactive || isBefore(day, new Date())) return;
    const dateString = format(day, "yyyy-MM-dd");
    onSelectDate?.(dateString);
  };

  return (
    <div className="overflow-visible">
      <div className="flex justify-between items-center mb-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="py-1 text-sm font-medium">{formattedMonth}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium mb-1">
        <div className="text-red-600">日</div>
        <div className="text-gray-500">月</div>
        <div className="text-gray-500">火</div>
        <div className="text-gray-500">水</div>
        <div className="text-gray-500">木</div>
        <div className="text-gray-500">金</div>
        <div className="text-blue-600">土</div>
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {/* Empty cells for days of previous month */}
        {Array.from({ length: new Date(calendarDays[0]?.getFullYear(), calendarDays[0]?.getMonth(), 1).getDay() }).map((_, index) => (
          <div key={`empty-start-${index}`} className="aspect-square p-0.5">
            <div className="h-full rounded-md bg-gray-50 flex flex-col opacity-50">
              <div className="p-0.5 text-center">
                <span className="text-gray-400"></span>
              </div>
            </div>
          </div>
        ))}

        {/* Days of current month */}
        {calendarDays.map((day) => {
          const dayBookings = getBookingsForDay(day);
          const isPast = isBefore(day, new Date()) && !isToday(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelectable = interactive && !isPast;
          const dayOfWeek = getDay(day);
          
          // 曜日に基づく色分け
          let textColorClass = "text-gray-900";
          if (dayOfWeek === 0) { // 日曜日
            textColorClass = "text-red-600";
          } else if (dayOfWeek === 6) { // 土曜日
            textColorClass = "text-blue-600";
          }
          
          return (
            <div key={day.toString()} className="aspect-square p-0.5">
              <div 
                className={`h-full rounded-md ${isSelectable ? 'hover:bg-gray-50 cursor-pointer' : ''} flex flex-col ${isPast ? 'opacity-60' : ''}`}
                onClick={() => isSelectable && handleDayClick(day)}
              >
                <div className="p-0.5 text-center">
                  <span className={`
                    ${isToday(day) ? 'bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center mx-auto' : ''}
                    ${!isCurrentMonth ? 'text-gray-400' : textColorClass}
                  `}>
                    {day.getDate()}
                  </span>
                </div>
                {dayBookings.map((booking, index) => (
                  <div key={index} className="mt-auto mb-0.5 mx-0.5">
                    <div 
                      className="px-0.5 py-0.5 text-[10px] rounded bg-primary text-white text-center relative group"
                      title={booking.studentName ? `${booking.studentName}` : '予約済み'}
                    >
                      <span className="block truncate">{booking.timeSlot.split('-')[0]}</span>
                      {/* 学生情報のツールチップ */}
                      {booking.studentId && (
                        <div className="absolute left-0 bottom-full mb-1 w-max z-10 hidden group-hover:block">
                          <div className="bg-gray-800 text-white text-[10px] rounded py-0.5 px-1.5 shadow-lg">
                            {booking.studentName ? (
                              <span>{booking.studentName}</span>
                            ) : (
                              <span>生徒ID: {booking.studentId}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
