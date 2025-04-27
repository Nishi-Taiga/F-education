// /pages/admin/index.tsx
'use client';

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

export default function AdminDashboard() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/teacher/login"); // 未ログイン時にログイン画面に戻す
    }
  }, [user]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>管理者用トップページ</h1>
      <p>ようこそ、管理者さん！ここでは全ての授業・ユーザーを管理できます。</p>
    </div>
  );
}
