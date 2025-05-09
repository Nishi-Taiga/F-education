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
import { ArrowLeft, ArrowRight, Plus, User, GraduationCap, Loader2, Search } from "lucide-react";
import axios from "axios";

// 保護者情報のためのスキーマ
const parentProfileSchema = z.object({
  parentName: z.string().min(2, { message: "氏名を入力してください" }),
  phone: z.string().min(10, { message: "電話番号は10桁以上で入力してください" }).max(15),
  postalCode: z.string().min(7, { message: "郵便番号は7桁で入力してください" }).max(8),
  prefecture: z.string().min(2, { message: "都道府県を入力してください" }),
  city: z.string().min(2, { message: "市区町村を入力してください" }),
  address: z.string().min(2, { message: "番地以降の住所を入力してください" }),
});

// 生徒情報のためのスキーマ
const studentSchema = z.object({
  lastName: z.string().min(1, { message: "姓を入力してください" }),
  firstName: z.string().min(1, { message: "名を入力してください" }),
  lastNameFurigana: z.string().min(1, { message: "姓のふりがなを入力してください" }),
  firstNameFurigana: z.string().min(1, { message: "名のふりがなを入力してください" }),
  gender: z.string().min(1, { message: "性別を選択してください" }),
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
      // 生徒登録が完了したらマイページへ進む
      setStudents([...students, data]);
      // 登録完了後、マイページに移動
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `生徒情報の保存に失敗しました: ${error}`,
        variant: "destructive",
      });
    },
  });

  // 郵便番号検索
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  
  // 郵便番号から住所を検索する関数
  const searchAddressByPostalCode = async (postalCode: string) => {
    if (!postalCode || postalCode.length < 7) return;
    
    try {
      setIsSearchingAddress(true);
      // 郵便番号APIを使用して住所を検索
      // 郵便番号から「-」を除去
      const cleanPostalCode = postalCode.replace(/-/g, '');
      const response = await axios.get(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanPostalCode}`);
      
      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        // フォームに住所情報をセット
        parentForm.setValue('prefecture', result.address1);
        parentForm.setValue('city', result.address2 + result.address3);
        
        // バリデーション状態を更新
        parentForm.trigger('prefecture');
        parentForm.trigger('city');
        
        toast({
          title: "住所が見つかりました",
          description: `${result.address1}${result.address2}${result.address3}`,
        });
      } else {
        toast({
          title: "住所が見つかりませんでした",
          description: "正しい郵便番号を入力してください",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "住所検索に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSearchingAddress(false);
    }
  };
  
  // 保護者情報フォーム
  const parentForm = useForm<ParentProfileForm>({
    resolver: zodResolver(parentProfileSchema),
    defaultValues: {
      parentName: "",
      phone: "",
      postalCode: "",
      prefecture: "",
      city: "",
      address: "",
    },
  });

  // 生徒情報フォーム
  const studentForm = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      lastNameFurigana: "",
      firstNameFurigana: "",
      gender: "",
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

  // 生徒の名前を結合する関数
  const getFullName = (student: Student) => {
    return `${student.lastName} ${student.firstName}`;
  };
  
  // 生徒のふりがなを結合する関数
  const getFullNameFurigana = (student: Student) => {
    return `${student.lastNameFurigana} ${student.firstNameFurigana}`;
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
          <h1 className="text-2xl font-bold text-primary">F education</h1>
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
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>保護者氏名</FormLabel>
                        <FormControl>
                          <Input placeholder="山田 太郎" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  <div className="flex space-x-2">
                    <FormField
                      control={parentForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>郵便番号</FormLabel>
                          <div className="flex items-center space-x-2">
                            <FormControl>
                              <Input placeholder="123-4567" {...field} />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              disabled={isSearchingAddress || !field.value || field.value.length < 7}
                              onClick={() => searchAddressByPostalCode(field.value)}
                            >
                              {isSearchingAddress ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={parentForm.control}
                      name="prefecture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>都道府県</FormLabel>
                          <FormControl>
                            <Input placeholder="東京都" {...field} />
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
                            <Input placeholder="渋谷区" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={parentForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>番地・マンション名等</FormLabel>
                        <FormControl>
                          <Input placeholder="1-2-3 ○○マンション101" {...field} />
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
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">生徒情報を入力</h3>
              <p className="text-sm text-gray-500 mb-4">ここでは、基本的な生徒情報を1名分入力してください。兄弟姉妹の登録は後から設定画面で行えます。</p>

              <Form {...studentForm}>
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={studentForm.control}
                      name="lastName"
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
                      name="firstName"
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
                      name="lastNameFurigana"
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
                      name="firstNameFurigana"
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
                          登録中...
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
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}