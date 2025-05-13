"use client";

import { useAuth } from "@/contexts/auth-provider";
import { useRouter } from "next/navigation";

export default function ProfileSetup() {
  const { user } = useAuth();
  const router = useRouter();

  // メンテナンスページを表示
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">メンテナンス中</h1>
        <p className="mb-4">プロファイル設定ページは現在メンテナンス中です。</p>
        <p>しばらくお待ちください。</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
