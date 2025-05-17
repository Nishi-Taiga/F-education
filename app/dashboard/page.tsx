"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";
import { Dashboard } from "@/components/dashboard";
import { Loader2 } from "lucide-react";

// ユーザー情報の型
type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  role?: 'parent' | 'tutor' | 'student' | 'admin';
  email: string;
};

// 生徒情報の型
type Student = {
  id: string;
  first_name: string;
  last_name: string;
  parent_id: string;
  grade?: string;
  school?: string;
};

// 講師プロファイルの型
type TutorProfile = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  bio?: string;
  subjects: string[];
  qualifications?: string[];
  hourly_rate?: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  
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
          router.push('/auth');
          return;
        }
        
        // ユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (userError || !userData) {
          console.error('Error fetching user profile:', userError);
          router.push('/profile-setup');
          return;
        }

        // ユーザープロファイル設定
        setUserProfile({
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          email: userData.email || session.user.email || '',
        });

        // ユーザーロールに応じたデータ取得
        if (userData.role === 'parent') {
          // 生徒データ取得
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('parent_id', userData.id);

          if (!studentsError && studentsData) {
            setStudents(studentsData);
          }

          // チケット残数取得
          const { data: ticketsData, error: ticketsError } = await supabase
            .from('student_tickets')
            .select('quantity')
            .eq('parent_id', userData.id)
            .single();

          if (!ticketsError && ticketsData) {
            setAvailableTickets(ticketsData.quantity || 0);
          }
        } else if (userData.role === 'tutor') {
          // 講師プロフィール取得
          const { data: tutorData, error: tutorError } = await supabase
            .from('tutor_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (!tutorError && tutorData) {
            setTutorProfile({
              id: tutorData.id,
              user_id: tutorData.user_id,
              first_name: tutorData.first_name,
              last_name: tutorData.last_name,
              bio: tutorData.bio,
              subjects: tutorData.subjects || [],
              qualifications: tutorData.qualifications,
              hourly_rate: tutorData.hourly_rate,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [supabase, router]);

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