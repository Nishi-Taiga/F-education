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
import { ArrowLeft, Loader2, PlusCircle, Search, User, GraduationCap, UsersRound, XCircle, KeyRound, CheckCircle, RefreshCw } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  gender: z.string().min(1, "性別を選択してください"),
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
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [accountInfoDialogOpen, setAccountInfoDialogOpen] = useState(false);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [studentAccountInfo, setStudentAccountInfo] = useState<{ 
    username: string; 
    password: string; 
    fullName: string; 
    studentAccountId: number;
  } | null>(null);
  
  // パスワード変更ダイアログ関連の状態
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // ユーザー名変更ダイアログを表示する関数
  const updateStudentUsernameDialog = () => {
    setNewUsername("");
    setUsernameDialogOpen(true);
  };
  
  // パスワード変更ダイアログを表示する関数
  const updateStudentPasswordDialog = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordDialogOpen(true);
  };

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
      gender: "",
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
  
  // 生徒の更新
  const updateStudentMutation = useMutation({
    mutationFn: async (data: StudentForm & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/students/${id}`, updateData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({
        title: "生徒情報が更新されました",
        description: "生徒情報の更新が完了しました",
      });
      // 編集モードを解除
      setEditingStudentId(null);
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
        description: `生徒情報の更新に失敗しました: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒の削除
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest("DELETE", `/api/students/${studentId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // 削除情報を表示（キャンセルされた予約数とチケットの返却情報）
      let description = "生徒情報の削除が完了しました";
      if (data.cancelledBookings > 0) {
        description = `生徒情報を削除しました。${data.cancelledBookings}件の予約がキャンセルされ、${data.returnedTickets}枚のチケットが返却されました。`;
      }
      
      toast({
        title: "生徒情報が削除されました",
        description: description,
      });
      
      // 編集モードを解除
      setEditingStudentId(null);
      // 削除ダイアログを閉じる
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `生徒情報の削除に失敗しました: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒アカウント作成
  const createStudentAccountMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest("POST", `/api/students/${studentId}/account`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || '生徒アカウント作成に失敗しました');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({
        title: "生徒アカウントが作成されました",
        description: (
          <div className="space-y-2">
            <p>
              <span className="font-medium">{data.student.name}</span>さんのアカウントが作成されました
            </p>
            <div className="bg-slate-50 p-2 rounded text-sm">
              <p><span className="font-medium">ユーザー名:</span> {data.student.username}</p>
            </div>
            <p className="text-xs text-slate-600">このアカウントで生徒が直接ログインできるようになりました</p>
          </div>
        ),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `生徒アカウントの作成に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒アカウント情報取得
  const viewStudentAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      try {
        const res = await fetch(`/api/students/account/${accountId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || '生徒アカウント情報の取得に失敗しました');
        }
        
        return res.json();
      } catch (error) {
        console.error("Error fetching student account:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setStudentAccountInfo({
        username: data.username,
        password: data.password || '-', // パスワードがある場合のみ表示
        fullName: data.fullName,
        studentAccountId: data.accountId || 0,
      });
      setAccountInfoDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `生徒アカウント情報の取得に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒アカウントのパスワードリセット
  const resetStudentPasswordMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const res = await apiRequest("POST", `/api/students/account/${accountId}/reset-password`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'パスワードのリセットに失敗しました');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // アカウント情報を更新
      setStudentAccountInfo({
        ...studentAccountInfo!,
        password: data.password,
      });
      
      toast({
        title: "パスワードがリセットされました",
        description: "新しいパスワードが発行されました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `パスワードのリセットに失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒アカウントのユーザー名変更
  const updateStudentUsernameMutation = useMutation({
    mutationFn: async (data: { accountId: number; username: string }) => {
      const res = await apiRequest("PATCH", `/api/students/account/${data.accountId}/username`, {
        username: data.username
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'ユーザー名の変更に失敗しました');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // アカウント情報を更新
      setStudentAccountInfo({
        ...studentAccountInfo!,
        username: data.username,
      });
      
      // ダイアログを閉じる
      setUsernameDialogOpen(false);
      
      toast({
        title: "ユーザー名が変更されました",
        description: "新しいユーザー名に更新されました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `ユーザー名の変更に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // 生徒アカウントのパスワード変更
  const updateStudentPasswordMutation = useMutation({
    mutationFn: async (data: { accountId: number; password: string }) => {
      try {
        const res = await fetch(`/api/students/account/${data.accountId}/password`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: data.password }),
          credentials: 'include',
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'パスワードの変更に失敗しました');
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error updating password:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // アカウント情報を更新
      setStudentAccountInfo({
        ...studentAccountInfo!,
        password: '••••••••', // パスワードは表示せず、マスクされた値を表示
      });
      
      // ダイアログを閉じる
      setPasswordDialogOpen(false);
      
      toast({
        title: "パスワードが変更されました",
        description: "新しいパスワードが設定されました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `パスワードの変更に失敗しました: ${error.message}`,
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
            {/* 登録済み生徒一覧 - 上部に配置 */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6">登録済み生徒</h3>

              {isLoadingStudents ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : students && students.length > 0 ? (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div key={student.id} className="p-4 border rounded-md bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{getFullName(student)}</div>
                          <div className="text-sm text-gray-500">{getFullNameFurigana(student)}</div>
                          <div className="mt-1 text-sm">
                            {student.school} | {student.grade}
                          </div>
                          
                          {/* 生徒アカウント作成ボタン */}
                          <div className="mt-2">
                            {student.studentAccountId ? (
                              <div className="flex flex-col">
                                <div className="text-xs flex items-center text-green-600 mb-1">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  アカウント発行済み
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center text-xs h-6 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 生徒アカウント情報を表示するために、アカウント情報APIを呼び出す
                                    if (student.studentAccountId) {
                                      viewStudentAccountMutation.mutate(student.studentAccountId);
                                    }
                                  }}
                                >
                                  <User className="mr-1 h-3 w-3" />
                                  ログイン情報を確認
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center text-xs"
                                onClick={(e) => {
                                  e.stopPropagation(); // イベントの伝播を止める
                                  createStudentAccountMutation.mutate(student.id);
                                }}
                                disabled={createStudentAccountMutation.isPending && createStudentAccountMutation.variables === student.id}
                              >
                                <KeyRound className="mr-1 h-3 w-3" />
                                {createStudentAccountMutation.isPending && createStudentAccountMutation.variables === student.id 
                                  ? '作成中...' 
                                  : '生徒アカウント作成'}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // 編集する生徒情報をセット
                              setEditingStudent(student);
                              setEditingStudentId(student.id);
                              // ダイアログを開く
                              setEditDialogOpen(true);
                            }}
                          >
                            編集
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              // 削除確認ダイアログ表示の前に生徒情報をセット
                              setEditingStudent(student);
                              setEditingStudentId(student.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 border rounded-md bg-gray-50">
                  <p className="text-gray-500">生徒が登録されていません</p>
                  <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    新規生徒登録
                  </Button>
                </div>
              )}
              
              {/* 「生徒を追加」ボタン - 登録済み生徒が最後に表示 */}
            </div>
            
            {/* 生徒削除確認ダイアログ */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>生徒情報の削除</DialogTitle>
                  <DialogDescription>
                    {editingStudent && (
                      <>
                        <span className="font-medium">{getFullName(editingStudent)}</span>
                        さんの情報を削除します。この操作は元に戻せません。
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  <p className="text-sm text-gray-700 mb-3">
                    削除した生徒のデータは復元できません。また、以下の処理が自動的に行われます：
                  </p>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    <li>この生徒に関連するすべての授業予約が自動的にキャンセルされます</li>
                    <li>キャンセルされた授業分のチケットがアカウントに返却されます</li>
                  </ul>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={() => {
                      if (editingStudentId) {
                        deleteStudentMutation.mutate(editingStudentId);
                      }
                    }}
                    disabled={deleteStudentMutation.isPending}
                  >
                    {deleteStudentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        削除中...
                      </>
                    ) : (
                      "削除する"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 生徒編集ダイアログ */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>生徒情報の編集</DialogTitle>
                  <DialogDescription>
                    変更したい項目のみ入力してください。入力がない項目は更新されません。
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...studentForm}>
                  <form 
                    id="edit-student-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = studentForm.getValues();
                      
                      // 未入力フィールドを除外した更新データを作成
                      const updateData: Partial<StudentForm> & { id: number } = {
                        id: editingStudentId as number,
                      };
                      
                      // 入力されているフィールドのみ更新データに追加
                      if (formData.lastName) updateData.lastName = formData.lastName;
                      if (formData.firstName) updateData.firstName = formData.firstName;
                      if (formData.lastNameFurigana) updateData.lastNameFurigana = formData.lastNameFurigana;
                      if (formData.firstNameFurigana) updateData.firstNameFurigana = formData.firstNameFurigana;
                      if (formData.gender) updateData.gender = formData.gender;
                      if (formData.school) updateData.school = formData.school;
                      if (formData.grade) updateData.grade = formData.grade;
                      if (formData.birthDate) updateData.birthDate = formData.birthDate;
                      
                      // 更新処理を実行
                      updateStudentMutation.mutate(updateData as any);
                      setEditDialogOpen(false);
                    }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={studentForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>姓</FormLabel>
                            <FormControl>
                              <Input placeholder={editingStudent?.lastName} {...field} />
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
                              <Input placeholder={editingStudent?.firstName} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={studentForm.control}
                        name="lastNameFurigana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>姓（ふりがな）</FormLabel>
                            <FormControl>
                              <Input placeholder={editingStudent?.lastNameFurigana} {...field} />
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
                              <Input placeholder={editingStudent?.firstNameFurigana} {...field} />
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
                              <option value="">現在: {editingStudent?.gender || "選択してください"}</option>
                              <option value="男性">男性</option>
                              <option value="女性">女性</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={studentForm.control}
                        name="school"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>学校</FormLabel>
                            <FormControl>
                              <Input placeholder={editingStudent?.school} {...field} />
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
                                <option value="">現在: {editingStudent?.grade || "選択してください"}</option>
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
                            <Input 
                              type="date" 
                              placeholder={editingStudent?.birthDate} 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      // ダイアログを閉じる
                      setEditDialogOpen(false);
                      // フォームをリセット
                      studentForm.reset({
                        lastName: "",
                        firstName: "",
                        lastNameFurigana: "",
                        firstNameFurigana: "",
                        gender: "",
                        school: "",
                        grade: "",
                        birthDate: "",
                      });
                      setEditingStudentId(null);
                      setEditingStudent(null);
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    type="submit"
                    form="edit-student-form"
                    disabled={updateStudentMutation.isPending}
                  >
                    {updateStudentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "更新する"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 生徒を追加ボタン - 下部に配置 */}
            <div className="flex justify-center mt-6 mb-8">
              <Button 
                onClick={() => {
                  // フォームをリセット
                  studentForm.reset({
                    lastName: "",
                    firstName: "",
                    lastNameFurigana: "",
                    firstNameFurigana: "",
                    gender: "",
                    school: "",
                    grade: "",
                    birthDate: "",
                  });
                  // 新規追加ダイアログを開く
                  setAddDialogOpen(true);
                }}
                className="flex items-center"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                生徒を追加
              </Button>
            </div>
            
            {/* 生徒追加ダイアログ */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>生徒情報の新規登録</DialogTitle>
                  <DialogDescription>
                    新しい生徒情報を追加して、兄弟・姉妹の家庭教師予約も可能になります。
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...studentForm}>
                  <form 
                    id="add-student-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = studentForm.getValues();
                      // userId を追加
                      const data = {
                        ...formData,
                        userId: user?.id as number,
                      };
                      // 新規追加処理
                      addStudentMutation.mutate(data as any);
                      setAddDialogOpen(false);
                    }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </form>
                </Form>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      // ダイアログを閉じる
                      setAddDialogOpen(false);
                      // フォームをリセット
                      studentForm.reset({
                        lastName: "",
                        firstName: "",
                        lastNameFurigana: "",
                        firstNameFurigana: "",
                        gender: "",
                        school: "",
                        grade: "",
                        birthDate: "",
                      });
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    type="submit"
                    form="add-student-form"
                    disabled={addStudentMutation.isPending}
                  >
                    {addStudentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登録中...
                      </>
                    ) : (
                      "登録する"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                // 新しいパスワードが変更されたとき、確認欄も検証する
                                const confirmPassword = passwordForm.getValues("confirmPassword");
                                if (confirmPassword && e.target.value && confirmPassword !== e.target.value) {
                                  passwordForm.setError("confirmPassword", {
                                    type: "manual",
                                    message: "パスワードが一致しません"
                                  });
                                } else if (confirmPassword) {
                                  passwordForm.clearErrors("confirmPassword");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
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
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                // 入力時に新しいパスワードと一致するか確認し、FormMessageを表示する
                                const newPassword = passwordForm.getValues("newPassword");
                                if (newPassword && e.target.value && newPassword !== e.target.value) {
                                  passwordForm.setError("confirmPassword", {
                                    type: "manual",
                                    message: "パスワードが一致しません"
                                  });
                                } else {
                                  passwordForm.clearErrors("confirmPassword");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
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

        {/* 生徒アカウント情報ダイアログ */}
        <Dialog open={accountInfoDialogOpen} onOpenChange={setAccountInfoDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>生徒アカウント情報</DialogTitle>
              <DialogDescription>
                {studentAccountInfo && (
                  <>
                    <span className="font-medium">{studentAccountInfo.fullName}</span>
                    さんのログイン情報です。生徒に共有してください。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {studentAccountInfo && (
              <div className="py-4">
                <div className="bg-slate-50 p-4 rounded space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">ユーザー名</p>
                      <p className="font-medium">{studentAccountInfo.username}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (studentAccountInfo && studentAccountInfo.studentAccountId) {
                          console.log("Showing username dialog for account:", studentAccountInfo.studentAccountId);
                          updateStudentUsernameDialog();
                        }
                      }}
                    >
                      変更
                    </Button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">パスワード</p>
                      <p className="font-medium">{studentAccountInfo.password}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (studentAccountInfo && studentAccountInfo.studentAccountId) {
                          updateStudentPasswordDialog();
                        }
                      }}
                    >
                      変更
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  このログイン情報で生徒は自分の予約状況を確認できます。
                  セキュリティのため、ログイン情報は安全に保管してください。
                </p>
              </div>
            )}
            
            <DialogFooter>
              <Button type="button" onClick={() => setAccountInfoDialogOpen(false)}>
                閉じる
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* パスワード変更ダイアログ */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>パスワードの変更</DialogTitle>
              <DialogDescription>
                {studentAccountInfo && (
                  <>
                    <span className="font-medium">{studentAccountInfo.fullName}</span>
                    さんのパスワードを変更します。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (newPassword && confirmPassword && studentAccountInfo) {
                  // パスワードの検証
                  if (newPassword.length < 8) {
                    setPasswordError("パスワードは8文字以上である必要があります");
                    return;
                  }
                  
                  if (newPassword !== confirmPassword) {
                    setPasswordError("パスワードが一致しません");
                    return;
                  }
                  
                  // エラーがなければパスワード変更を実行
                  setPasswordError("");
                  updateStudentPasswordMutation.mutate({
                    accountId: studentAccountInfo.studentAccountId,
                    password: newPassword
                  });
                }
              }}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">新しいパスワード</Label>
                    <Input 
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (confirmPassword && e.target.value !== confirmPassword) {
                          setPasswordError("パスワードが一致しません");
                        } else {
                          setPasswordError("");
                        }
                      }}
                      placeholder="新しいパスワードを入力"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">パスワード確認</Label>
                    <Input 
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (newPassword && e.target.value !== newPassword) {
                          setPasswordError("パスワードが一致しません");
                        } else {
                          setPasswordError("");
                        }
                      }}
                      placeholder="パスワードを再入力"
                    />
                  </div>
                  
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    新しいパスワードは少なくとも8文字以上の長さが必要です。
                    セキュリティのため、数字、記号、大文字を含めることをお勧めします。
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPasswordDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    type="submit"
                    disabled={
                      !newPassword || 
                      !confirmPassword ||
                      newPassword.length < 8 ||
                      newPassword !== confirmPassword ||
                      updateStudentPasswordMutation.isPending
                    }
                  >
                    {updateStudentPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "変更する"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* ユーザー名変更ダイアログ */}
        <Dialog open={usernameDialogOpen} onOpenChange={setUsernameDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>ユーザー名の変更</DialogTitle>
              <DialogDescription>
                {studentAccountInfo && (
                  <>
                    <span className="font-medium">{studentAccountInfo.fullName}</span>
                    さんのユーザー名を変更します。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (newUsername && studentAccountInfo) {
                  updateStudentUsernameMutation.mutate({
                    accountId: studentAccountInfo.studentAccountId,
                    username: newUsername
                  });
                }
              }}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-username">新しいユーザー名</Label>
                    <Input 
                      id="new-username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="新しいユーザー名を入力"
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    新しいユーザー名は少なくとも4文字以上の長さが必要です。
                    ユーザー名はログインの際に利用するため、覚えやすいものを選んでください。
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setUsernameDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    type="submit"
                    disabled={
                      !newUsername || 
                      newUsername.length < 4 || 
                      updateStudentUsernameMutation.isPending
                    }
                  >
                    {updateStudentUsernameMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "変更する"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}