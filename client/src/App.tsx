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

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/tickets" component={TicketPurchasePage} />
      <ProtectedRoute path="/booking" component={BookingPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/reports" component={ReportListPage} />
      <ProtectedRoute path="/profile-setup" component={ProfileSetupPage} skipProfileCheck={true} />
      {/* 講師関連のルート */}
      <ProtectedRoute path="/tutor/profile" component={TutorProfilePage} />
      <ProtectedRoute path="/tutor/schedule" component={TutorSchedulePage} />
      {/* レポート編集画面 */}
      <ProtectedRoute path="/report-edit" component={ReportEditPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/debug" component={DebugPage} />
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

export default App;
