'use client'

import React, { useEffect, useState } from "react";  // Reactをインポート
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function Dashboard() {
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [ticketCount, setTicketCount] = useState(0);
  const [reservedClasses, setReservedClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);  // ユーザー名を保持するための状態を追加

  // ユーザー情報を取得し、関連情報も取得する関数
  const fetchUserInfo = async () => {
    setLoading(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.user) {
      router.push("/student/login");
      return;
    }

    const user = sessionData.session.user;

    // ユーザー名（lastName + firstName）をセット
    const { data: guardianData, error: guardianError } = await supabase
      .from("guardians")
      .select("lastName, firstName")
      .eq("user_id", user.id)
      .single();

    if (guardianError) {
      console.error("ユーザー情報取得エラー", guardianError);
    } else {
      setUserName(`${guardianData?.lastName} ${guardianData?.firstName}`);
    }

    try {
      // 残チケット数取得（user_idベース）
      const { data: tickets, error: ticketError } = await supabase
        .from("guardians")
        .select("ticketcount")
        .eq("user_id", user.id)  // user_idベースに変更
        .single();

      if (ticketError) throw ticketError;
      setTicketCount(tickets?.ticketcount || 0);

      // 予約済み授業取得（user_idベース）
      const { data: reservations, error: reservationError } = await supabase
        .from("reservations")
        .select("*")
        .eq("reserver_id", user.id);

      if (reservationError) throw reservationError;
      setReservedClasses(reservations || []);
    } catch (error) {
      console.error("情報取得エラー", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">マイページ</h1>

      {/* ユーザー名表示 */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">こんにちは、{userName} さん</h2>
      </div>

      {/* チケット残数 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">残チケット数</h2>
        <div className="bg-blue-200 p-4 rounded">{ticketCount} チケット</div>
      </div>

      {/* 予約済み授業一覧 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">予約済み授業一覧</h2>
        {reservedClasses.length > 0 ? (
          <ul>
            {reservedClasses.map((reservation) => (
              <li key={reservation.id} className="border p-2 mb-2">
                <p>科目: {reservation.subject}</p>
                <p>日時: {reservation.date}</p>
                <p>講師: {reservation.teacher}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div>予約された授業はありません。</div>
        )}
      </div>

      {/* ボタン群 */}
      <div className="flex justify-between mt-8 flex-col md:flex-row gap-4">
        <button
          onClick={() => router.push("/ticket-purchase")}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          チケット購入
        </button>

        <button
          onClick={() => router.push("/student/reserve")}  // 予約画面へ遷移
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          授業予約
        </button>

        <button
          onClick={() => router.push("/personal-settings")}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          個人設定
        </button>
      </div>
    </div>
  );
}
