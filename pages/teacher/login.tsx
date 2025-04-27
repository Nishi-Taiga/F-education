'use client';
import { useState } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabase = useSupabaseClient();
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("ログインに失敗しました：" + error.message);
      return;
    }

    // ユーザーのロールを取得して管理者か講師か判断
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      alert("ユーザー情報の取得に失敗しました：" + userError.message);
      return;
    }

    // ロールに応じたリダイレクト
    if (userData.role_id === 1) { // 管理者の場合
      router.push("/admin"); // 管理者用トップページへ
    } else if (userData.role_id === 2) { // 講師の場合
      router.push("/teacher/dashboard"); // 講師用トップページへ
    } else {
      alert("不正なロールです");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>講師ログイン</h1>
      <div>
        <label>
          メール：
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginLeft: "1rem" }}
          />
        </label>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <label>
          パスワード：
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginLeft: "1rem" }}
          />
        </label>
      </div>
      <div style={{ marginTop: "2rem" }}>
        <button onClick={handleLogin}>ログイン</button>
      </div>
    </div>
  );
}
