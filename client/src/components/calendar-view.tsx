import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, parse } from "date-fns";
import { type Booking } from "@shared/schema";

interface CalendarViewProps {
  bookings: Booking[];
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
    <div className="overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="py-2 font-medium">{formattedMonth}</span>
        <Button variant="ghost" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 mb-2">
        <div>日</div>
        <div>月</div>
        <div>火</div>
        <div>水</div>
        <div>木</div>
        <div>金</div>
        <div>土</div>
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {/* Empty cells for days of previous month */}
        {Array.from({ length: new Date(calendarDays[0]?.getFullYear(), calendarDays[0]?.getMonth(), 1).getDay() }).map((_, index) => (
          <div key={`empty-start-${index}`} className="aspect-square p-1">
            <div className="h-full rounded-md bg-gray-50 flex flex-col opacity-50">
              <div className="p-1 text-center">
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
          
          return (
            <div key={day.toString()} className="aspect-square p-1">
              <div 
                className={`h-full rounded-md ${isSelectable ? 'hover:bg-gray-50 cursor-pointer' : ''} flex flex-col ${isPast ? 'opacity-60' : ''}`}
                onClick={() => isSelectable && handleDayClick(day)}
              >
                <div className="p-1 text-center">
                  <span className={`
                    ${isToday(day) ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto' : ''}
                    ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                  `}>
                    {day.getDate()}
                  </span>
                </div>
                {dayBookings.map((booking, index) => (
                  <div key={index} className="mt-auto mb-1 mx-1">
                    <div 
                      className="px-1 py-0.5 text-xs rounded bg-primary text-white text-center relative group"
                      title={booking.studentId ? `予約済み` : '予約済み'}
                    >
                      <span className="block truncate">{booking.timeSlot.split('-')[0]}</span>
                      {/* 学生情報のツールチップ */}
                      {booking.studentId && (
                        <div className="absolute left-0 bottom-full mb-1 w-max z-10 hidden group-hover:block">
                          <div className="bg-gray-800 text-white text-xs rounded py-1 px-2 shadow-lg">
                            <span>ID: {booking.studentId}</span>
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
