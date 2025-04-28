import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Plus, User, GraduationCap, Loader2 } from "lucide-react";

// 保護者情報のためのスキーマ
const parentProfileSchema = z.object({
  phone: z.string().min(10, { message: "電話番号は10桁以上で入力してください" }).max(15),
  address: z.string().min(5, { message: "ご住所は5文字以上で入力してください" }),
});

// 生徒情報のためのスキーマ
const studentSchema = z.object({
  fullName: z.string().min(2, { message: "氏名は2文字以上で入力してください" }),
  furigana: z.string().min(2, { message: "ふりがなは2文字以上で入力してください" }),
  school: z.string().min(2, { message: "学校名は2文字以上で入力してください" }),
  grade: z.string().min(1, { message: "学年を選択してください" }),
  birthDate: z.string().min(1, { message: "生年月日を入力してください" }),
});

// ページ全体のためのフォーム型
type ParentProfileForm = z.infer<typeof parentProfileSchema>;
type StudentForm = z.infer<typeof studentSchema>;

// 登録済みの生徒型
type Student = StudentForm & { id: number };

export default function ProfileSetupPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState<"parent" | "student">("parent");
  const [students, setStudents] = useState<Student[]>([]);
  
  // ユーザー情報を取得
  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
  });
  
  // 生徒情報を取得
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    // プロフィール完了済みの場合のみ生徒情報を取得
    enabled: !!user && !!user.profileCompleted
  });
  
  // 生徒情報が変更されたときに状態を更新
  useEffect(() => {
    if (studentsData && Array.isArray(studentsData)) {
      setStudents(studentsData);
    }
  }, [studentsData]);

  // プロフィール更新のミューテーション
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ParentProfileForm) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "保護者情報が保存されました",
        description: "続いて生徒情報を入力してください",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setCurrentStep("student");
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `保護者情報の保存に失敗しました: ${error}`,
        variant: "destructive",
      });
    },
  });

  // 生徒登録のミューテーション
  const addStudentMutation = useMutation({
    mutationFn: async (data: StudentForm) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "生徒情報が保存されました",
        description: "生徒情報の登録が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      // 新しい生徒を追加
      setStudents([...students, data]);
      // フォームをリセット
      studentForm.reset({
        fullName: "",
        furigana: "",
        school: "",
        grade: "",
        birthDate: "",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `生徒情報の保存に失敗しました: ${error}`,
        variant: "destructive",
      });
    },
  });

  // 保護者情報フォーム
  const parentForm = useForm<ParentProfileForm>({
    resolver: zodResolver(parentProfileSchema),
    defaultValues: {
      phone: user?.phone || "",
      address: user?.address || "",
    },
  });

  // 生徒情報フォーム
  const studentForm = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      fullName: "",
      furigana: "",
      school: "",
      grade: "",
      birthDate: "",
    },
  });

  // 保護者情報の送信
  const onParentSubmit = (values: ParentProfileForm) => {
    updateProfileMutation.mutate(values);
  };

  // 生徒情報の送信
  const onStudentSubmit = (values: StudentForm) => {
    addStudentMutation.mutate(values);
  };

  // マイページに進む
  const goToHomePage = () => {
    navigate("/");
  };

  // プロフィール設定が完了しているかどうかをチェック
  const isProfileComplete = !!user && !!user.profileCompleted && students.length > 0;
  
  // プロフィール設定が完了している場合は、マイページにリダイレクト
  // フックのルールに基づき、条件付きリダイレクトはここに配置
  if (isProfileComplete) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">プロフィール設定完了</h2>
          <p className="mb-6">
            プロフィール設定は既に完了しています。
          </p>
          <Button onClick={goToHomePage} className="w-full">
            マイページへ
          </Button>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-primary">家庭教師サービス</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">プロフィール設定</h2>
          <p className="mt-1 text-sm text-gray-600">サービスを利用するために必要な情報を入力してください</p>
        </div>

        <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as "parent" | "student")}>
          <TabsList className="mb-8">
            <TabsTrigger value="parent" disabled={currentStep === "student" && !user?.profileCompleted}>
              <User className="mr-2 h-4 w-4" />
              保護者情報
            </TabsTrigger>
            <TabsTrigger value="student" disabled={!user?.profileCompleted}>
              <GraduationCap className="mr-2 h-4 w-4" />
              生徒情報
            </TabsTrigger>
          </TabsList>

          {/* 保護者情報フォーム */}
          <TabsContent value="parent" className="mt-4">
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">保護者情報を入力</h3>

              <Form {...parentForm}>
                <form onSubmit={parentForm.handleSubmit(onParentSubmit)} className="space-y-6">
                  <FormField
                    control={parentForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>電話番号</FormLabel>
                        <FormControl>
                          <Input placeholder="090-1234-5678" {...field} />
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
                        <FormLabel>ご住所</FormLabel>
                        <FormControl>
                          <Input placeholder="東京都渋谷区..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      className="flex items-center"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          次へ進む
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          </TabsContent>

          {/* 生徒情報フォーム */}
          <TabsContent value="student" className="mt-4">
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">生徒情報を入力</h3>

              <Form {...studentForm}>
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={studentForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名</FormLabel>
                          <FormControl>
                            <Input placeholder="山田 太郎" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={studentForm.control}
                      name="furigana"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ふりがな</FormLabel>
                          <FormControl>
                            <Input placeholder="やまだ たろう" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                    name="birthDate"
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
                      onClick={() => setCurrentStep("parent")}
                      className="flex items-center"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      戻る
                    </Button>

                    <Button 
                      type="submit" 
                      disabled={addStudentMutation.isPending}
                      className="flex items-center"
                    >
                      {addStudentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          生徒を追加
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>

            {/* 登録済み生徒一覧 */}
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">登録済み生徒</h3>
              </div>

              {isLoadingStudents ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : students && students.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-4">
                    {students.map((student) => (
                      <div key={student.id} className="p-4 border rounded-md bg-gray-50">
                        <div className="font-medium">{student.fullName}</div>
                        <div className="text-sm text-gray-500">{student.furigana}</div>
                        <div className="mt-1 text-sm">
                          {student.school} | {student.grade}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center p-4 text-gray-500">
                  生徒が登録されていません
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button
                  onClick={goToHomePage}
                  disabled={students.length === 0}
                  className="flex items-center"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  完了
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}