'use client'
import { useEffect, useState } from "react";
import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';

export default function Home() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [reservations, setReservations] = useState<{ date: string; timeSlot: string; teacher: string }[]>([]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // チケット数取得（仮データ）
    setTicketCount(3);

    // 予約情報の取得
    const fetchReservations = async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('date, timeSlot, teacher')
        .eq('user_id', user.id); // user.id を使ってユーザーごとの予約を取得

      if (error) {
        console.error("予約情報の取得エラー:", error);
        return;
      }

      setReservations(data);
    };

    fetchReservations();
  }, [user, router, supabase]);

  if (!user) {
    return null; // ログインページにリダイレクト中
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>マイページ</h1>
      <p>残りのチケット数: <strong>{ticketCount !== null ? ticketCount : "読み込み中..."}</strong></p>

      <h2>授業予定</h2>
      <Calendar
        tileClassName={({ date }) => {
          const dateString = date.toDateString();
          return reservations.some(res => res.date === dateString) ? 'highlight' : null;
        }}
      />

      <div style={{ marginTop: "2rem" }}>
        <button onClick={() => router.push("/reserve")} style={{ marginRight: "1rem" }}>
          授業予約へ
        </button>
        <button onClick={() => router.push("/purchase")}>
          チケット購入へ
        </button>
      </div>

      <style jsx>{`
        .highlight {
          background: #86efac !important;
          color: #000;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
