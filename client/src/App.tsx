import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import TicketPurchasePage from "@/pages/ticket-purchase-page";
import BookingPage from "@/pages/booking-page";
import SettingsPage from "@/pages/settings-page";
import ProfileSetupPage from "@/pages/profile-setup-page";
import TutorProfilePage from "@/pages/tutor-profile-page";
import TutorSchedulePage from "@/pages/tutor-schedule-page";
import ReportListPage from "@/pages/report-list-page";
import ReportEditPage from "@/pages/report-edit-page";
import DebugPage from "@/pages/debug-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { useEffect } from "react";

// 新しいページをインポート
import ProfileSelectionPage from "@/pages/profile-selection-page";
import ParentProfileSetupPage from "@/pages/parent-profile-setup-page";
import TutorProfileSetupPage from "@/pages/tutor-profile-setup-page";

// バグチェック用のロギング関数を追加
const logPathAccess = (path) => {
  console.log(`Checking route: ${path}`);
  return true;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/debug" component={DebugPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/tickets" component={TicketPurchasePage} />
      <ProtectedRoute path="/booking" component={BookingPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/reports" component={ReportListPage} />
      
      {/* プロフィール設定関連のルート - 正確なパスマッチングを修正 */}
      <ProtectedRoute path="/profile-setup" component={ProfileSelectionPage} skipProfileCheck={true} />
      
      {/* 末尾にスラッシュが付いていない場合のルート */}
      <ProtectedRoute path="/profile-setup/parent" component={ParentProfileSetupPage} skipProfileCheck={true} />
      <ProtectedRoute path="/profile-setup/tutor" component={TutorProfileSetupPage} skipProfileCheck={true} />
      
      {/* 末尾にスラッシュが付いている場合のルート */}
      <ProtectedRoute path="/profile-setup/parent/" component={ParentProfileSetupPage} skipProfileCheck={true} />
      <ProtectedRoute path="/profile-setup/tutor/" component={TutorProfileSetupPage} skipProfileCheck={true} />
      
      {/* 後方互換性のために一時的に残しておく古いルート */}
      <ProtectedRoute path="/profile-setup-old" component={ProfileSetupPage} skipProfileCheck={true} />
      
      {/* 講師関連のルート */}
      <ProtectedRoute path="/tutor/profile" component={TutorProfilePage} />
      <ProtectedRoute path="/tutor/schedule" component={TutorSchedulePage} />
      
      {/* レポート編集画面 */}
      <ProtectedRoute path="/report-edit" component={ReportEditPage} />
      
      {/* 404ページ - すべてのルートの最後に配置 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // ビューポートの高さを設定（モバイルブラウザ対応）
  useEffect(() => {
    const setVhProperty = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // 初期設定とリサイズイベントリスナー
    setVhProperty();
    window.addEventListener('resize', setVhProperty);
    
    // ルーティングのデバッグ情報を表示
    console.log("App initialized with routes for /profile-setup/parent and /profile-setup/tutor");
    
    return () => {
      window.removeEventListener('resize', setVhProperty);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="flex flex-col min-h-screen screen-container">
            <Toaster />
            <main className="flex-1 w-full max-w-screen-xl mx-auto px-4">
              <Router />
            </main>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}