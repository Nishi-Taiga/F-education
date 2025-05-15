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
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";
import axios from "axios";

// 保護者情報のためのスキーマ
const parentProfileSchema = z.object({
  first_name: z.string().min(1, { message: "名を入力してください" }),
  last_name: z.string().min(1, { message: "姓を入力してください" }),
  phone: z.string().min(10, { message: "電話番号は10桁以上で入力してください" }).max(15),
  postal_code: z.string().min(7, { message: "郵便番号は7桁で入力してください" }).max(8),
  prefecture: z.string().min(2, { message: "都道府県を入力してください" }),
  city: z.string().min(2, { message: "市区町村を入力してください" }),
  address: z.string().min(2, { message: "番地以降の住所を入力してください" }),
});

type ParentProfileForm = z.infer<typeof parentProfileSchema>;

export default function ProfileSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // 保護者情報フォーム
  const parentForm = useForm<ParentProfileForm>({
    resolver: zodResolver(parentProfileSchema),
    defaultValues: {
      last_name: "",
      first_name: "",
      phone: "",
      postal_code: "",
      prefecture: "",
      city: "",
      address: "",
    },
  });

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

  // 保護者情報の送信
  const onParentSubmit = async (values: ParentProfileForm) => {
    setIsLoading(true);
    try {
      // セッション情報を取得
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("セッションが見つかりません。再ログインしてください。");
      }
      
      // ユーザーID
      const userId = session.user.id;
      
      // ユーザーテーブルの更新
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
          postal_code: values.postal_code,
          prefecture: values.prefecture,
          city: values.city,
          address: values.address,
          profile_completed: true,
        })
        .eq('user_id', userId);
        
      if (userUpdateError) throw userUpdateError;
      
      toast({
        title: "保護者情報が保存されました",
        description: "生徒情報の入力画面に進みます",
      });
      
      // 生徒登録画面に進む
      router.push('/profile-setup/student');
    } catch (error: any) {
      console.error("保護者情報保存エラー:", error);
      toast({
        title: "エラー",
        description: `保護者情報の保存に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-2xl font-bold text-gray-900">保護者プロフィール設定</h2>
          <p className="mt-1 text-sm text-gray-600">サービスを利用するために必要な保護者情報を入力してください</p>
        </div>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>保護者情報を入力</CardTitle>
            <CardDescription>お子様の授業予約に必要な情報です</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...parentForm}>
              <form onSubmit={parentForm.handleSubmit(onParentSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={parentForm.control}
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
                    control={parentForm.control}
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
                    name="postal_code"
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

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => router.push('/profile-selection')}
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
                        次へ進む
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
