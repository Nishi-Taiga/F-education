import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tutorProfileSchema, allSubjects } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { PencilIcon, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// 高校科目のカテゴリー
const highSchoolCategories = {
  "国語": ["高校現代文", "高校古典"],
  "数学": ["高校数学"],
  "理科": ["高校物理", "高校化学", "高校生物", "高校地学"],
  "社会": ["高校地理", "高校日本史", "高校世界史", "高校公共"],
  "英語": ["高校英語"],
  "その他": ["高校情報"]
};

// 講師プロフィールのフォーム用スキーマ
const tutorFormSchema = tutorProfileSchema.extend({
  selectedSubjects: z.array(z.string()).min(1, "少なくとも1つの科目を選択してください"),
  subjects: z.string().optional() // サーバーAPIとの互換性のため追加
});

type FormValues = z.infer<typeof tutorFormSchema>;

export default function TutorProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  
  // 既存の講師プロフィール情報を取得
  const { data: tutorProfile, isLoading } = useQuery({
    queryKey: ["/api/tutor/profile"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/profile");
        if (response.status === 404) {
          return null; // 新規登録の場合
        }
        if (!response.ok) {
          throw new Error("Failed to fetch tutor profile");
        }
        return await response.json();
      } catch (error) {
        // 404の場合は新規登録画面として表示するため、エラーにしない
        if (error instanceof Error && error.message.includes("404")) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    enabled: !!user && user.role === "tutor"
  });
  
  // リダイレクト状態管理
  const [redirectPending, setRedirectPending] = useState(false);
  
  // 保存完了時の効果音処理（リダイレクトは削除）
  useEffect(() => {
    if (redirectPending) {
      // リダイレクトではなく、単に保存完了をマーク
      const timer = setTimeout(() => {
        setRedirectPending(false);
      }, 3000); // 3秒後にフラグをリセット
      return () => clearTimeout(timer);
    }
  }, [redirectPending]);
  
  // プロフィール保存中の状態
  const [isSaving, setIsSaving] = useState(false);

  // 講師プロフィールの保存用ミューテーション
  const saveProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("保存リクエスト開始:", data);
      try {
        const res = await apiRequest("POST", "/api/tutor/profile", data);
        const responseData = await res.json();
        console.log("APIレスポンス成功:", responseData);
        return responseData;
      } catch (error) {
        console.error("APIリクエストエラー:", error);
        throw error; // エラーを再スローして onError ハンドラーに渡す
      }
    },
    onMutate: () => {
      console.log("ミューテーション開始");
      setIsSaving(true);
    },
    onSuccess: (result) => {
      console.log("保存レスポンス:", result);
      
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/profile"] });
      
      // 成功メッセージ
      toast({
        title: "保存しました",
        description: "講師プロフィールが正常に更新されました。",
      });
      
      // 編集モードを終了
      setIsEditing(false);
      
      // リダイレクトフラグを設定
      console.log("保存完了状態に設定");
      setRedirectPending(true);
    },
    onError: (error) => {
      console.error("保存エラー:", error);
      
      // エラー時に編集モードを維持
      setIsEditing(true);
      
      // エラーメッセージを表示
      toast({
        title: "エラーが発生しました",
        description: error instanceof Error ? error.message : "不明なエラーが発生しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      console.log("ミューテーション完了");
      setTimeout(() => {
        setIsSaving(false);
      }, 500); // 少し遅延させてボタンの状態変化を見えるようにする
    }
  });
  
  // フォームの初期化
  const form = useForm<FormValues>({
    resolver: zodResolver(tutorFormSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      lastNameFurigana: "",
      firstNameFurigana: "",
      university: "",
      birthDate: "",
      selectedSubjects: [],
      subjects: "", // 追加
      bio: ""
    }
  });
  
  // プロフィールデータの取得後にフォームの値を設定
  useEffect(() => {
    if (tutorProfile) {
      const subjects = tutorProfile.subjects ? tutorProfile.subjects.split(",") : [];
      
      form.reset({
        lastName: tutorProfile.lastName || "",
        firstName: tutorProfile.firstName || "",
        lastNameFurigana: tutorProfile.lastNameFurigana || "",
        firstNameFurigana: tutorProfile.firstNameFurigana || "",
        university: tutorProfile.university || "",
        birthDate: tutorProfile.birthDate || "",
        selectedSubjects: subjects,
        subjects: tutorProfile.subjects || "", // 追加
        bio: tutorProfile.bio || ""
      });
      
      // 新規プロフィール作成時は編集モードにする
      setIsEditing(!tutorProfile.profileCompleted);
    } else {
      // プロフィールがない場合は編集モードにする
      setIsEditing(true);
    }
  }, [tutorProfile, form]);
  
  // 講師でない場合はリダイレクト
  useEffect(() => {
    if (user && user.role !== "tutor") {
      setLocation("/");
    }
  }, [user, setLocation]);
  
  // フォーム送信時の処理
  const onSubmit = async (data: FormValues) => {
    
    // 保存中なら何もしない
    if (isSaving || saveProfileMutation.isPending) {
      console.log("保存処理中のため、新しい送信をスキップします");
      return;
    }
    
    console.log("フォーム送信イベント発生");
    
    // バリデーションエラーの確認
    const errors = form.formState.errors;
    console.log("フォームエラー:", errors);
    
    if (Object.keys(errors).length > 0) {
      console.error("バリデーションエラーがあります:", errors);
      toast({
        title: "入力エラー",
        description: "フォームに入力エラーがあります。エラーメッセージを確認してください。",
        variant: "destructive",
      });
      return; // エラーがある場合は送信しない
    }
    
    try {
      // 科目の配列をカンマ区切りの文字列に変換
      const subjects = data.selectedSubjects.join(",");
      
      if (!subjects) {
        toast({
          title: "入力エラー",
          description: "少なくとも1つの科目を選択してください。",
          variant: "destructive",
        });
        return;
      }
      
      // フォームのデータを更新（subjects フィールドを明示的に設定）
      form.setValue("subjects", subjects);
      
      // 保存中状態を設定
      setIsSaving(true);
      
      // APIに送信するデータを構築
      const tutorData = {
        lastName: data.lastName,
        firstName: data.firstName,
        lastNameFurigana: data.lastNameFurigana,
        firstNameFurigana: data.firstNameFurigana,
        university: data.university,
        birthDate: data.birthDate,
        subjects, // 選択された科目の文字列
        bio: data.bio || "", // 自己紹介がある場合は送信、なければ空文字
        profileCompleted: true // プロフィール完了フラグを明示的に設定
      };
      
      console.log("送信データ:", tutorData);
      
      // 直接APIを呼び出す方法を試してみる（React Queryのmutationに問題がある可能性）
      try {
        const response = await fetch("/api/tutor/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(tutorData),
          credentials: "include" // Cookieを含める
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log("API保存成功:", result);
        
        // 成功後の処理
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/profile"] });
        
        toast({
          title: "保存しました",
          description: "講師プロフィールが正常に更新されました。",
        });
        
        // 編集モードを終了
        setIsEditing(false);
        
        // リダイレクトフラグを設定
        setRedirectPending(true);
        
      } catch (apiError) {
        console.error("API呼び出しエラー:", apiError);
        toast({
          title: "保存に失敗しました",
          description: apiError instanceof Error ? apiError.message : "APIエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        // 処理完了後に保存中状態を解除
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      }
      
    } catch (error) {
      console.error("フォーム送信処理中にエラーが発生しました:", error);
      toast({
        title: "エラーが発生しました",
        description: error instanceof Error ? error.message : "不明なエラーが発生しました",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  };
  
  if (!user) {
    return null; // ユーザー情報がない場合は何も表示しない
  }
  
  return (
    <div className="container py-8">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">講師プロフィール設定</h1>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center gap-2">
              <PencilIcon className="h-4 w-4" />
              編集する
            </Button>
          )}
          <Button variant="outline" onClick={() => setLocation("/")} className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            ホームに戻る
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>講師情報の登録</CardTitle>
          <CardDescription>
            講師として活動するために必要な情報を入力してください。
            この情報は生徒とその保護者に公開されます。
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* 基本情報 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">基本情報</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓</FormLabel>
                        <FormControl>
                          <Input placeholder="例：山田" {...field} disabled={!isEditing} />
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
                          <Input placeholder="例：太郎" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lastNameFurigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="例：やまだ" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="firstNameFurigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="例：たろう" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="university"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>大学名</FormLabel>
                      <FormControl>
                        <Input placeholder="例：東京大学" {...field} disabled={!isEditing} />
                      </FormControl>
                      <FormDescription>
                        現在通っている、または卒業した大学名を入力してください。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>生年月日</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          // 18歳以上の方のみ登録可能に制限
                          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                            .toISOString().split('T')[0]} 
                          disabled={!isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        講師は18歳以上の方のみ登録可能です。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Separator />
              
              {/* 指導科目 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">指導可能な科目</h3>
                <FormField
                  control={form.control}
                  name="selectedSubjects"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">担当科目</FormLabel>
                        <FormDescription>
                          指導可能な科目を選択してください。複数選択できます。
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 小学生の科目 */}
                        <div className="space-y-2">
                          <Label className="font-medium">小学生</Label>
                          {allSubjects
                            .filter(subject => subject.startsWith("小学"))
                            .map(subject => (
                              <FormField
                                key={subject}
                                control={form.control}
                                name="selectedSubjects"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={subject}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(subject)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, subject])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== subject
                                                  )
                                                )
                                          }}
                                          disabled={!isEditing}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {subject.replace("小学", "")}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                        </div>
                        
                        {/* 中学生の科目 */}
                        <div className="space-y-2">
                          <Label className="font-medium">中学生</Label>
                          {allSubjects
                            .filter(subject => subject.startsWith("中学"))
                            .map(subject => (
                              <FormField
                                key={subject}
                                control={form.control}
                                name="selectedSubjects"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={subject}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(subject)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, subject])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== subject
                                                  )
                                                )
                                          }}
                                          disabled={!isEditing}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {subject.replace("中学", "")}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                        </div>
                        
                        {/* 高校生の科目（カテゴリー分け） */}
                        <div className="space-y-4">
                          <Label className="font-medium">高校生</Label>
                          
                          {/* カテゴリー別に科目を表示 */}
                          {Object.entries(highSchoolCategories).map(([category, subjects]) => (
                            <div key={category} className="mt-2">
                              <Label className="text-sm font-medium text-gray-700">{category}</Label>
                              <div className="ml-2 mt-1 space-y-1">
                                {subjects.map(subject => {
                                  const fullSubjectName = `高校${subject.replace('高校', '')}`;
                                  return (
                                    <FormField
                                      key={fullSubjectName}
                                      control={form.control}
                                      name="selectedSubjects"
                                      render={({ field }) => {
                                        return (
                                          <FormItem
                                            key={fullSubjectName}
                                            className="flex flex-row items-start space-x-3 space-y-0"
                                          >
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(fullSubjectName)}
                                                onCheckedChange={(checked) => {
                                                  return checked
                                                    ? field.onChange([...field.value, fullSubjectName])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                          (value) => value !== fullSubjectName
                                                        )
                                                      )
                                                }}
                                                disabled={!isEditing}
                                              />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                              {subject.replace("高校", "")}
                                            </FormLabel>
                                          </FormItem>
                                        )
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <CardFooter className="flex justify-end gap-2 px-0">
                {isEditing ? (
                  <>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        // プロフィールデータが存在する場合
                        if (tutorProfile) {
                          // 編集モードを終了
                          setIsEditing(false);
                          
                          // フォームを元の値に戻す
                          const subjects = tutorProfile.subjects ? tutorProfile.subjects.split(",") : [];
                          form.reset({
                            lastName: tutorProfile.lastName || "",
                            firstName: tutorProfile.firstName || "",
                            lastNameFurigana: tutorProfile.lastNameFurigana || "",
                            firstNameFurigana: tutorProfile.firstNameFurigana || "",
                            university: tutorProfile.university || "",
                            birthDate: tutorProfile.birthDate || "",
                            selectedSubjects: subjects,
                            bio: tutorProfile.bio || ""
                          });
                          
                          // キャンセルメッセージ
                          toast({
                            title: "編集をキャンセルしました",
                            description: "変更は保存されませんでした",
                          });
                        } else {
                          // 新規作成の場合はホームに戻る
                          setLocation("/");
                        }
                      }}
                      disabled={isSaving || saveProfileMutation.isPending}
                    >
                      キャンセル
                    </Button>
                    
                    <Button 
                      type="submit" 
                      className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white"
                      disabled={isSaving || saveProfileMutation.isPending}
                      onClick={() => {
                        // ボタンクリック時もフォームエラーをコンソールに表示（デバッグ用）
                        console.log("保存ボタンクリック - フォームエラー:", form.formState.errors);
                      }}
                    >
                      {isSaving || saveProfileMutation.isPending ? (
                        <span className="flex items-center gap-1">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-opacity-50 border-t-white"></span>
                          保存中...
                        </span>
                      ) : "プロフィールを保存"}
                    </Button>
                  </>
                ) : null}
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}