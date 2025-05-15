"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, User, GraduationCap } from "lucide-react";

export default function ProfileSelectionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // セッション情報の取得
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch (error) {
        console.error("セッション取得エラー:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, []);

  // ログインしていない場合、認証ページにリダイレクト
  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/auth');
    }
  }, [isLoading, session, router]);

  // 保護者アカウントの選択ハンドラ
  const selectParentAccount = async () => {
    try {
      setIsLoading(true);

      // ユーザーメタデータに保護者ロールを設定
      const { error: updateError } = await supabase.auth.updateUser({
        data: { role: 'parent' }
      });

      if (updateError) throw updateError;

      // ユーザーテーブルにレコードを作成
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          user_id: session?.user.id,
          email: session?.user.email,
          role: 'parent',
          profile_completed: false
        });

      if (insertError) throw insertError;

      toast({
        title: "保護者アカウントを選択しました",
        description: "プロフィール設定を完了してください",
      });

      // プロフィール設定ページへリダイレクト
      router.push('/profile-setup');
    } catch (error: any) {
      console.error("保護者アカウント設定エラー:", error);
      toast({
        title: "エラー",
        description: `アカウント設定に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 講師アカウントの選択ハンドラ
  const selectTutorAccount = async () => {
    try {
      setIsLoading(true);

      // ユーザーメタデータに講師ロールを設定
      const { error: updateError } = await supabase.auth.updateUser({
        data: { role: 'tutor' }
      });

      if (updateError) throw updateError;

      // 講師プロフィールテーブルにレコードを作成
      const { error: insertError } = await supabase
        .from('tutor_profiles')
        .insert({
          user_id: session?.user.id,
          email: session?.user.email,
          profile_completed: false
        });

      if (insertError) throw insertError;

      toast({
        title: "講師アカウントを選択しました",
        description: "プロフィール設定を完了してください",
      });

      // 講師プロフィール設定ページへリダイレクト
      router.push('/profile-setup/tutor');
    } catch (error: any) {
      console.error("講師アカウント設定エラー:", error);
      toast({
        title: "エラー",
        description: `アカウント設定に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">アカウントタイプを選択</h1>
          <p className="mt-2 text-gray-600">
            F education のサービスを利用するためのアカウントタイプを選択してください。
            この選択は後から変更できませんのでご注意ください。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={selectParentAccount}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                保護者アカウント
              </CardTitle>
              <CardDescription>
                お子様の学習をサポートしたい方向け
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                <li>授業予約とチケット購入が可能です</li>
                <li>お子様の学習進捗を確認できます</li>
                <li>複数のお子様を登録できます</li>
              </ul>
              <Button className="w-full mt-4">保護者として登録</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={selectTutorAccount}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="mr-2 h-5 w-5" />
                講師アカウント
              </CardTitle>
              <CardDescription>
                生徒に授業を提供する講師の方向け
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                <li>授業スケジュールの管理ができます</li>
                <li>生徒の授業履歴を確認できます</li>
                <li>レポート作成と共有ができます</li>
              </ul>
              <Button className="w-full mt-4">講師として登録</Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ご不明な点がある場合は、サポートにお問い合わせください。
          <br />
          <a href="mailto:support@feducation.com" className="text-primary hover:underline">
            support@feducation.com
          </a>
        </p>
      </div>
    </div>
  );
}