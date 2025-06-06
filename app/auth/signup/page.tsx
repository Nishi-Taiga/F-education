"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// 正しいSupabase URL
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // SupabaseのURLを確認（コンポーネントマウント時）
  useEffect(() => {
    // スーパーベース接続情報をコンソールに表示
    console.log('Current Supabase URL from ENV:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not available');
    console.log('Using hardcoded URL fallback:', SUPABASE_URL);
  }, []);

  // メールとパスワードで新規登録
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ネットワークエラーをリセット
    setNetworkError(null);
    
    if (!email || !password) {
      toast({
        title: "エラー",
        description: "メールアドレスとパスワードを入力してください",
        variant: "destructive",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "エラー",
        description: "パスワードが一致しません",
        variant: "destructive",
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: "エラー",
        description: "パスワードは6文字以上にしてください",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 実際のURLを指定
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("Redirect URL:", redirectUrl);
      
      // 独自のネットワークチェック（省略可能）
      try {
        console.log('Testing network connectivity...');
        await fetch('https://www.google.com', { 
          method: 'HEAD',
          mode: 'no-cors'
        });
        console.log('Network connectivity test successful');
      } catch (err) {
        console.error('Network test failed:', err);
        // フェールしても続行
      }
      
      // 最終的なサインアップ試行
      console.log(`Attempting signup with Supabase at ${SUPABASE_URL}`);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            email,
          }
        },
      });
      
      if (error) {
        throw error;
      }
      
      console.log("Registration response:", data);
      
      // 登録成功
      toast({
        title: "登録完了",
        description: "確認メールを送信しました。メールをご確認ください。",
      });
      
      // ホームページに戻る
      router.push('/');
    } catch (error: any) {
      console.error("登録エラー:", error);
      
      // エラーメッセージを設定
      let errorMessage = "登録に失敗しました";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.message && error.message.includes("fetch")) {
        errorMessage = "ネットワーク接続に問題があります。インターネット接続を確認してください。";
      }
      
      if (networkError) {
        errorMessage = networkError;
      }
      
      toast({
        title: "登録エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Googleで登録
  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      setNetworkError(null);
      
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("Google OAuth Redirect URL:", redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (error) {
        throw error;
      }
      
      console.log("Google OAuth response:", data);
      
    } catch (error: any) {
      console.error("Google登録エラー:", error);
      
      let errorMessage = "Google登録に失敗しました";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.message && error.message.includes("fetch")) {
        errorMessage = "ネットワーク接続に問題があります。インターネット接続を確認してください。";
      }
      
      toast({
        title: "登録エラー",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">アカウント登録</CardTitle>
            <CardDescription>
              F-educationのアカウントを作成してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            {networkError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <p className="text-sm font-medium">{networkError}</p>
                <p className="text-xs mt-1">接続を確認して再度お試しください。</p>
              </div>
            )}
            
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500">6文字以上で入力してください</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">パスワード（確認）</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "登録中..." : "登録する"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignup}
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
              Googleで登録
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <div className="text-center text-sm">
              すでにアカウントをお持ちの場合は
              <Link href="/auth/login" className="text-blue-600 hover:underline ml-1">
                ログイン
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}