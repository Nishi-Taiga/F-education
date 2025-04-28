import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tutorProfileSchema, allSubjects } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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
  selectedSubjects: z.array(z.string()).min(1, "少なくとも1つの科目を選択してください")
});

type FormValues = z.infer<typeof tutorFormSchema>;

export default function TutorProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
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
  
  // 講師プロフィールの保存用ミューテーション
  const saveProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tutor/profile", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/profile"] });
      toast({
        title: "プロフィールを保存しました",
        description: "講師プロフィールが正常に更新されました。",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
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
      navigate("/");
    }
  }, [user, navigate]);
  
  // フォーム送信時の処理
  const onSubmit = async (data: FormValues) => {
    // 科目の配列をカンマ区切りの文字列に変換
    const subjects = data.selectedSubjects.join(",");
    
    // APIに送信するデータを構築
    const tutorData = {
      lastName: data.lastName,
      firstName: data.firstName,
      lastNameFurigana: data.lastNameFurigana,
      firstNameFurigana: data.firstNameFurigana,
      university: data.university,
      birthDate: data.birthDate,
      subjects,
      bio: "" // 自己紹介は不要のため空に設定
    };
    
    try {
      // 講師プロフィールを保存
      await saveProfileMutation.mutateAsync(tutorData);
      // 保存完了後にホームページに遷移
      navigate("/");
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
    }
  };
  
  if (!user) {
    return null; // ユーザー情報がない場合は何も表示しない
  }
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">講師プロフィール設定</h1>
        <div className="flex gap-2">
          {tutorProfile && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              編集する
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/")}>
            マイページに戻る
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
                        if (tutorProfile) {
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
                        }
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading || saveProfileMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {saveProfileMutation.isPending ? "保存中..." : "プロフィールを保存"}
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