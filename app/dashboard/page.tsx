"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-provider";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, userDetails, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch user's bookings and tickets
  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      try {
        // Fetch bookings
        const bookingsRes = await fetch("/api/bookings");
        const bookingsData = await bookingsRes.json();
        
        // Fetch tickets
        const ticketsRes = await fetch("/api/student-tickets");
        const ticketsData = await ticketsRes.json();
        
        setBookings(bookingsData);
        setTickets(ticketsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "エラーが発生しました",
          description: "データの読み込みに失敗しました。再度お試しください。",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    }
    
    fetchData();
  }, [user, toast]);

  // Handle profile setup redirect if needed
  useEffect(() => {
    if (!loading && user && userDetails) {
      if (!userDetails.profileCompleted) {
        router.push("/profile-setup");
      }
    }
  }, [user, userDetails, loading, router]);

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      <h1 className="text-3xl font-bold">ダッシュボード</h1>
      
      {/* チケット情報 */}
      <Card>
        <CardHeader>
          <CardTitle>マイチケット</CardTitle>
          <CardDescription>
            授業の予約に使用できるチケット残数
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket: any) => (
                <div key={ticket.studentId} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{ticket.name}</p>
                    <p className="text-muted-foreground">残りチケット: {ticket.ticketCount}枚</p>
                  </div>
                </div>
              ))}
              <Button 
                onClick={() => router.push("/tickets")}
                className="w-full"
              >
                チケットを購入する
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4">チケットがありません</p>
              <Button 
                onClick={() => router.push("/tickets")}
                className="w-full"
              >
                チケットを購入する
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 予約情報 */}
      <Card>
        <CardHeader>
          <CardTitle>予約状況</CardTitle>
          <CardDescription>
            直近の授業予約
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.slice(0, 3).map((booking: any) => (
                <div key={booking.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between">
                    <p className="font-medium">{booking.date}</p>
                    <p className="text-sm">{booking.timeSlot}</p>
                  </div>
                  <p>科目: {booking.subject}</p>
                  <p>講師: {booking.tutorName || "未定"}</p>
                  {booking.studentName && <p>生徒: {booking.studentName}</p>}
                </div>
              ))}
              <Button 
                onClick={() => router.push("/booking")}
                className="w-full"
              >
                授業を予約する
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4">予約がありません</p>
              <Button 
                onClick={() => router.push("/booking")}
                className="w-full"
              >
                授業を予約する
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
