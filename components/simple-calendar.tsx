import React, { useState } from "react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getDaysInMonth(year: number, month: number) {
  // month: 0-indexed
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0: Sunday, 1: Monday, ...
  return new Date(year, month, 1).getDay();
}

// 予約データ型
export type CalendarBooking = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  subject: string;
  [key: string]: any;
};

interface SimpleCalendarProps {
  bookings?: CalendarBooking[];
}

export const SimpleCalendar: React.FC<SimpleCalendarProps> = ({ bookings = [] }) => {
  // todayを毎回レンダリング時に取得
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  // カレンダーの2次元配列を作成
  const calendar: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfWeek).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      calendar.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    calendar.push(week);
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 昨日以前の日付判定
  const isPastDay = (day: number | null) => {
    if (!day) return false;
    const thisDate = new Date(currentYear, currentMonth, day);
    // 今日未満ならtrue
    return thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  // 指定日付の予約一覧
  const getBookingsForDay = (day: number) => {
    return bookings.filter(b => {
      return (
        b.date.getFullYear() === currentYear &&
        b.date.getMonth() === currentMonth &&
        b.date.getDate() === day
      );
    });
  };

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 mx-auto bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <button onClick={handlePrevMonth} className="px-2 py-1 rounded hover:bg-gray-100">←</button>
        <div className="font-bold text-lg">
          {currentYear}年 {currentMonth + 1}月
        </div>
        <button onClick={handleNextMonth} className="px-2 py-1 rounded hover:bg-gray-100">→</button>
      </div>
      <table className="w-full text-center select-none table-fixed" style={{ minHeight: '510px' }}>
        <thead>
          <tr>
            {WEEKDAYS.map((wd, idx) => (
              <th
                key={wd}
                className={
                  "py-1 text-xs font-semibold " +
                  (idx === 0
                    ? "text-red-500"
                    : idx === 6
                    ? "text-blue-500"
                    : "text-gray-500")
                }
              >
                {wd}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                const isToday =
                  day &&
                  currentYear === today.getFullYear() &&
                  currentMonth === today.getMonth() &&
                  day === today.getDate();
                const isPast = day && isPastDay(day);
                const dayBookings = day ? getBookingsForDay(day) : [];
                return (
                  <td
                    key={j}
                    className={
                      "align-top py-1 w-10 h-24 sm:w-16 sm:h-24 "+
                      (isPast
                        ? " text-gray-300"
                        : day
                        ? " text-gray-900"
                        : "")
                    }
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          (isToday
                            ? "bg-blue-500 text-white rounded-full font-bold "
                            : "") +
                          " text-sm w-6 h-6 flex items-center justify-center mx-auto mb-0.5"
                        }
                        style={isToday ? { minWidth: '1.5rem', minHeight: '1.5rem', lineHeight: '1.5rem' } : {}}
                      >
                        {day ? day : ""}
                      </span>
                      {dayBookings.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {dayBookings.map(b => (
                            <div key={b.id} className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate">
                              {b.subject}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 