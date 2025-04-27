import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

export default function MyPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [ticketCount, setTicketCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("tickets")
        .select("remaining")
        .eq("student_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setTicketCount(data.remaining);
          } else {
            setTicketCount(0);
          }
        });
    }
  }, [user]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">マイページ</h1>
      {ticketCount !== null ? (
        <p>残りチケット: <span className="font-semibold">{ticketCount}</span> 枚</p>
      ) : (
        <p>読み込み中...</p>
      )}
    </div>
  );
}
