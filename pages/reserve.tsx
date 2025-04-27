'use client'
import { useState } from "react";
import { useRouter } from "next/router";
import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";

export default function ReservePage() {
  const [date, setDate] = useState(""); // 日付
  const [timeSlot, setTimeSlot] = useState(""); // 時間帯
  const [teacher, setTeacher] = useState(""); // 担当講師
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();

  const timeSlots = [
    { value: "16:00-17:30", label: "16:00〜17:30" },
    { value: "18:00-19:30", label: "18:00〜19:30" },
    { value: "20:00-21:30", label: "20:00〜21:30" }
  ];

  const teachers = [
    { value: "teacher1", label: "田中先生" },
    { value: "teacher2", label: "鈴木先生" },
    { value: "teacher3", label: "佐藤先生" }
  ];

  const handleReserve = async () => {
    if (!user) {
      alert("ユーザー情報が取得できません。ログインしてください。");
      return;
    }

    if (!date || !timeSlot || !teacher) {
      alert("日付、時間帯、担当講師を選択してください");
      return;
    }

    // Supabase に予約を保存
    const { error } = await supabase
      .from('reservations')
      .insert([
        {
          user_id: user.id,  // userがnullでない場合のみuser.idを使用
          date,
          timeSlot,
          teacher,
        },
      ]);

    if (error) {
      console.error("予約の保存エラー:", error);
      return;
    }

    // 予約確認のポップアップ表示
    alert(`「${teacher}」の授業を ${date} ${timeSlot} に予約しました。`);

    // トップページへ戻る
    router.push("/");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>授業を予約する</h1>

      <div style={{ marginTop: "1rem" }}>
        <label>
          日付：
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ marginLeft: "1rem" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label>
          時間帯：
          <select
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            style={{ marginLeft: "1rem" }}
          >
            <option value="">時間帯を選択</option>
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label>
          担当講師：
          <select
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            style={{ marginLeft: "1rem" }}
          >
            <option value="">講師を選択</option>
            {teachers.map((teacherOption) => (
              <option key={teacherOption.value} value={teacherOption.value}>
                {teacherOption.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <button onClick={handleReserve}>予約する</button>
      </div>
    </div>
  );
}
