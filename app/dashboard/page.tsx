"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase/client";
import { Dashboard } from "@/components/dashboard";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ユーザー情報の型
type UserProfile = {
  id: number;
  display_name?: string;
  username?: string;
  role?: 'parent' | 'tutor' | 'student' | 'admin';
  email: string;
  profile_completed?: boolean;
};

// 生徒情報の型
type Student = {
  id: number;
  first_name: string;
  last_name: string;
  user_id: number;
  grade?: string;
  school?: string;
};

// 講師プロファイルの型
type TutorProfile = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  bio?: string;
  subjects?: string;
  university?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refetch } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [availableTickets, setAvailableTickets] = useState(0);

  // ユーザープロフィールを取得
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      
      try {
        // セッションチェック
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No active session found in dashboard");
          router.push('/auth');
          return;
        }
        
        console.log("Dashboard: session found for email:", session.user.email);
        
        // ユーザー情報を取得 (users テーブル)
        const { data: usersList, error: usersError } = await supabase
          .from('users')
          .select('*');
          
        if (usersError) {
          console.error("Error fetching users list:", usersError);
          throw new Error("ユーザー情報の取得に失敗しました");
        }
        
        // メールアドレスが一致するユーザーを検索
        const userData = usersList?.find(user => 
          user.email?.toLowerCase() === session.user.email.toLowerCase() || 
          user.username?.toLowerCase() === session.user.email.toLowerCase()
        );
        
        // ユーザーがデータベースに存在しない場合
        if (!userData) {
          console.log("User not in database, redirecting to profile setup");
          router.push('/profile-setup');
          return;
        }
        
        console.log("User found in database:", userData);

        // ユーザープロファイル設定
        setUserProfile({
          id: userData.id,
          display_name: userData.display_name,
          username: userData.username,
          role: userData.role,
          email: userData.email || session.user.email || '',
          profile_completed: userData.profile_completed,
        });

        // ユーザーロールに応じたデータ取得
        if (userData.role === 'parent') {
          // 生徒データ取得
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', userData.id);

          if (studentsError) {
            console.error('Error fetching students:', studentsError);
          } else if (studentsData) {
            setStudents(studentsData);
          }

          // チケット残数取得
          const { data: ticketsData, error: ticketsError } = await supabase
            .from('student_tickets')
            .select('quantity')
            .eq('user_id', userData.id)
            .maybeSingle();

          if (ticketsError) {
            console.error('Error fetching tickets:', ticketsError);
          } else if (ticketsData) {
            setAvailableTickets(ticketsData.quantity || 0);
          }
        } else if (userData.role === 'tutor') {
          // 講師プロフィール取得
          const { data: tutorData, error: tutorError } = await supabase
            .from('tutors')
            .select('*')
            .eq('user_id', userData.id)
            .maybeSingle();

          if (tutorError) {
            console.error('Error fetching tutor profile:', tutorError);
          } else if (tutorData) {
            setTutorProfile({
              id: tutorData.id,
              user_id: tutorData.user_id,
              first_name: tutorData.first_name,
              last_name: tutorData.last_name,
              bio: tutorData.bio,
              subjects: tutorData.subjects,
              university: tutorData.university,
            });
          }
        }
      } catch (error: any) {
        console.error('Failed to fetch user data:', error);
        toast({
          title: "データ取得エラー",
          description: error.message || "ユーザー情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [supabase, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">読み込み中...</span>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">認証エラー</h1>
        <p className="text-muted-foreground">ログインする必要があります</p>
        <button 
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
          onClick={() => router.push('/auth')}
        >
          ログイン画面へ
        </button>
      </div>
    );
  }

  return (
    <Dashboard
      userProfile={userProfile}
      students={students}
      tutorProfile={tutorProfile}
      availableTickets={availableTickets}
    />
  );
}