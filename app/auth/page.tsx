"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// Login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  password: z.string().min(1, { message: "パスワードは必須です" }),
});

// Register form schema
const registerSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  password: z.string().min(6, { message: "パスワードは6文字以上必要です" }),
});

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Login submit handler
  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      
      if (error) {
        throw error;
      }
      
      router.push("/dashboard");
      toast({
        title: "ログイン成功",
        description: `ようこそ、${values.email}さん`,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "ログイン失敗",
        description: error.message || "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Register submit handler
  async function onRegisterSubmit(values: z.infer<typeof registerSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            username: values.email,
            displayName: values.email.split('@')[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "登録完了",
        description: "アカウントが作成されました。確認メールをご確認ください。",
      });
      
      // 登録成功後にログインタブに切り替え
      setActiveTab("login");
      registerForm.reset();
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "登録失敗",
        description: error.message || "アカウント登録に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-stretch screen-container">
      <div className="flex-1 flex items-center justify-center p-4 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-primary mb-2">F education 予約システム</h1>
            <p className="text-sm text-gray-600">サービスをご利用するには、アカウントへのログインが必要です</p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="login">ログイン</TabsTrigger>
              <TabsTrigger value="register">アカウント作成</TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">アカウントにログイン</CardTitle>
                  <CardDescription className="text-xs">
                    メールアドレスとパスワードを入力してください
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>メールアドレス</FormLabel>
                            <FormControl>
                              <Input placeholder="example@email.com" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>パスワード</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ログイン中...
                          </>
                        ) : (
                          "ログイン"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center py-2">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs" 
                    onClick={() => setActiveTab("register")}
                  >
                    アカウントをお持ちでない方はこちら
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Register Form */}
            <TabsContent value="register">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">新規アカウント作成</CardTitle>
                  <CardDescription className="text-xs">
                    メールアドレスとパスワードを入力してアカウントを作成
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3">
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>メールアドレス</FormLabel>
                            <FormControl>
                              <Input placeholder="example@email.com" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>パスワード</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            アカウント作成中...
                          </>
                        ) : (
                          "アカウントを作成"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center py-2">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs" 
                    onClick={() => setActiveTab("login")}
                  >
                    既にアカウントをお持ちの方はこちら
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* 右側の説明パネル（デスクトップのみ表示） */}
      <div className="flex-1 bg-primary p-6 text-white hidden md:flex flex-col justify-center form-container">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-4">F education 予約システム</h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <svg className="h-5 w-5 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-sm">素早く簡単に授業の予約ができます</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-sm">経験豊富な教師陣が丁寧に指導します</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-sm">オンラインでチケットを購入して、好きな時間に授業を受けられます</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
