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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

// 保護者・生徒用プロフィール設定スキーマ
const parentProfileSchema = z.object({
  firstName: z.string().min(1, "名前は必須です"),
  lastName: z.string().min(1, "姓は必須です"),
  phone: z.string().min(10, { message: "有効な電話番号を入力してください" }).max(15).optional(),
  postalCode: z.string().min(7, { message: "郵便番号を入力してください（ハイフンなし）" }).max(8).optional(),
  prefecture: z.string().min(2, { message: "都道府県を入力してください" }).optional(),
  city: z.string().min(2, { message: "市区町村を入力してください" }).optional(),
  address: z.string().min(2, { message: "番地・建物名等を入力してください" }).optional(),
});

// 講師用プロフィール設定スキーマ
const tutorProfileSchema = z.object({
  firstName: z.string().min(1, "名前は必須です"),
  lastName: z.string().min(1, "姓は必須です"),
  phone: z.string().min(10, { message: "有効な電話番号を入力してください" }).max(15).optional(),
  postalCode: z.string().min(7, { message: "郵便番号を入力してください（ハイフンなし）" }).max(8).optional(),
  prefecture: z.string().min(2, { message: "都道府県を入力してください" }).optional(),
  city: z.string().min(2, { message: "市区町村を入力してください" }).optional(),
  address: z.string().min(2, { message: "番地・建物名等を入力してください" }).optional(),
  bio: z.string().min(10, { message: "自己紹介を入力してください" }).optional(),
  subjects: z.string().min(1, { message: "指導可能な科目を入力してください" }).optional(),
  education: z.string().min(1, { message: "学歴を入力してください" }).optional(),
  experience: z.string().min(1, { message: "指導経験を入力してください" }).optional(),
});

// Supabase URLとテーブル名
const USERS_TABLE = 'users';
const TUTORS_TABLE = 'tutors';

