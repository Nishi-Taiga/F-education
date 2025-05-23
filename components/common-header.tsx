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
}

export function CommonHeader({ 
  showBackButton = false, 
  backTo = "/", 
  title
}: CommonHeaderProps) {
  const { user, logoutMutation } = useAuth();
  const router = useRouter();
  
  // Navigate関数
  const navigate = (path: string) => {
    router.push(path);
  };

  // ヘッダータイトルを決定
  const headerTitle = title || "F education";

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
          <span className="text-sm md:text-base text-gray-700 hidden md:inline-block mr-2">
            {user?.displayName}
          </span>
          
          {/* デスクトップのメニュー */}
          <div className="hidden md:flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logoutMutation.mutate();
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-1" />
              ログアウト
            </Button>
          </div>

          {/* モバイルのドロップダウンメニュー */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* モバイルでユーザー名表示 */}
                <div className="px-2 py-1.5 text-sm text-gray-700 font-medium border-b mb-1">
                  {user?.displayName}
                </div>
                <DropdownMenuItem onClick={() => navigate("/")}> 
                  <Home className="h-4 w-4 mr-2" />
                  ホーム
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { logoutMutation.mutate(); }}>
                  <LogOut className="h-4 w-4 mr-2 text-red-600" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}