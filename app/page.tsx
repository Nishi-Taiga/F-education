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
              <Link href="/auth/login" className="w-full">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  size="lg"
                >
                  ログイン
                </Button>
              </Link>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>
              
              <Button 
                className="w-full bg-white text-gray-800 border border-gray-300 hover:bg-gray-50" 
                size="lg"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg
                  className="mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {isLoading ? "読み込み中..." : "Googleでログイン"}
              </Button>
              
              <div className="text-center text-sm">
                アカウントをお持ちでない場合は
                <Link href="/auth/signup" className="text-blue-600 hover:underline ml-1">
                  新規登録
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
