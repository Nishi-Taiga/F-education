"use client";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // セッションがあるかどうかをチェック
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    
    checkSession();
  }, []);

  // Googleログイン処理
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    } catch (error) {
      console.error("ログインエラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-6 md:p-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-blue-700">
          F-education
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-lg mb-2">
            教育をより効率的に、より効果的に。
          </p>
          <p className="text-gray-600">
            F-educationは、生徒と講師をつなぐプラットフォームです。
            簡単な予約システムとチケット制で、学習をスムーズにサポートします。
          </p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
          {isLoggedIn ? (
            <div className="space-y-4 w-full max-w-xs">
              <Link href="/dashboard" className="w-full">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  size="lg"
                >
                  ダッシュボードへ
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4 w-full max-w-xs">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                size="lg"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? "読み込み中..." : "Googleでログイン"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
