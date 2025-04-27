'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Calendar, { CalendarProps } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Value = Date | [Date, Date] | null;

const ReservePage = () => {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedClassTime, setSelectedClassTime] = useState<string | null>(null);
  const [bookedClasses, setBookedClasses] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [reserverType, setReserverType] = useState<string>('student');
  const [studentList, setStudentList] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // まずは生徒として検索
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (student) {
        setUserName(student.name);
        setReserverType('student');
        setSelectedStudent({ id: student.id, name: student.name });
        return;
      }

      // 次に保護者として検索
      const { data: guardian } = await supabase
        .from('guardians')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (guardian) {
        setUserName(guardian.name);
        setReserverType('guardian');

        const { data: students } = await supabase
          .from('students')
          .select('id, name')
          .eq('guardian_id', guardian.id);

        if (students && students.length > 0) {
          setStudentList(students);
          setSelectedStudent({ id: students[0].id, name: students[0].name }); // 最初の生徒をデフォルト選択
        }
      }
    };

    fetchUser();
  }, [supabase]);

  const handleDateChange: CalendarProps['onChange'] = (value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setShowPopup(true);
    }
  };

  const handleClassSelection = (time: string) => {
    setSelectedClassTime(time);
  };

  const handleAddClass = () => {
    if (selectedClassTime && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      const newClass = `${formattedDate} ${selectedClassTime}`;

      if (bookedClasses.includes(newClass)) {
        alert('この日時の授業はすでに予約されています');
        return;
      }

      setBookedClasses((prev) => [...prev, newClass]);
      setSelectedClassTime(null);
      setShowPopup(false);
    }
  };

  const handleRemoveClass = (classTime: string) => {
    setBookedClasses((prev) => prev.filter((item) => item !== classTime));
  };

  const handleConfirmReservation = async () => {
    if (reserverType === 'guardian' && !selectedStudent) {
      alert('生徒を選択してください');
      return;
    }

    const student_id = reserverType === 'guardian' ? selectedStudent?.id : userId;
    const student_name = reserverType === 'guardian' ? selectedStudent?.name : userName;

    for (const entry of bookedClasses) {
      const [date, time] = entry.split(' ');
      await supabase.from('reservations').insert({
        student_id,
        student_name,
        reserver_id: userId,
        reserver_name: userName,
        reserver_type: reserverType,
        class_date: date,
        class_time: time,
        subject: '未設定',
        teacher_name: '未設定'
      });
    }

    router.push('/student/dashboard');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">授業予約</h1>
        <span className="text-gray-600">{userName && `ログイン中：${userName}`}</span>
      </div>

      {/* 保護者なら生徒選択 */}
      {reserverType === 'guardian' && (
        <div className="mb-6">
          <label className="block font-semibold mb-2">予約対象の生徒を選択：</label>
          <select
            onChange={(e) => {
              const selected = studentList.find(s => s.id === e.target.value);
              setSelectedStudent(selected ?? null);
            }}
            value={selectedStudent?.id ?? ''}
            className="border p-2 rounded w-full"
          >
            {studentList.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* カレンダー */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">日付選択</h2>
        <Calendar
          onChange={handleDateChange}
          value={selectedDate}
          minDate={new Date()}
        />
      </div>

      {/* ポップアップ */}
      {showPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded w-80">
            <h3 className="text-xl font-semibold mb-4">授業コマを選択</h3>
            <div className="mb-4">
              {['16:00~17:30', '18:00~19:30', '20:00~21:30'].map((time) => (
                <button
                  key={time}
                  onClick={() => handleClassSelection(time)}
                  className="w-full p-2 mb-2 border rounded hover:bg-green-100"
                >
                  {time}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddClass}
              className="w-full bg-blue-500 text-white p-2 rounded"
            >
              選択した授業を追加
            </button>
            <button
              onClick={() => setShowPopup(false)}
              className="w-full mt-2 p-2 border rounded"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 選択された授業 */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">選択された授業</h2>
        {bookedClasses.length > 0 ? (
          <ul className="space-y-2">
            {bookedClasses.map((bookedClass, index) => (
              <li key={index} className="flex justify-between items-center p-2 border">
                <span>{bookedClass}</span>
                <button
                  onClick={() => handleRemoveClass(bookedClass)}
                  className="text-red-500"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div>授業は選択されていません。</div>
        )}
      </div>

      {/* 予約確定ボタン */}
      <div className="mt-6">
        <button
          onClick={handleConfirmReservation}
          className="w-full bg-green-500 text-white p-2 rounded"
        >
          予約を確定する
        </button>
      </div>
    </div>
  );
};

export default ReservePage;
