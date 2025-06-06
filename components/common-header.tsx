import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  Calendar,
  Ticket, 
  Settings, 
  LogOut, 
  Menu, 
  Home,
  FileText,
  User,
  Clock,
  ArrowLeft
} from "lucide-react";

interface CommonHeaderProps {
  showBackButton?: boolean;
  backTo?: string;
  title?: string;
  userRole?: string;
}

export function CommonHeader({ 
  showBackButton = false, 
  backTo = "/", 
  title,
  userRole
}: CommonHeaderProps) {
  const router = useRouter();
  const { user, logoutMutation } = useAuth();
  
  // Navigate関数
  const navigate = (path: string) => {
    router.push(path);
  };

  // ヘッダータイトルを決定
  const headerTitle = title || "F education";

  const handleLogout = async () => {
    await logoutMutation.mutate();
    router.push('/auth'); // ログアウト後に/authへ明示的に遷移
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm w-full">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-2 h-8 w-8 md:h-9 md:w-9" 
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          )}
          <h1 
            className="text-xl md:text-2xl font-bold text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent cursor-pointer"
            onClick={() => navigate("/")}
          >
            {headerTitle}
          </h1>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* ユーザー名表示 */}
          <span className="text-sm md:text-base text-gray-700 mr-2">
            {user?.displayName}
          </span>
          {/* ハンバーガーメニュー（常時表示） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* ロールに応じてメニュー項目を出し分け */}
              {user?.role === 'tutor' ? (
                  <>
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}> 
                          <Home className="h-4 w-4 mr-2" />
                          ダッシュボード
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/tutor/schedule")}> 
                          <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                          シフト管理
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/reports?role=tutor")}>
                          <FileText className="h-4 w-4 mr-2 text-gray-600" />
                          過去レポート
                      </DropdownMenuItem>
                  </>
              ) : user?.role === 'parent' ? (
                  <>
                       <DropdownMenuItem onClick={() => navigate("/dashboard")}> 
                          <Home className="h-4 w-4 mr-2" />
                          ダッシュボード
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/tickets")}> 
                          <Ticket className="h-4 w-4 mr-2 text-green-600" />
                          チケット購入
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/booking")}>
                          <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                          授業予約
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => navigate("/reports")}> 
                          <FileText className="h-4 w-4 mr-2 text-gray-600" />
                          授業レポート
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/dashboard/parent/profile")}> 
                          <Settings className="h-4 w-4 mr-2" />
                          設定
                      </DropdownMenuItem>
                  </>
              ) : user?.role === 'student' ? (
                  <>
                       <DropdownMenuItem onClick={() => navigate("/dashboard")}> 
                          <Home className="h-4 w-4 mr-2" />
                          ダッシュボード
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/booking")}>
                          <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                          授業予約
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => navigate("/reports")}>
                          <FileText className="h-4 w-4 mr-2 text-gray-600" />
                          レポート確認
                      </DropdownMenuItem>
                  </>
              ) : (
                  // ロールが不明または未認証の場合のメニュー（例: ホーム、ログインなど）
                   <>
                      <DropdownMenuItem onClick={() => navigate("/")}> 
                          <Home className="h-4 w-4 mr-2" />
                          ホーム
                      </DropdownMenuItem>
                       {/* ログイン/登録ページへのリンクなど */}
                   </>
              )}
              {/* ログアウトは全ての認証済みユーザーに表示 */}
              {user && (
                   <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:text-red-700 cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2 text-red-600" />
                      ログアウト
                  </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}