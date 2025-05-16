"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";

// 生徒情報のためのスキーマ
const studentSchema = z.object({
  last_name: z.string().min(1, { message: "姓を入力してください" }),
  first_name: z.string().min(1, { message: "名を入力してください" }),
  last_name_furigana: z.string().min(1, { message: "姓のふりがなを入力してください" }),
  first_name_furigana: z.string().min(1, { message: "名のふりがなを入力してください" }),
  gender: z.string().min(1, { message: "性別を選択してください" }),
  school: z.string().min(2, { message: "学校名は2文字以上で入力してください" }),
  grade: z.string().min(1, { message: "学年を選択してください" }),
  birth_date: z.string().min(1, { message: "生年月日を入力してください" }),
});

type StudentForm = z.infer<typeof studentSchema>;

export default function StudentProfileSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // 生徒情報フォーム
  const studentForm = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      last_name: "",
      first_name: "",
      last_name_furigana: "",
      first_name_furigana: "",
      gender: "",
      school: "",
      grade: "",
      birth_date: "",
    },
  });

  // 生徒情報の送信
  const onStudentSubmit = async (values: StudentForm) => {
    setIsLoading(true);
    try {
      // セッション情報を取得
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("セッションが見つかりません。再ログインしてください。");
      }
      
      // ユーザーID
      const userId = session.user.id;
      
      // ユーザー情報を取得
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (userError || !userData) {
        throw new Error("ユーザー情報の取得に失敗しました");
      }
      
      // 生徒テーブルに登録
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          parent_id: userData.id,
          user_id: userId,
          last_name: values.last_name,
          first_name: values.first_name,
          last_name_furigana: values.last_name_furigana,
          first_name_furigana: values.first_name_furigana,
          gender: values.gender,
          school: values.school,
          grade: values.grade,
          birth_date: values.birth_date,
        });
        
      if (studentError) throw studentError;
      
      // 無料体験チケット付与（1枚）
      const { error: ticketError } = await supabase
        .from('student_tickets')
        .insert({
          user_id: userData.id,
          quantity: 1,
          description: "無料体験授業チケット",
        });
        
      if (ticketError) {
        console.error("チケット付与エラー:", ticketError);
      }
      
      toast({
        title: "生徒情報が保存されました",
        description: "1枚の体験用チケットが付与されました。ダッシュボードに進みます。",
      });
      
      // ダッシュボードに進む
      router.push('/dashboard');
    } catch (error: any) {
      console.error("生徒情報保存エラー:", error);
      toast({
        title: "エラー",
        description: `生徒情報の保存に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 学年の選択肢
  const gradeOptions = [
    { value: "小学1年生", label: "小学1年生" },
    { value: "小学2年生", label: "小学2年生" },
    { value: "小学3年生", label: "小学3年生" },
    { value: "小学4年生", label: "小学4年生" },
    { value: "小学5年生", label: "小学5年生" },
    { value: "小学6年生", label: "小学6年生" },
    { value: "中学1年生", label: "中学1年生" },
    { value: "中学2年生", label: "中学2年生" },
    { value: "中学3年生", label: "中学3年生" },
    { value: "高校1年生", label: "高校1年生" },
    { value: "高校2年生", label: "高校2年生" },
    { value: "高校3年生", label: "高校3年生" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-primary">F education</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">生徒プロフィール設定</h2>
          <p className="mt-1 text-sm text-gray-600">サービスを利用するために必要な生徒情報を入力してください</p>
          <p className="text-sm text-gray-500">兄弟姉妹の登録は、後から設定画面で追加できます</p>
        </div>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>生徒情報を入力</CardTitle>
            <CardDescription>授業予約に必要な生徒情報です</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...studentForm}>
              <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={studentForm.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓</FormLabel>
                        <FormControl>
                          <Input placeholder="山田" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名</FormLabel>
                        <FormControl>
                          <Input placeholder="太郎" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={studentForm.control}
                    name="last_name_furigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="やまだ" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="first_name_furigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="たろう" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={studentForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>性別</FormLabel>
                      <FormControl>
                        <select 
                          className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="">選択してください</option>
                          <option value="男性">男性</option>
                          <option value="女性">女性</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={studentForm.control}
                    name="school"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>学校</FormLabel>
                        <FormControl>
                          <Input placeholder="〇〇小学校" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>学年</FormLabel>
                        <FormControl>
                          <select 
                            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="">選択してください</option>
                            {gradeOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={studentForm.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>生年月日</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => router.push('/profile-setup')}
                    className="flex items-center"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex items-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        登録して完了
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
