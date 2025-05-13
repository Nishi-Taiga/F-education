"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// Supabase用の定数
const USERS_TABLE = 'users';
const BOOKINGS_TABLE = 'bookings';
const TICKETS_TABLE = 'student_tickets';

// ユーザー情報の型
type UserDetails = {
  id: string;
  auth_user_id: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  email: string;
  profile_completed?: boolean;
};

// 予約情報の型
type Booking = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  tutor_name?: string;
};

// チケット情報の型
type Ticket = {
  id: number;
  quantity: number;
  description?: string;
  created_at: string;
};

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // セッションとユーザー情報の取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          console.log("No session found, redirecting to home");
          router.push('/');
          return;
        }
        
        console.log("Session found, user email:", session.user.email);
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from(USERS_TABLE)
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          
          if (userError.code === 'PGRST116') {
            // ユーザーが存在しない場合、プロフィール設定に誘導
            console.log("User not found, redirecting to profile setup");
            setIsRedirecting(true);
            router.push('/profile-setup');
            return;
          }
          
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        console.log("User data:", userData);
        
        // プロフィール未設定の場合、設定ページへリダイレクト
        if (!userData.first_name || !userData.last_name || !userData.profile_completed) {
          console.log("Profile not completed, redirecting to profile setup");
          setIsRedirecting(true);
          router.push('/profile-setup');
          return;
        }
        
        setUser(userData);
        
        // 予約情報の取得
        const { data: bookingsData, error: bookingsError } = await supabase
          .from(BOOKINGS_TABLE)
          .select('*')
          .eq('student_id', userData.id)
          .order('date', { ascending: true });
          
        if (!bookingsError && bookingsData) {
          console.log("Bookings loaded:", bookingsData.length);
          setBookings(bookingsData);
        } else if (bookingsError) {
          console.error("予約取得エラー:", bookingsError);
        }
        
        // チケット情報の取得
        const { data: ticketsData, error: ticketsError } = await supabase
          .from(TICKETS_TABLE)
          .select('*')
          .eq('student_id', userData.id)
          .order('created_at', { ascending: false });
          
        if (!ticketsError && ticketsData) {
          console.log("Tickets loaded:", ticketsData.length);
          setTickets(ticketsData);
        } else if (ticketsError) {
          console.error("チケット取得エラー:", ticketsError);
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
    
    if (!isRedirecting) {
      fetchUserData();
    }
  }, [router, toast, isRedirecting]);
  
  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };
  
  // 今日の日付
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // 今後の予約を取得
  const upcomingBookings = bookings.filter(booking => booking.date >= todayStr);
  
  // 合計チケット数
  const totalTickets = tickets.reduce((total, ticket) => total + ticket.quantity, 0);
  
  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-600 font-semibold mb-4">
          {isRedirecting ? "プロフィール設定ページに移動中..." : "読み込み中..."}
        </div>
        <div className="text-sm text-gray-500">
          {isRedirecting ? "ユーザー情報の設定が必要です" : "ユーザー情報を取得しています"}
        </div>
      </div>
    );
  }

  // ユーザー情報がない場合
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-red-600 font-semibold mb-4">ユーザー情報が見つかりません</div>
        <p className="text-gray-700 mb-6">ログインし直すか、プロフィール設定を完了してください</p>
        <div className="flex space-x-4">
          <Button onClick={() => router.push('/')}>
            ホームに戻る
          </Button>
          <Button onClick={() => router.push('/profile-setup')} variant="outline">
            プロフィール設定へ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ダッシュボード</h1>
          <p className="text-gray-500">
            こんにちは、{user?.last_name} {user?.first_name}さん
          </p>
        </div>
        
        <div className="flex space-x-2 mt-4 md:mt-0">
          <Button onClick={handleLogout} variant="outline">ログアウト</Button>
          <Button onClick={() => router.push('/settings')}>設定</Button>
        </div>
      </div>
      
      {/* ナビゲーションカード */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>メニュー</CardTitle>
          <CardDescription>メイン機能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/booking" className="w-full">
              <Button className="w-full" variant="outline">
                授業予約
              </Button>
            </Link>
            
            <Link href="/tickets" className="w-full">
              <Button className="w-full" variant="outline">
                チケット購入
              </Button>
            </Link>
            
            <Link href="/reports" className="w-full">
              <Button className="w-full" variant="outline">
                レポート一覧
              </Button>
            </Link>
            
            <Link href="/settings" className="w-full">
              <Button className="w-full" variant="outline">
                アカウント設定
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
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
                <p>{user.first_name && user.last_name 
                  ? `${user.last_name} ${user.first_name}` 
                  : "未設定"}</p>
              </div>
              <div>
                <p className="font-medium">役割:</p>
                <p>{user.role === 'parent' ? '保護者' : 
                   user.role === 'student' ? '生徒' : 
                   user.role === 'tutor' ? '講師' : '不明'}</p>
              </div>
              <div>
                <p className="font-medium">チケット残数:</p>
                <p>{totalTickets} 枚</p>
              </div>
              <div className="md:col-span-2 mt-2">
                <Button onClick={() => router.push('/profile-setup')}>
                  プロフィール編集
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
              <CardTitle>今後の予約</CardTitle>
              <CardDescription>
                {upcomingBookings.length > 0 
                  ? `${upcomingBookings.length}件の予約があります` 
                  : "予約はありません"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingBookings.map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">
                          {booking.date && format(new Date(booking.date), 'yyyy/MM/dd (EEE)', { locale: ja })}
                        </p>
                        <span className={`px-2 py-1 rounded text-xs ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status === 'confirmed' ? '確定' :
                           booking.status === 'pending' ? '保留中' : 'キャンセル済み'}
                        </span>
                      </div>
                      <p>時間: {booking.start_time} - {booking.end_time}</p>
                      <p>講師: {booking.tutor_name || "情報なし"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">予約がありません</p>
                  <Link href="/booking">
                    <Button>新規予約を作成</Button>
                  </Link>
                </div>
              )}
              
              <div className="mt-6">
                <Link href="/booking">
                  <Button>予約画面へ</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>チケット情報</CardTitle>
              <CardDescription>利用可能なチケット: {totalTickets}枚</CardDescription>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="border rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">チケット数: {ticket.quantity}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {ticket.description && (
                        <p className="text-sm text-gray-600">{ticket.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">チケットがありません</p>
                  <Link href="/tickets">
                    <Button>チケットを購入</Button>
                  </Link>
                </div>
              )}
              
              <div className="mt-6">
                <Link href="/tickets">
                  <Button>チケット購入</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}