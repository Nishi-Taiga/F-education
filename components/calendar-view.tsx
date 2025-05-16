"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  addMonths, subMonths, format, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isToday, isBefore, getDay,
  addDays, subDays
} from "date-fns";

// 基本的な予約型
type Booking = {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  tutorShiftId?: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string;
  studentName?: string;
  openEditAfterClose?: boolean;
};

// カレンダーコンポーネント用の拡張された予約型
type ExtendedBooking = Omit<Booking, 'createdAt'> & {
  createdAt: string | Date;
  studentName?: string;
};

interface CalendarViewProps {
  bookings: ExtendedBooking[];
  onSelectDate?: (date: string) => void;
  onBookingClick?: (booking: ExtendedBooking) => void; // 予約クリック時のコールバック
  interactive?: boolean;
  showLegend?: boolean; // 凡例を表示するかどうか
}

export function CalendarView({ bookings, onSelectDate, onBookingClick, interactive = false, showLegend = false }: CalendarViewProps) {
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
    
    // 月の最後の日を土曜日までに調整する
    // 月の最後の日の曜日を取得（0は日曜日、6は土曜日）
    const endDay = getDay(monthEnd);
    let calendarEnd = monthEnd;
    
    if (endDay < 6) {
      // 土曜日でない場合、6 - endDay日分先に進む（土曜日までを含める）
      calendarEnd = addDays(monthEnd, 6 - endDay);
    } else if (endDay > 6) {
      // 不正な値の場合（通常は発生しない）、土曜日に調整
      calendarEnd = addDays(monthEnd, 6 - (endDay % 7));
    }
    // endDay === 6 (土曜日)の場合は何もしない（すでに土曜日で終わっている）
    
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
  
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
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
    // キャンセルされた授業は含めない
    if (booking.status === 'cancelled') {
      return 'upcoming';
    }
    
    // レポート完了状態なら「完了済み」（緑色）- 拡張対応
    if (booking.reportStatus === 'completed' || 
        (booking.reportStatus && booking.reportStatus.startsWith('completed'))) {
      return 'completed-with-report';
    }
    
    // 現在の日本時間を取得（UTC+9）
    const now = new Date();
    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJapan = japanTime.toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    // 授業の日付
    const lessonDate = booking.date;
    
    // 日付の比較（今日より前の日付なら「未報告」）
    if (lessonDate < todayJapan) {
      // 過去の未報告授業（赤色）
      return 'completed-no-report';
    } else if (lessonDate === todayJapan) {
      // 当日の授業（青色）
      return 'upcoming';
    } else {
      // 未来の授業（青色）
      return 'upcoming';
    }
  };

  // Format the month header with Japanese locale
  const formattedMonth = format(currentDate, "yyyy年M月");

  // Handle day click
  const handleDayClick = (day: Date) => {
    // 当日の授業予約も可能に修正
    // 過去の日付のみ選択不可（当日は選択可能）
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 当日の0時0分にして比較する
    
    if (!interactive || isBefore(day, today)) return;
    const dateString = format(day, "yyyy-MM-dd");
    onSelectDate?.(dateString);
  };

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col mb-3">
        {/* 年月表示と色の凡例を1行に配置 */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="py-1 text-base md:text-xl font-bold">{formattedMonth}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 色の凡例 - 生徒保護者用と講師用で表示内容を分ける */}
          <div className="flex items-center gap-1 text-[10px] md:text-xs bg-gray-50 p-1 rounded-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-500 mr-0.5 md:mr-1 rounded-full"></div>
              <span className="font-medium">予定</span>
            </div>
            {showLegend ? (
              <>
                <div className="flex items-center">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 mr-0.5 md:mr-1 rounded-full"></div>
                  <span className="font-medium">未報告</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 mr-0.5 md:mr-1 rounded-full"></div>
                  <span className="font-medium">報告済</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 mr-0.5 md:mr-1 rounded-full"></div>
                  <span className="font-medium">未報告</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 mr-0.5 md:mr-1 rounded-full"></div>
                  <span className="font-medium">報告あり</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-medium mb-2">
        <div className="text-red-600 text-sm md:text-base">日</div>
        <div className="text-gray-700 text-sm md:text-base">月</div>
        <div className="text-gray-700 text-sm md:text-base">火</div>
        <div className="text-gray-700 text-sm md:text-base">水</div>
        <div className="text-gray-700 text-sm md:text-base">木</div>
        <div className="text-gray-700 text-sm md:text-base">金</div>
        <div className="text-blue-600 text-sm md:text-base">土</div>
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs max-w-full overflow-hidden">
        {/* Days of current month */}
        {calendarDays.map((day) => {
          const dayBookings = getBookingsForDay(day);
          const japanTime = getJapanTime();
          const isCurrentDay = isToday(day);
          // 日付が昨日以前の場合のみ過去とみなす（今日と将来の日付は過去とみなさない）
          const today = new Date();
          today.setHours(0,0,0,0);
          const isPast = isBefore(day, today);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelectable = interactive && (!isPast || isCurrentDay);
          const dayOfWeek = getDay(day);
          
          // 曜日に基づく色分け
          let textColorClass = "text-gray-900";
          if (dayOfWeek === 0) { // 日曜日
            textColorClass = "text-red-600";
          } else if (dayOfWeek === 6) { // 土曜日
            textColorClass = "text-blue-600";
          }
          
          // 予約の数に応じてセルの高さを動的に計算
          const hasThreeOrMoreBookings = dayBookings.length >= 3;
          
          return (
            <div key={day.toString()} className={`p-0.5 min-w-0 ${hasThreeOrMoreBookings ? 'aspect-auto' : 'aspect-square'}`} 
                 style={{
                   height: hasThreeOrMoreBookings ? (typeof window !== 'undefined' && window.innerWidth < 640 ? '100px' : '180px') : 'auto'
                 }}>
              <div 
                className={`h-full rounded-md ${isSelectable ? 'hover:bg-gray-50 cursor-pointer' : ''} 
                  ${isPast && !isCurrentDay ? 'opacity-60' : ''} 
                  overflow-hidden flex flex-col`}
                style={{ 
                  minHeight: hasThreeOrMoreBookings ? 
                    (typeof window !== 'undefined' && window.innerWidth < 640 ? '95px' : '170px') : 
                    (typeof window !== 'undefined' && window.innerWidth < 640 ? '60px' : '80px'),
                  height: '100%'
                }}
                onClick={() => isSelectable && handleDayClick(day)}
              >
                <div className={`p-0.5 text-center`}>
                  <span className={`
                    ${isCurrentDay ? 'bg-primary text-white rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center mx-auto text-sm md:text-base font-bold' : 'text-sm md:text-base font-medium'}
                    ${!isCurrentMonth ? 'text-gray-400' : textColorClass}
                  `}>
                    {day.getDate()}
                  </span>
                </div>
                {/* 最大3件まで表示 */}
                {dayBookings.slice(0, 3).map((booking, index) => {
                  // 授業状態に応じた色分け
                  const lessonStatus = getLessonStatus(booking);
                  let bgColorClass = "bg-blue-500"; // デフォルト：これから（青）
                  
                  if (lessonStatus === 'completed-no-report') {
                    bgColorClass = "bg-red-500"; // 未報告（赤）
                  } else if (lessonStatus === 'completed-with-report') {
                    bgColorClass = "bg-green-500"; // 報告済（緑）
                  }
                  
                  return (
                    <div key={index} className={`${index > 0 ? 'mt-1 md:mt-1.5' : 'mt-0.5'} min-w-0 w-full`}>
                      <div 
                        className={`${typeof window !== 'undefined' && window.innerWidth < 640 ? 'px-1 py-0.5' : 'px-1 py-0.5'} rounded ${bgColorClass} text-white relative cursor-pointer flex flex-col`}
                        title={booking.studentName ? `${booking.studentName} (${booking.timeSlot})${lessonStatus === 'completed-no-report' ? ' - 報告未作成' : ''}` : '予約済み'}
                        onClick={(e) => {
                          e.stopPropagation(); // 日付クリックイベントが発火するのを防ぐ
                          onBookingClick?.(booking);
                        }}
                      >
                        {/* 時間のみの表示（スペース効率化） */}
                        <div className="text-center text-[9px] md:text-[10px] font-medium whitespace-nowrap">
                          {booking.timeSlot.split('-')[0]}
                        </div>
                        
                        {/* 生徒名 - PCのみ表示（モバイルでは非表示） */}
                        {booking.studentName && (
                          <div className="hidden md:block bg-white bg-opacity-50 text-black rounded-sm text-center px-0.5 py-0.5 text-[9px] md:text-[10px] font-medium mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                            {booking.studentName.length > 8 ? `${booking.studentName.substring(0, 7)}…` : booking.studentName}
                          </div>
                        )}
                        
                        {/* 学生情報のツールチップ - PC表示のみ */}
                        <div className="absolute left-0 bottom-full mb-1 w-max z-10 hidden md:group-hover:block">
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
                
                {/* 3件以上ある場合は+N件という表示を追加 */}
                {dayBookings.length > 3 && (
                  <div className="mt-0.5 text-[8px] text-center text-gray-600 font-medium">
                    +{dayBookings.length - 3}件
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}