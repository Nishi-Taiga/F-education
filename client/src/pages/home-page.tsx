import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { BookingCard } from "@/components/booking-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket, CalendarCheck, Settings } from "lucide-react";
import type { Booking } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">家庭教師サービス</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")}>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-start md:justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">マイページ</h2>
            <p className="mt-1 text-sm text-gray-600">予約状況とチケット残数の確認</p>
          </div>
          <div className="mt-4 md:mt-0 bg-white shadow-sm rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="mr-4 bg-primary bg-opacity-10 p-3 rounded-full">
                <Ticket className="text-primary h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">チケット残数</p>
                <p className="text-2xl font-bold text-gray-900">{user?.ticketCount || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <Card className="p-4 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">予約済み授業</h3>
          </div>
          
          {isLoadingBookings ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <CalendarView bookings={bookings || []} />
          )}
          
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">授業予定</div>
            <div className="space-y-2">
              {isLoadingBookings ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : bookings && bookings.length > 0 ? (
                bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  予約済みの授業はありません
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
            onClick={() => navigate("/tickets")}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-3">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <span className="text-gray-900 font-medium">チケット購入</span>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
            onClick={() => navigate("/booking")}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-3">
                <CalendarCheck className="h-6 w-6 text-primary" />
              </div>
              <span className="text-gray-900 font-medium">授業予約</span>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
            onClick={() => navigate("/settings")}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-3">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <span className="text-gray-900 font-medium">設定</span>
            </div>
          </Button>
        </div>
      </main>
    </div>
  );
}
