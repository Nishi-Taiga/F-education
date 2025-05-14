import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProfileSelectionPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // プロフィール選択が完了しているかチェック
  const isProfileSelected = !!user && !!user.role;
  
  // プロフィール選択が完了している場合は、適切なページにリダイレクト
  if (isProfileSelected) {
    if (user.role === "parent") {
      navigate("/parent-profile");
    } else if (user.role === "tutor") {
      navigate("/tutor-profile");
    }
    return null;
  }

  // 保護者として登録
  const registerAsParent = async () => {
    try {
      setIsLoading(true);
      
      // ロールを保護者に設定するAPIリクエスト
      const response = await fetch("/api/user/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "parent" }),
      });
      
      if (!response.ok) {
        throw new Error("保護者ロールの設定に失敗しました");
      }
      
      // 保護者用プロフィール設定ページに移動
      navigate("/parent-profile");
    } catch (error) {
      console.error("保護者登録エラー:", error);
      toast({
        title: "エラーが発生しました",
        description: "保護者登録に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // 講師として登録
  const registerAsTutor = async () => {
    try {
      setIsLoading(true);
      
      // ロールを講師に設定するAPIリクエスト
      const response = await fetch("/api/user/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "tutor" }),
      });
      
      if (!response.ok) {
        throw new Error("講師ロールの設定に失敗しました");
      }
      
      // 講師用プロフィール設定ページに移動
      navigate("/tutor-profile");
    } catch (error) {
      console.error("講師登録エラー:", error);
      toast({
        title: "エラーが発生しました",
        description: "講師登録に失敗しました。もう一度お試しください。",
        variant: "destructive"
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
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <h2 className="text-2xl font-bold text-center mb-8">プロフィール選択</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 保護者カード */}
            <Card className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  保護者として登録
                </CardTitle>
                <CardDescription>
                  お子様の学習をサポートしたい保護者の方はこちら
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  保護者アカウントでは、お子様の学習進捗の確認、講師との連絡、授業の予約などが可能です。
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={registerAsParent}
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : '保護者として続ける'}
                </Button>
              </CardFooter>
            </Card>
            
            {/* 講師カード */}
            <Card className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  講師として登録
                </CardTitle>
                <CardDescription>
                  生徒を指導したい講師・チューターの方はこちら
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  講師アカウントでは、授業の提供、生徒との連絡、スケジュール管理などが可能です。
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={registerAsTutor}
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : '講師として続ける'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}