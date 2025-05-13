"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";

// フォームのバリデーションスキーマ
const profileFormSchema = z.object({
  firstName: z.string().min(1, "名前は必須です"),
  lastName: z.string().min(1, "姓は必須です"),
  role: z.enum(["parent", "student", "tutor"], {
    required_error: "役割を選択してください",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Supabase URLとテーブル名
const SUPABASE_URL = 'https://iknunqtcfpdpwkovggqr.supabase.co';
const USERS_TABLE = 'users';

export default function ProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // フォーム設定
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      role: "parent",
    },
  });

  // ユーザー情報の取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          console.log("No session found, redirecting to home");
          router.push('/');
          return;
        }
        
        console.log("Session found, user email:", session.user.email);
        console.log("Auth user ID:", session.user.id);
        
        // ユーザーIDを保存
        setUserId(session.user.id);
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from(USERS_TABLE)
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
          
        if (userError && userError.code !== 'PGRST116') {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          // エラーがあってもフォームは表示
          setIsLoading(false);
          return;
        }
        
        // ユーザーが存在する場合はフォームに入力
        if (userData) {
          console.log("Existing user data found:", userData);
          form.reset({
            firstName: userData.first_name || "",
            lastName: userData.last_name || "",
            role: userData.role || "parent",
          });
        } else {
          // 新規ユーザーの場合、認証情報からユーザーレコードを作成
          console.log("Creating new user record for:", session.user.email);
          const { data: newUser, error: createError } = await supabase
            .from(USERS_TABLE)
            .insert([{ 
              auth_user_id: session.user.id,
              email: session.user.email,
              role: 'parent'
            }])
            .select();
            
          if (createError) {
            console.error("ユーザー作成エラー:", createError);
            toast({
              title: "エラー",
              description: "ユーザーの作成に失敗しました",
              variant: "destructive",
            });
          } else {
            console.log("New user created:", newUser);
          }
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, toast, form]);

  // フォーム送信処理
  const onSubmit = async (data: ProfileFormValues) => {
    if (!userId) {
      toast({
        title: "エラー",
        description: "ユーザーIDが見つかりません",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log("Updating profile for user ID:", userId);
      console.log("Form data:", data);
      
      // ユーザー情報の更新
      const { error } = await supabase
        .from(USERS_TABLE)
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          profile_completed: true
        })
        .eq('auth_user_id', userId);
        
      if (error) {
        console.error("プロフィール更新エラー:", error);
        toast({
          title: "エラー",
          description: "プロフィールの更新に失敗しました",
          variant: "destructive",
        });
        return;
      }
      
      console.log("Profile updated successfully");
      toast({
        title: "成功",
        description: "プロフィールを更新しました",
      });
      
      // ダッシュボードに移動
      router.push('/dashboard');
    } catch (error) {
      console.error("送信エラー:", error);
      toast({
        title: "エラー",
        description: "データの送信に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ダッシュボードに戻る
  const goToDashboard = () => {
    router.push('/dashboard');
  };

  // ローディング表示
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-blue-600 font-semibold">データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8 max-w-md">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">プロフィール設定</h1>
        <Button onClick={goToDashboard} variant="outline">戻る</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
          <CardDescription>あなたの基本情報を設定してください</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>姓</FormLabel>
                      <FormControl>
                        <Input placeholder="例：田中" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名</FormLabel>
                      <FormControl>
                        <Input placeholder="例：太郎" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>役割</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="parent" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            保護者
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="student" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            生徒
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="tutor" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            講師
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "処理中..." : "保存する"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}