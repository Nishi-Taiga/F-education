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
  user_id: string; // UUIDのため文字列型
  grade?: string;
  school?: string;
};

// 講師プロファイルの型
type TutorProfile = {
  id: number;
  user_id: string; // UUIDのため文字列型
  first_name: string;
  last_name: string;
  bio?: string;
  subjects?: string;
  university?: string;
};

// 保護者プロファイルの型
type ParentProfile = {
  id: number;
  user_id: string; // UUIDのため文字列型
  parent_name: string;
  phone?: string;
  postal_code?: string;
  prefecture?: string;
  city?: string;
  address?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refetch } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
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
        console.log("Dashboard: session user ID:", session.user.id);
        
        // ユーザーIDを取得
        const userId = session.user.id;
        
        // 初期は役割が不明なので、全てのプロファイルテーブルを確認
        let foundProfile = false;
        let role = '';
        
        // 1. 講師プロファイルを確認
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (tutorError) {
          console.error("Error fetching tutor profile:", tutorError);
        } else if (tutorData) {
          console.log("Found tutor profile:", tutorData);
          foundProfile = true;
          role = 'tutor';
          
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
        
        // 2. 保護者プロファイルを確認
        if (!foundProfile) {
          const { data: parentData, error: parentError } = await supabase
            .from('parent_profile')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
            
          if (parentError) {
            console.error("Error fetching parent profile:", parentError);
          } else if (parentData) {
            console.log("Found parent profile:", parentData);
            foundProfile = true;
            role = 'parent';
            
            setParentProfile({
              id: parentData.id,
              user_id: parentData.user_id,
              parent_name: parentData.parent_name,
              phone: parentData.phone,
              postal_code: parentData.postal_code,
              prefecture: parentData.prefecture,
              city: parentData.city,
              address: parentData.address,
            });
            
            // 保護者の場合、生徒データも取得
            const { data: studentsData, error: studentsError } = await supabase
              .from('students')
              .select('*')
              .eq('parent_id', parentData.id);

            if (studentsError) {
              console.error('Error fetching students:', studentsError);
            } else if (studentsData && studentsData.length > 0) {
              setStudents(studentsData);
            }

            // チケット残数取得
            const { data: ticketsData, error: ticketsError } = await supabase
              .from('student_tickets')
              .select('quantity')
              .eq('parent_id', parentData.id)
              .maybeSingle();

            if (ticketsError) {
              console.error('Error fetching tickets:', ticketsError);
            } else if (ticketsData) {
              setAvailableTickets(ticketsData.quantity || 0);
            }
          }
        }
        
        // 3. 生徒プロファイルを確認
        if (!foundProfile) {
          const { data: studentData, error: studentError } = await supabase
            .from('student_profile')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
            
          if (studentError) {
            console.error("Error fetching student profile:", studentError);
          } else if (studentData) {
            console.log("Found student profile:", studentData);
            foundProfile = true;
            role = 'student';
            
            // 生徒情報をセット
            setStudents([{
              id: studentData.id,
              first_name: studentData.first_name,
              last_name: studentData.last_name,
              user_id: studentData.user_id,
              grade: studentData.grade,
              school: studentData.school,
            }]);
          }
        }
        
        // プロファイルが見つからない場合
        if (!foundProfile) {
          console.log("No profile found for user, redirecting to profile setup");
          toast({
            title: "プロフィール未設定",
            description: "プロフィール情報を設定してください",
            variant: "default",
          });
          router.push('/profile-setup');
          return;
        }
        
        // ユーザープロファイル情報を設定
        // ロールに応じた情報を設定
        if (role === 'tutor' && tutorProfile) {
          setUserProfile({
            id: tutorProfile.id,
            display_name: `${tutorProfile.last_name} ${tutorProfile.first_name}`,
            role: 'tutor',
            email: session.user.email || '',
            profile_completed: true,
          });
        } else if (role === 'parent' && parentProfile) {
          setUserProfile({
            id: parentProfile.id,
            display_name: parentProfile.parent_name,
            role: 'parent',
            email: session.user.email || '',
            profile_completed: true,
          });
        } else if (role === 'student' && students.length > 0) {
          const student = students[0];
          setUserProfile({
            id: student.id,
            display_name: `${student.last_name} ${student.first_name}`,
            role: 'student',
            email: session.user.email || '',
            profile_completed: true,
          });
        }
        
      } catch (error: any) {
        console.error('Failed to fetch user data:', error);
        toast({
          title: "データ取得エラー",
          description: error.message || "ユーザー情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
        
        // エラーが発生した場合でも、プロフィールが設定されていないとみなしてリダイレクト
        router.push('/profile-setup');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [supabase, router, toast, refetch]);

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
        <h1 className="text-2xl font-bold mb-4">プロフィールが見つかりません</h1>
        <p className="text-muted-foreground mb-4">サービスを利用するには、プロフィール情報の設定が必要です</p>
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md"
          onClick={() => router.push('/profile-setup')}
        >
          プロフィール設定へ
        </button>
      </div>
    );
  }

  return (
    <Dashboard
      userProfile={userProfile}
      students={students}
      tutorProfile={tutorProfile}
      parentProfile={parentProfile}
      availableTickets={availableTickets}
    />
  );
}