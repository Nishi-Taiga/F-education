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
import TutorBookingsPage from "@/pages/tutor-bookings-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/tickets" component={TicketPurchasePage} />
      <ProtectedRoute path="/booking" component={BookingPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile-setup" component={ProfileSetupPage} skipProfileCheck={true} />
      {/* 講師関連のルート */}
      <ProtectedRoute path="/tutor/profile" component={TutorProfilePage} />
      <ProtectedRoute path="/tutor/schedule" component={TutorSchedulePage} />
      <ProtectedRoute path="/tutor/bookings" component={TutorBookingsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
