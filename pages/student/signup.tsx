// student/signup.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSignup = async () => {
    if (!email || !password) {
      alert("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      console.error("サインアップエラー:", error.message);
      alert("サインアップに失敗しました: " + error.message);
    } else {
      alert("確認メールを送信しました！メールをご確認ください。");
      router.push("/student/login");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">新規登録</h1>
      <div className="mb-4">
        <input
          type="email"
          className="border p-2 w-full rounded"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="mb-6">
        <input
          type="password"
          className="border p-2 w-full rounded"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        onClick={handleSignup}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "登録中..." : "登録する"}
      </button>
    </div>
  );
}
