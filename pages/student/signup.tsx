// signup.tsx
'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("サインアップに失敗しました: " + error.message);
    } else {
      alert("確認メールを送信しました。メールをご確認ください。");
      router.push("/student/login");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">新規登録</h1>
      <input className="border p-2 w-full mb-2" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" className="border p-2 w-full mb-4" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleSignup} className="bg-blue-600 text-white px-4 py-2 rounded">登録する</button>
    </div>
  );
}
