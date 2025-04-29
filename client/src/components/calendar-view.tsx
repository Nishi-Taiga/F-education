import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  addMonths, subMonths, format, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isToday, isBefore, getDay,
  addDays, subDays
} from "date-fns";
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
    // 月の最初と最後の日を取得
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // 前月の最後の日曜日を計算
    // 月の最初の日の曜日を取得（0は日曜日）
    const startDay = getDay(monthStart);
    // 日曜日でない場合は前の日曜日まで戻る
    let calendarStart = monthStart;
    if (startDay > 0) {
      // startDay日分前に戻る
      calendarStart = subDays(monthStart, startDay);
    }
    
    // 翌月の最初の日曜日を計算
    // 月の最後の日の曜日を取得
    const endDay = getDay(monthEnd);
    // 土曜日でない場合は次の日曜日まで進む
    let calendarEnd = monthEnd;
    if (endDay < 6) {
      // 6 - endDay日分先に進む（土曜日までを含める）
      calendarEnd = addDays(monthEnd, 6 - endDay);
    } else if (endDay === 6) {
      // 土曜日の場合は次の日曜日（翌日）を含める
      calendarEnd = addDays(monthEnd, 1);
    }
    
    // 計算された期間の日付配列を生成
    const daysInCalendar = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    setCalendarDays(daysInCalendar);
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
  
  // 日本時間を取得するヘルパー関数
  const getJapanTime = () => {
    const now = new Date();
    // 日本時間（UTC+9）に調整
    return new Date(now.getTime() + (9 * 60 * 60 * 1000));
  };

  // 授業の状態を確認する関数
  const getLessonStatus = (booking: ExtendedBooking): 'upcoming' | 'completed-no-report' | 'completed-with-report' => {
    // 授業終了時間を計算
    const [startTime, endTime] = booking.timeSlot.split('-');
    const lessonDate = new Date(`${booking.date}T${endTime}:00`);
    
    // キャンセルされた授業は含めない
    if (booking.status === 'cancelled') {
      return 'upcoming';
    }
    
    // 日本時間で現在時刻を取得
    const nowJapan = getJapanTime();
    
    // 現在時刻より未来のレッスンは「これから」（日本時間で比較）
    if (lessonDate > nowJapan) {
      return 'upcoming';
    }
    
    // 過去のレッスンで、レポート完了状態なら「完了済み」
    if (booking.reportStatus === 'completed') {
      return 'completed-with-report';
    }
    
    // 過去のレッスンで、レポート未完了なら「要報告」
    return 'completed-no-report';
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
      <div className="flex flex-col md:flex-row justify-between items-center mb-3">
        <div className="flex items-center mb-2 md:mb-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="py-1 text-xl font-bold">{formattedMonth}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* 色の凡例 */}
        <div className="flex items-center gap-3 text-xs bg-gray-50 p-2 rounded-lg">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 mr-1 rounded-full"></div>
            <span className="font-medium">予定</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 mr-1 rounded-full"></div>
            <span className="font-medium">未報告</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 mr-1 rounded-full"></div>
            <span className="font-medium">報告済</span>
          </div>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-medium mb-2">
        <div className="text-red-600 text-base">日</div>
        <div className="text-gray-700 text-base">月</div>
        <div className="text-gray-700 text-base">火</div>
        <div className="text-gray-700 text-base">水</div>
        <div className="text-gray-700 text-base">木</div>
        <div className="text-gray-700 text-base">金</div>
        <div className="text-blue-600 text-base">土</div>
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {/* カレンダー日表示のみ（空セルは不要） */}

        {/* Days of current month */}
        {calendarDays.map((day) => {
          const dayBookings = getBookingsForDay(day);
          const japanTime = getJapanTime();
          const isPast = isBefore(day, japanTime) && !isToday(day);
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
                    ${format(day, 'yyyy-MM-dd') === format(japanTime, 'yyyy-MM-dd') ? 'bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto text-base font-medium' : 'text-base font-medium'}
                    ${!isCurrentMonth ? 'text-gray-400' : textColorClass}
                  `}>
                    {day.getDate()}
                  </span>
                </div>
                {dayBookings.map((booking, index) => {
                  // 授業状態に応じた色分け
                  const lessonStatus = getLessonStatus(booking);
                  let bgColorClass = "bg-blue-500"; // デフォルト：これから（青）
                  
                  if (lessonStatus === 'completed-no-report') {
                    bgColorClass = "bg-red-500"; // 未報告（赤）
                  } else if (lessonStatus === 'completed-with-report') {
                    bgColorClass = "bg-green-500"; // 報告済（緑）
                  }
                  
                  return (
                    <div key={index} className="mt-auto mb-0.5 mx-0.5">
                      <div 
                        className={`px-1 py-0.5 text-[10px] leading-tight rounded ${bgColorClass} text-white text-center relative group overflow-hidden`}
                        title={booking.studentName ? `${booking.studentName} (${booking.timeSlot})${lessonStatus === 'completed-no-report' ? ' - 報告未作成' : ''}` : '予約済み'}
                      >
                        <span className="block truncate font-medium">{booking.timeSlot.split('-')[0]}</span>
                        {booking.studentName && (
                          <span className="block truncate whitespace-nowrap text-[9px] bg-opacity-80 bg-primary-foreground text-primary rounded-sm font-medium">
                            {booking.studentName}
                          </span>
                        )}
                        {/* 学生情報のツールチップ */}
                        <div className="absolute left-0 bottom-full mb-1 w-max z-10 hidden group-hover:block">
                          <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-lg">
                            {booking.studentName ? (
                              <>
                                <div className="font-semibold text-sm">{booking.studentName}</div>
                                <div className="mt-1">{booking.timeSlot} - {booking.subject}</div>
                                {lessonStatus === 'completed-no-report' && (
                                  <div className="text-red-300 font-semibold mt-1">⚠️ 報告書未作成</div>
                                )}
                                {lessonStatus === 'completed-with-report' && (
                                  <div className="text-green-300 font-semibold mt-1">✓ 報告書作成済</div>
                                )}
                              </>
                            ) : booking.studentId ? (
                              <span>生徒ID: {booking.studentId}</span>
                            ) : (
                              <span>予約済み</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
