"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

// ユーザー情報のフォームスキーマ
const userProfileSchema = z.object({
  firstName: z.string().min(1, "名前は必須です"),
  lastName: z.string().min(1, "姓は必須です"),
  role: z.enum(["parent", "student", "tutor"], {
    required_error: "役割を選択してください",
  }),
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
});

// 講師情報のフォームスキーマ
const tutorProfileSchema = z.object({
  specialization: z.string().optional(),
  bio: z.string().max(500, "自己紹介は500文字以内で入力してください").optional(),
});

type UserProfileValues = z.infer<typeof userProfileSchema>;
type TutorProfileValues = z.infer<typeof tutorProfileSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [isTutor, setIsTutor] = useState(false);
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState("profile");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // ユーザー情報フォーム
  const userForm = useForm<UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      role: "parent",
      email: "",
    },
  });
  
  // 講師情報フォーム
  const tutorForm = useForm<TutorProfileValues>({
    resolver: zodResolver(tutorProfileSchema),
    defaultValues: {
      specialization: "",
      bio: "",
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
          router.push('/');
          return;
        }
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        setUserId(userData.id);
        setIsTutor(userData.role === 'tutor');
        
        // フォームの初期値を設定
        userForm.reset({
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          role: userData.role || "parent",
          email: session.user.email || "",
        });
        
        // 講師の場合、追加情報を取得
        if (userData.role === 'tutor') {
          const { data: tutorData, error: tutorError } = await supabase
            .from('tutors')
            .select('*')
            .eq('userId', userData.id)
            .single();
            
          if (!tutorError && tutorData) {
            setTutorId(tutorData.id);
            tutorForm.reset({
              specialization: tutorData.specialization || "",
              bio: tutorData.bio || "",
            });
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
  }, [router, toast, userForm, tutorForm]);

  // ユーザー情報の更新
  const onUserSubmit = async (data: UserProfileValues) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      
      // ユーザー情報の更新
      const { error } = await supabase
        .from('users')
        .update({
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        })
        .eq('id', userId);
        
      if (error) {
        throw error;
      }
      
      // 役割が変わった場合の処理
      const roleChanged = userForm.getValues("role") !== data.role;
      if (roleChanged) {
        if (data.role === 'tutor' && !tutorId) {
          // 講師になった場合、講師テーブルにレコードを作成
          const { error: tutorError } = await supabase
            .from('tutors')
            .insert([{
              userId: userId,
              firstName: data.firstName,
              lastName: data.lastName,
              isActive: true,
            }]);
            
          if (tutorError) {
            console.error("講師情報作成エラー:", tutorError);
          }
        }
      }
      
      toast({
        title: "更新完了",
        description: "ユーザー情報を更新しました",
      });
      
      // データの再取得ではなく、ページをリロード
      window.location.reload();
    } catch (error: any) {
      console.error("更新エラー:", error);
      toast({
        title: "更新エラー",
        description: error.message || "ユーザー情報の更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 講師情報の更新
  const onTutorSubmit = async (data: TutorProfileValues) => {
    if (!userId || !tutorId) return;
    
    try {
      setIsLoading(true);
      
      // 講師情報の更新
      const { error } = await supabase
        .from('tutors')
        .update({
          specialization: data.specialization,
          bio: data.bio,
        })
        .eq('id', tutorId);
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "更新完了",
        description: "講師情報を更新しました",
      });
    } catch (error: any) {
      console.error("更新エラー:", error);
      toast({
        title: "更新エラー",
        description: error.message || "講師情報の更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // パスワード変更処理
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "エラー",
        description: "新しいパスワードと確認用パスワードを入力してください",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "エラー",
        description: "新しいパスワードと確認用パスワードが一致しません",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "エラー",
        description: "パスワードは6文字以上にしてください",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "パスワード変更完了",
        description: "パスワードを変更しました",
      });
      
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("パスワード変更エラー:", error);
      toast({
        title: "パスワード変更エラー",
        description: error.message || "パスワードの変更に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">アカウント設定</h1>
        <Button onClick={() => router.push('/dashboard')} variant="outline">戻る</Button>
      </div>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="mb-6 w-full md:w-auto">
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          {isTutor && (
            <TabsTrigger value="tutor">講師情報</TabsTrigger>
          )}
          <TabsTrigger value="security">アカウント</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>ユーザープロフィール</CardTitle>
              <CardDescription>
                ユーザー情報を編集します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...userForm}>
                <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={userForm.control}
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
                      control={userForm.control}
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
                    control={userForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>メールアドレス</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your-email@example.com" 
                            {...field} 
                            disabled 
                          />
                        </FormControl>
                        <FormDescription>
                          メールアドレスの変更には管理者にお問い合わせください
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={userForm.control}
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
                        <FormDescription>
                          役割を変更すると、利用できる機能が変わります
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full md:w-auto"
                    disabled={isLoading}
                  >
                    {isLoading ? "更新中..." : "更新する"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {isTutor && (
          <TabsContent value="tutor">
            <Card>
              <CardHeader>
                <CardTitle>講師情報</CardTitle>
                <CardDescription>
                  講師としてのプロフィール情報を編集します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...tutorForm}>
                  <form onSubmit={tutorForm.handleSubmit(onTutorSubmit)} className="space-y-6">
                    <FormField
                      control={tutorForm.control}
                      name="specialization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>専門分野</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例：数学、英語" 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            カンマ区切りで複数の専門分野を入力できます
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={tutorForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>自己紹介</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="講師としての経歴や指導方針などを入力してください" 
                              {...field}
                              value={field.value || ""}
                              rows={6} 
                            />
                          </FormControl>
                          <FormDescription>
                            500文字以内で入力してください
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full md:w-auto"
                      disabled={isLoading}
                    >
                      {isLoading ? "更新中..." : "更新する"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        
        <TabsContent value="security">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>パスワード変更</CardTitle>
              <CardDescription>
                アカウントのパスワードを変更します
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showPasswordForm ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_password">新しいパスワード</Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新しいパスワード"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">パスワード（確認）</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="パスワードを再入力"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handlePasswordChange}
                      disabled={isLoading}
                    >
                      {isLoading ? "処理中..." : "パスワード変更"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                      disabled={isLoading}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowPasswordForm(true)}>
                  パスワードを変更する
                </Button>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>アカウント操作</CardTitle>
              <CardDescription>
                アカウントの操作を行います
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Button 
                  onClick={handleLogout} 
                  variant="outline"
                >
                  ログアウト
                </Button>
              </div>
              <Separator />
              <div>
                <Button variant="destructive">アカウント削除</Button>
                <p className="text-sm text-gray-500 mt-2">
                  ※アカウントを削除すると、すべてのデータが失われます。この操作は元に戻せません。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
