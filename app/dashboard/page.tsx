"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

// 生徒情報の型
type UserDetails = {
  id: number;
  firstName?: string;
  lastName?: string;
  role?: string;
  email: string;
};

// 予約情報の型
type Booking = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  tutorName?: string;
};

// チケット情報の型
type Ticket = {
  id: number;
  quantity: number;
  description?: string;
  createdAt: string;
};

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // セッションとユーザー情報の取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          router.push('/');
          return;
        }
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        setUser({
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          email: session.user.email || ""
        });
        
        // 予約情報の取得（例）
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('studentId', userData.id)
          .order('date', { ascending: true });
          
        if (!bookingsError && bookingsData) {
          setBookings(bookingsData);
        }
        
        // チケット情報の取得（例）
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('student_tickets')
          .select('*')
          .eq('studentId', userData.id)
          .order('createdAt', { ascending: false });
          
        if (!ticketsError && ticketsData) {
          setTickets(ticketsData);
        }
        
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, toast]);
  
  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };
  
  // プロフィール設定へ移動
  const goToProfileSetup = () => {
    router.push('/profile-setup');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">ダッシュボード</h1>
        <Button onClick={handleLogout} variant="outline">ログアウト</Button>
      </div>
      
      {user && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>ユーザー情報</CardTitle>
            <CardDescription>あなたのアカウント情報</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium">メールアドレス:</p>
                <p>{user.email}</p>
              </div>
              <div>
                <p className="font-medium">名前:</p>
                <p>{user.firstName && user.lastName 
                  ? `${user.lastName} ${user.firstName}` 
                  : "未設定"}</p>
              </div>
              <div>
                <p className="font-medium">役割:</p>
                <p>{user.role === 'parent' ? '保護者' : 
                   user.role === 'student' ? '生徒' : 
                   user.role === 'tutor' ? '講師' : '不明'}</p>
              </div>
              <div className="md:col-span-2 mt-2">
                <Button onClick={goToProfileSetup}>
                  プロフィール設定
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="bookings">予約情報</TabsTrigger>
          <TabsTrigger value="tickets">チケット情報</TabsTrigger>
        </TabsList>
        
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>予約一覧</CardTitle>
              <CardDescription>あなたの予約状況</CardDescription>
            </CardHeader>
            <CardContent>
              {bookings.length > 0 ? (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">{booking.date}</p>
                        <span className={`px-2 py-1 rounded text-xs ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status === 'confirmed' ? '確定' :
                           booking.status === 'pending' ? '保留中' : 'キャンセル済み'}
                        </span>
                      </div>
                      <p>時間: {booking.startTime} - {booking.endTime}</p>
                      <p>講師: {booking.tutorName || "情報なし"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">予約はありません</p>
              )}
              
              <div className="mt-6">
                <Button>新規予約を作成</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>チケット情報</CardTitle>
              <CardDescription>利用可能なチケット</CardDescription>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="border rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">チケット数: {ticket.quantity}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {ticket.description && (
                        <p className="text-sm text-gray-600">{ticket.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">チケットはありません</p>
              )}
              
              <div className="mt-6">
                <Button>チケットを購入</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
