"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-provider";

// プロフィール設定スキーマ
const profileSchema = z.object({
  parentName: z.string().min(2, { message: "氏名を入力してください" }),
  phone: z.string().min(10, { message: "有効な電話番号を入力してください" }).max(15),
  postalCode: z.string().min(7, { message: "郵便番号を入力してください（ハイフンなし）" }).max(8),
  prefecture: z.string().min(2, { message: "都道府県を入力してください" }),
  city: z.string().min(2, { message: "市区町村を入力してください" }),
  address: z.string().min(2, { message: "番地・建物名等を入力してください" }),
});

export default function ProfileSetupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, userDetails, refreshUserDetails } = useAuth();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      parentName: userDetails?.displayName || "",
      phone: userDetails?.phone || "",
      postalCode: userDetails?.postalCode || "",
      prefecture: userDetails?.prefecture || "",
      city: userDetails?.city || "",
      address: userDetails?.address || "",
    },
  });

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    if (!user) {
      toast({
        title: "エラー",
        description: "ログインが必要です",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "プロフィールの更新に失敗しました");
      }

      await refreshUserDetails();
      
      toast({
        title: "プロフィール設定完了",
        description: "プロフィール情報が保存されました",
      });
      
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "プロフィール設定エラー",
        description: error.message || "プロフィールの更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>プロフィール設定</CardTitle>
          <CardDescription>
            サービスをご利用いただくために、保護者様の情報を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>保護者氏名</FormLabel>
                    <FormControl>
                      <Input placeholder="山田 太郎" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話番号</FormLabel>
                    <FormControl>
                      <Input placeholder="09012345678" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription>ハイフンなしで入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>郵便番号</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription>ハイフンなしで入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prefecture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>都道府県</FormLabel>
                    <FormControl>
                      <Input placeholder="東京都" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>市区町村</FormLabel>
                    <FormControl>
                      <Input placeholder="渋谷区" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>番地・建物名等</FormLabel>
                    <FormControl>
                      <Input placeholder="神南1-2-3 ○○マンション101" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存する"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
