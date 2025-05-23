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

export const SimpleCalendar: React.FC = () => {
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

  return (
    <div className="w-full max-w-full sm:max-w-lg mx-auto bg-white rounded-lg shadow p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={handlePrevMonth} className="px-2 py-1 rounded hover:bg-gray-100">←</button>
        <div className="font-bold text-lg">
          {currentYear}年 {currentMonth + 1}月
        </div>
        <button onClick={handleNextMonth} className="px-2 py-1 rounded hover:bg-gray-100">→</button>
      </div>
      <table className="w-full text-center select-none table-fixed">
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
                return (
                  <td
                    key={j}
                    className={
                      "py-1 w-8 h-8 sm:w-12 sm:h-12 " +
                      (isToday
                        ? " bg-blue-500 text-white rounded-full font-bold"
                        : day
                        ? " text-gray-900"
                        : "")
                    }
                  >
                    {day ? day : ""}
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