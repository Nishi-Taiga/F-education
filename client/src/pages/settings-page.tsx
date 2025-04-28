import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, PlusCircle, Search, User, GraduationCap, UsersRound } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Student, insertStudentSchema, updateUserProfileSchema } from "@shared/schema";
import { useState } from "react";
import axios from "axios";

const settingsSchema = z.object({
  displayName: z.string().min(1, "お名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  phone: z.string().optional(),
  postalCode: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードは必須です"),
  newPassword: z.string().min(6, "新しいパスワードは6文字以上必要です"),
  confirmPassword: z.string().min(6),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

// 生徒情報フォーム用のスキーマ
const studentSchema = insertStudentSchema.extend({
  birthDate: z.string().min(1, "生年月日は必須です"),
});

type StudentForm = z.infer<typeof studentSchema>;

// 住所情報フォーム用のスキーマ
const addressSchema = updateUserProfileSchema;

type AddressForm = z.infer<typeof addressSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("profile");

  // 生徒情報のクエリ
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!user,
  });

  // 生徒の名前を結合する関数
  const getFullName = (student: Student) => {
    return `${student.lastName} ${student.firstName}`;
  };
  
  // 生徒のふりがなを結合する関数
  const getFullNameFurigana = (student: Student) => {
    return `${student.lastNameFurigana} ${student.firstNameFurigana}`;
  };

  // 通常の設定フォーム
  const settingsForm = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      postalCode: user?.postalCode || "",
      prefecture: user?.prefecture || "",
      city: user?.city || "",
      address: user?.address || "",
      emailNotifications: user?.emailNotifications || true,
      smsNotifications: user?.smsNotifications || false,
    },
  });

  // 住所情報フォーム
  const addressForm = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      phone: user?.phone || "",
      postalCode: user?.postalCode || "",
      prefecture: user?.prefecture || "",
      city: user?.city || "",
      address: user?.address || "",
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
      school: "",
      grade: "",
      birthDate: "",
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
        addressForm.setValue('prefecture', result.address1);
        addressForm.setValue('city', result.address2 + result.address3);
        
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

  // 設定の更新
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const res = await apiRequest("PATCH", "/api/user/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "設定を保存しました",
        description: "アカウント設定が正常に更新されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 住所情報の更新
  const updateAddressMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "住所情報を保存しました",
        description: "住所情報が正常に更新されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 生徒の追加
  const addStudentMutation = useMutation({
    mutationFn: async (data: StudentForm) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({
        title: "生徒情報が保存されました",
        description: "生徒情報の登録が完了しました",
      });
      // フォームをリセット
      studentForm.reset({
        lastName: "",
        firstName: "",
        lastNameFurigana: "",
        firstNameFurigana: "",
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

  // パスワード情報フォーム
  const passwordForm = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmitSettings = (data: SettingsForm) => {
    updateSettingsMutation.mutate(data);
  };

  const onSubmitPasswordChange = (data: PasswordChangeForm) => {
    toast({
      title: "機能は実装中です",
      description: "パスワード変更機能はまだ実装されていません。",
    });
    passwordForm.reset();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">家庭教師サービス</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">設定</h2>
          <p className="mt-1 text-sm text-gray-600">アカウント設定を変更</p>
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              プロフィール
            </TabsTrigger>
            <TabsTrigger value="address">
              <Search className="mr-2 h-4 w-4" />
              住所情報
            </TabsTrigger>
            <TabsTrigger value="students">
              <UsersRound className="mr-2 h-4 w-4" />
              生徒管理
            </TabsTrigger>
            <TabsTrigger value="password">
              <ArrowLeft className="mr-2 h-4 w-4" />
              パスワード
            </TabsTrigger>
          </TabsList>

          {/* プロフィール情報タブ */}
          <TabsContent value="profile">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6">プロフィール情報</h3>
              
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSubmitSettings)} className="space-y-8">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={settingsForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名</FormLabel>
                          <FormControl>
                            <Input placeholder="田中 花子" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={settingsForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>メールアドレス</FormLabel>
                          <FormControl>
                            <Input placeholder="example@email.com" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-6">通知設定</h3>
                    
                    <div className="space-y-4">
                      <FormField
                        control={settingsForm.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>メール通知</FormLabel>
                              <FormDescription>
                                予約確認やリマインダーをメールで受け取る
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={settingsForm.control}
                        name="smsNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>SMS通知</FormLabel>
                              <FormDescription>
                                予約確認やリマインダーをSMSで受け取る
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => navigate("/")}>
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={updateSettingsMutation.isPending}>
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        "保存する"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>

          {/* 住所情報タブ */}
          <TabsContent value="address">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6">住所情報</h3>
              
              <Form {...addressForm}>
                <form onSubmit={addressForm.handleSubmit((data) => updateAddressMutation.mutate(data))} className="space-y-6">
                  <FormField
                    control={addressForm.control}
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
                      control={addressForm.control}
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
                      control={addressForm.control}
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
                      control={addressForm.control}
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
                    control={addressForm.control}
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

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => navigate("/")}>
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={updateAddressMutation.isPending}>
                      {updateAddressMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        "保存する"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>

          {/* 生徒情報管理タブ */}
          <TabsContent value="students">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6">生徒情報登録</h3>
              <p className="text-sm text-gray-500 mb-4">新しい生徒情報を追加して、兄弟・姉妹の家庭教師予約も可能になります。</p>
              
              <Form {...studentForm}>
                <form onSubmit={studentForm.handleSubmit((data) => addStudentMutation.mutate(data))} className="space-y-6">
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
                              <option value="小学1年生">小学1年生</option>
                              <option value="小学2年生">小学2年生</option>
                              <option value="小学3年生">小学3年生</option>
                              <option value="小学4年生">小学4年生</option>
                              <option value="小学5年生">小学5年生</option>
                              <option value="小学6年生">小学6年生</option>
                              <option value="中学1年生">中学1年生</option>
                              <option value="中学2年生">中学2年生</option>
                              <option value="中学3年生">中学3年生</option>
                              <option value="高校1年生">高校1年生</option>
                              <option value="高校2年生">高校2年生</option>
                              <option value="高校3年生">高校3年生</option>
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

                  <div className="flex justify-end">
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
                          <PlusCircle className="mr-2 h-4 w-4" />
                          生徒を追加
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            {/* 登録済み生徒一覧 */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6">登録済み生徒</h3>

              {isLoadingStudents ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : students && students.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {students.map((student) => (
                      <div key={student.id} className="p-4 border rounded-md bg-gray-50">
                        <div className="font-medium">{getFullName(student)}</div>
                        <div className="text-sm text-gray-500">{getFullNameFurigana(student)}</div>
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
            </div>
          </TabsContent>

          {/* パスワード変更タブ */}
          <TabsContent value="password">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">パスワード変更</h3>
              
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onSubmitPasswordChange)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>現在のパスワード</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div></div>
                    
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>新しいパスワード</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>パスワード確認</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => passwordForm.reset()}>
                      キャンセル
                    </Button>
                    <Button type="submit">
                      変更する
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}