export default function ProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [databaseUserId, setDatabaseUserId] = useState<number | null>(null);
  const [role, setRole] = useState<string>('parent'); // デフォルトで'parent'に設定
  
  // 保護者・生徒用フォーム
  const parentForm = useForm<z.infer<typeof parentProfileSchema>>({
    resolver: zodResolver(parentProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      postalCode: "",
      prefecture: "",
      city: "",
      address: "",
    },
  });

  // 講師用フォーム
  const tutorForm = useForm<z.infer<typeof tutorProfileSchema>>({
    resolver: zodResolver(tutorProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      postalCode: "",
      prefecture: "",
      city: "",
      address: "",
      bio: "",
      subjects: "",
      education: "",
      experience: "",
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
          
        if (userError) {
          if (userError.code === 'PGRST116') {
            console.log("No user found in database, creating a new one");
            // ユーザーが存在しない場合は新規作成
            await createNewUser(session.user.id, session.user.email || "");
          } else {
            console.error("ユーザー情報取得エラー:", userError);
            toast({
              title: "エラー",
              description: "ユーザー情報の取得に失敗しました",
              variant: "destructive",
            });
          }
          setIsLoading(false);
          return;
        }
        
        // ユーザーが存在する場合
        if (userData) {
          console.log("Existing user data found:", userData);
          setRole(userData.role || "parent");
          setDatabaseUserId(userData.id);
          
          // ロールに応じたフォームリセット
          if (userData.role === 'tutor') {
            // 講師情報を取得
            const { data: tutorData } = await supabase
              .from(TUTORS_TABLE)
              .select('*')
              .eq('user_id', userData.id)
              .single();
              
            console.log("Tutor data:", tutorData);
            
            tutorForm.reset({
              firstName: userData.first_name || "",
              lastName: userData.last_name || "",
              phone: userData.phone || "",
              postalCode: userData.postal_code || "",
              prefecture: userData.prefecture || "",
              city: userData.city || "",
              address: userData.address || "",
              bio: tutorData?.bio || "",
              subjects: tutorData?.subjects || "",
              education: tutorData?.education || "",
              experience: tutorData?.experience || "",
            });
          } else {
            parentForm.reset({
              firstName: userData.first_name || "",
              lastName: userData.last_name || "",
              phone: userData.phone || "",
              postalCode: userData.postal_code || "",
              prefecture: userData.prefecture || "",
              city: userData.city || "",
              address: userData.address || "",
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
  }, [router, toast]);

  // 新規ユーザー作成
  const createNewUser = async (authUserId: string, email: string) => {
    try {
      // 新規ユーザーレコードを作成
      const { data: newUser, error: createError } = await supabase
        .from(USERS_TABLE)
        .insert([{ 
          auth_user_id: authUserId,
          email: email,
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
        return;
      }
      
      console.log("New user created:", newUser);
      if (newUser && newUser.length > 0) {
        setDatabaseUserId(newUser[0].id);
      }
      
      // デフォルトでparentロールを設定
      setRole('parent');
    } catch (error) {
      console.error("ユーザー作成エラー:", error);
      toast({
        title: "エラー",
        description: "ユーザーの作成に失敗しました",
        variant: "destructive",
      });
    }
  };

  // 保護者・生徒用フォーム送信
  async function onParentSubmit(data: z.infer<typeof parentProfileSchema>) {
    if (!userId) {
      toast({
        title: "エラー",
        description: "ユーザーIDが見つかりません",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsFormSubmitting(true);
      
      console.log("Updating profile for user ID:", userId);
      console.log("Form data:", data);
      
      // ユーザー情報の更新
      const { error } = await supabase
        .from(USERS_TABLE)
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          postal_code: data.postalCode,
          prefecture: data.prefecture,
          city: data.city,
          address: data.address,
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
      setIsFormSubmitting(false);
    }
  }

  // 講師用フォーム送信
  async function onTutorSubmit(data: z.infer<typeof tutorProfileSchema>) {
    if (!userId) {
      toast({
        title: "エラー",
        description: "ユーザーIDが見つかりません",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsFormSubmitting(true);
      
      console.log("Updating tutor profile for user ID:", userId);
      console.log("Form data:", data);
      
      // まずユーザー情報を更新
      const { data: userData, error: userError } = await supabase
        .from(USERS_TABLE)
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          postal_code: data.postalCode,
          prefecture: data.prefecture,
          city: data.city,
          address: data.address,
          profile_completed: true,
          role: 'tutor'
        })
        .eq('auth_user_id', userId)
        .select();
        
      if (userError) {
        console.error("ユーザープロフィール更新エラー:", userError);
        toast({
          title: "エラー",
          description: "ユーザープロフィールの更新に失敗しました",
          variant: "destructive",
        });
        return;
      }
      
      // 次に講師情報を作成/更新
      if (userData && userData.length > 0) {
        // 既存の講師情報を確認
        const { data: existingTutor } = await supabase
          .from(TUTORS_TABLE)
          .select('id')
          .eq('user_id', userData[0].id)
          .single();
          
        if (existingTutor) {
          // 既存の講師情報を更新
          const { error: tutorUpdateError } = await supabase
            .from(TUTORS_TABLE)
            .update({
              bio: data.bio,
              subjects: data.subjects,
              education: data.education,
              experience: data.experience,
              is_active: true
            })
            .eq('id', existingTutor.id);
            
          if (tutorUpdateError) {
            console.error("講師情報更新エラー:", tutorUpdateError);
            toast({
              title: "エラー",
              description: "講師情報の更新に失敗しました",
              variant: "destructive",
            });
            return;
          }
        } else {
          // 新規講師情報を作成
          const { error: tutorCreateError } = await supabase
            .from(TUTORS_TABLE)
            .insert({
              user_id: userData[0].id,
              last_name: data.lastName,
              first_name: data.firstName,
              last_name_furigana: "",
              first_name_furigana: "",
              university: data.education || "",
              birth_date: "2000-01-01",
              bio: data.bio,
              subjects: data.subjects,
              education: data.education,
              experience: data.experience,
              is_active: true,
              profile_completed: true
            });
            
          if (tutorCreateError) {
            console.error("講師情報作成エラー:", tutorCreateError);
            toast({
              title: "エラー",
              description: "講師情報の作成に失敗しました",
              variant: "destructive",
            });
            return;
          }
        }
      }
      
      console.log("Tutor profile updated successfully");
      toast({
        title: "成功",
        description: "講師プロフィールを更新しました",
      });
      
      // 講師ページに移動
      router.push('/tutor/profile');
    } catch (error) {
      console.error("送信エラー:", error);
      toast({
        title: "エラー",
        description: "データの送信に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsFormSubmitting(false);
    }
  }

  // 講師ロールに切り替え
  const switchToTutorRole = () => {
    setRole('tutor');
  };
  
  // 保護者ロールに切り替え
  const switchToParentRole = () => {
    setRole('parent');
  };

  // 講師用のフォーム
  const TutorProfileForm = () => (
    <Form {...tutorForm}>
      <form onSubmit={tutorForm.handleSubmit(onTutorSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={tutorForm.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓</FormLabel>
                <FormControl>
                  <Input placeholder="例：田中" {...field} disabled={isFormSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={tutorForm.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>名</FormLabel>
                <FormControl>
                  <Input placeholder="例：太郎" {...field} disabled={isFormSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={tutorForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>電話番号</FormLabel>
              <FormControl>
                <Input placeholder="09012345678" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormDescription>ハイフンなしで入力してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={tutorForm.control}
          name="postalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>郵便番号</FormLabel>
              <FormControl>
                <Input placeholder="1234567" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormDescription>ハイフンなしで入力してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={tutorForm.control}
          name="prefecture"
          render={({ field }) => (
            <FormItem>
              <FormLabel>都道府県</FormLabel>
              <FormControl>
                <Input placeholder="東京都" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={tutorForm.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>市区町村</FormLabel>
              <FormControl>
                <Input placeholder="渋谷区" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={tutorForm.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>番地・建物名等</FormLabel>
              <FormControl>
                <Input placeholder="神南1-2-3 ○○マンション101" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={tutorForm.control}
          name="subjects"
          render={({ field }) => (
            <FormItem>
              <FormLabel>指導可能科目</FormLabel>
              <FormControl>
                <Input placeholder="数学、英語、理科" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormDescription>カンマ区切りで複数入力可能</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={tutorForm.control}
          name="education"
          render={({ field }) => (
            <FormItem>
              <FormLabel>学歴</FormLabel>
              <FormControl>
                <Input placeholder="○○大学△△学部 卒業" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={tutorForm.control}
          name="experience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>指導経験</FormLabel>
              <FormControl>
                <Input placeholder="家庭教師3年、塾講師2年" {...field} disabled={isFormSubmitting} />
              </FormControl>
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
                  placeholder="生徒への自己紹介文を入力してください" 
                  {...field} 
                  disabled={isFormSubmitting}
                  className="min-h-24"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={switchToParentRole} 
            disabled={isFormSubmitting}
            className="flex-1"
          >
            保護者として登録
          </Button>
          <Button 
            type="submit" 
            disabled={isFormSubmitting}
            className="flex-1"
          >
            {isFormSubmitting ? "処理中..." : "講師として登録"}
          </Button>
        </div>
      </form>
    </Form>
  );

  // 保護者・生徒用のフォーム
  const ParentProfileForm = () => (
    <Form {...parentForm}>
      <form onSubmit={parentForm.handleSubmit(onParentSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={parentForm.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓</FormLabel>
                <FormControl>
                  <Input placeholder="例：田中" {...field} disabled={isFormSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={parentForm.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>名</FormLabel>
                <FormControl>
                  <Input placeholder="例：太郎" {...field} disabled={isFormSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={parentForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>電話番号</FormLabel>
              <FormControl>
                <Input placeholder="09012345678" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormDescription>ハイフンなしで入力してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={parentForm.control}
          name="postalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>郵便番号</FormLabel>
              <FormControl>
                <Input placeholder="1234567" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormDescription>ハイフンなしで入力してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={parentForm.control}
          name="prefecture"
          render={({ field }) => (
            <FormItem>
              <FormLabel>都道府県</FormLabel>
              <FormControl>
                <Input placeholder="東京都" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={parentForm.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>市区町村</FormLabel>
              <FormControl>
                <Input placeholder="渋谷区" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={parentForm.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>番地・建物名等</FormLabel>
              <FormControl>
                <Input placeholder="神南1-2-3 ○○マンション101" {...field} disabled={isFormSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex space-x-2">
          <Button 
            type="submit" 
            disabled={isFormSubmitting}
            className="flex-1"
          >
            {isFormSubmitting ? "処理中..." : "保護者として登録"}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={switchToTutorRole} 
            disabled={isFormSubmitting}
            className="flex-1"
          >
            講師として登録
          </Button>
        </div>
      </form>
    </Form>
  );

  // ローディング表示
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-blue-600 font-semibold mb-2">データを読み込み中...</div>
          <p className="text-sm text-gray-500">少々お待ちください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8 max-w-md">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">プロフィール設定</h1>
        <Button onClick={() => router.push('/')} variant="outline">戻る</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
          <CardDescription>
            {role === 'tutor' 
              ? 'サービスをご利用いただくために、講師情報を入力してください' 
              : 'サービスをご利用いただくために、基本情報を入力してください'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {role === 'tutor' ? <TutorProfileForm /> : <ParentProfileForm />}
        </CardContent>
      </Card>
    </div>
  );
}