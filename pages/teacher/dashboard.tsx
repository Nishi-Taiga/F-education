// /pages/teacher/dashboard.tsx
'use client';

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

export default function TeacherDashboard() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/teacher/login");
    }
  }, [user]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>講師用トップページ</h1>
      <p>ようこそ講師さん！担当授業がここにカレンダー表示される予定です。</p>
    </div>
  );
}
