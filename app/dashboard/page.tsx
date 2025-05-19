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
  const [error, setError] = useState<string | null>(null);

  // 生徒と利用可能チケットを取得する関数（コード重複を減らすため）
  const fetchStudentsAndTickets = async (parentId: number) => {
    let students: Student[] = [];
    let tickets = 0;
    
    // 保護者の場合、生徒データを取得
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', parentId);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
    } else if (studentsData && studentsData.length > 0) {
      students = studentsData;
      setStudents(studentsData);
    }

    // チケット残数取得
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('student_tickets')
      .select('quantity')
      .eq('parent_id', parentId)
      .maybeSingle();

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
    } else if (ticketsData) {
      tickets = ticketsData.quantity || 0;
      setAvailableTickets(tickets);
    }
    
    return { students, tickets };
  };

  // ユーザープロフィールを取得
  useEffect(() => {
    const fetchUserData = async () => {
      console.log("Fetching user data...");
      setLoading(true);
      setError(null);
      
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
        
        // ユーザーメールアドレスとIDを取得
        const userEmail = session.user.email;
        const userId = session.user.id;
        
        // ログ出力レベルを増やす
        console.log("Fetching profiles for:", userEmail, userId);
        
        // 初期は役割が不明なので、全てのプロファイルテーブルを確認
        let foundProfile = false;
        let role = '';
        let localTutorProfile = null;
        let localParentProfile = null;
        let localStudents: Student[] = [];
        
        // 1. 講師プロファイルをメールアドレスで確認
        console.log("Checking tutor profile with email:", userEmail);
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();
          
        if (tutorError) {
          console.error("Error fetching tutor profile by email:", tutorError);
          
          // メールで検索できない場合はIDで再試行（既存レコード互換性のため）
          console.log("Retrying with user_id:", userId);
          const { data: tutorDataById, error: tutorErrorById } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
            
          if (tutorErrorById) {
            console.error("Error fetching tutor profile by ID:", tutorErrorById);
          } else if (tutorDataById) {
            console.log("Found tutor profile by ID:", tutorDataById);
            foundProfile = true;
            role = 'tutor';
            
            localTutorProfile = {
              id: tutorDataById.id,
              user_id: tutorDataById.user_id,
              first_name: tutorDataById.first_name,
              last_name: tutorDataById.last_name,
              bio: tutorDataById.bio,
              subjects: tutorDataById.subjects,
              university: tutorDataById.university,
            };
          }
        } else if (tutorData) {
          console.log("Found tutor profile by email:", tutorData);
          foundProfile = true;
          role = 'tutor';
          
          localTutorProfile = {
            id: tutorData.id,
            user_id: tutorData.user_id,
            first_name: tutorData.first_name,
            last_name: tutorData.last_name,
            bio: tutorData.bio,
            subjects: tutorData.subjects,
            university: tutorData.university,
          };
        }
        
        // 2. 保護者プロファイルを確認
        if (!foundProfile) {
          const { data: parentData, error: parentError } = await supabase
            .from('parent_profile')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();
            
          if (parentError) {
            console.error("Error fetching parent profile by email:", parentError);
            
            // メールで検索できない場合はIDで再試行
            const { data: parentDataById, error: parentErrorById } = await supabase
              .from('parent_profile')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();
              
            if (parentErrorById) {
              console.error("Error fetching parent profile by ID:", parentErrorById);
            } else if (parentDataById) {
              console.log("Found parent profile by ID:", parentDataById);
              foundProfile = true;
              role = 'parent';
              
              localParentProfile = {
                id: parentDataById.id,
                user_id: parentDataById.user_id,
                parent_name: parentDataById.parent_name,
                phone: parentDataById.phone,
                postal_code: parentDataById.postal_code,
                prefecture: parentDataById.prefecture,
                city: parentDataById.city,
                address: parentDataById.address,
              };
              
              // 保護者の場合、生徒データも取得
              const studentsResult = await fetchStudentsAndTickets(parentDataById.id);
              localStudents = studentsResult.students;
            }
          } else if (parentData) {
            console.log("Found parent profile by email:", parentData);
            foundProfile = true;
            role = 'parent';
            
            localParentProfile = {
              id: parentData.id,
              user_id: parentData.user_id,
              parent_name: parentData.parent_name,
              phone: parentData.phone,
              postal_code: parentData.postal_code,
              prefecture: parentData.prefecture,
              city: parentData.city,
              address: parentData.address,
            };
            
            // 保護者の場合、生徒データも取得
            const studentsResult = await fetchStudentsAndTickets(parentData.id);
            localStudents = studentsResult.students;
          }
        }
        
        // 3. 生徒プロファイルを確認
        if (!foundProfile) {
          const { data: studentData, error: studentError } = await supabase
            .from('student_profile')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();
            
          if (studentError) {
            console.error("Error fetching student profile by email:", studentError);
            
            // メールで検索できない場合はIDで再試行
            const { data: studentDataById, error: studentErrorById } = await supabase
              .from('student_profile')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();
              
            if (studentErrorById) {
              console.error("Error fetching student profile by ID:", studentErrorById);
            } else if (studentDataById) {
              console.log("Found student profile by ID:", studentDataById);
              foundProfile = true;
              role = 'student';
              
              // 生徒情報をセット
              localStudents = [{
                id: studentDataById.id,
                first_name: studentDataById.first_name,
                last_name: studentDataById.last_name,
                user_id: studentDataById.user_id,
                grade: studentDataById.grade,
                school: studentDataById.school,
              }];
            }
          } else if (studentData) {
            console.log("Found student profile by email:", studentData);
            foundProfile = true;
            role = 'student';
            
            // 生徒情報をセット
            localStudents = [{
              id: studentData.id,
              first_name: studentData.first_name,
              last_name: studentData.last_name,
              user_id: studentData.user_id,
              grade: studentData.grade,
              school: studentData.school,
            }];
          }
        }
        
        // プロファイルが見つからない場合
        if (!foundProfile) {
          console.log("No profile found for user, redirecting to profile setup");
          console.log("User Email:", userEmail, "User ID:", userId);
          
          // Supabaseのテーブル内容を直接ログに出力（開発環境のみ）
          if (process.env.NODE_ENV !== 'production') {
            const { data: allTutorProfiles, error: listError } = await supabase
              .from('tutor_profile')
              .select('id, user_id, email')
              .limit(10);
              
            console.log("Sample tutor profiles:", allTutorProfiles, listError);
          }
          
          toast({
            title: "プロフィール未設定",
            description: "プロフィール情報を設定してください",
            variant: "default",
          });
          
          router.push('/profile-setup');
          return;
        }
        
        console.log(`Setting user profile with role: ${role}`);
        
        // ローカル変数に保存した値を状態変数に設定
        if (localTutorProfile) {
          console.log("Setting tutorProfile state:", localTutorProfile);
          setTutorProfile(localTutorProfile);
        }
        if (localParentProfile) {
          console.log("Setting parentProfile state:", localParentProfile);
          setParentProfile(localParentProfile);
        }
        if (localStudents.length > 0) {
          console.log("Setting students state:", localStudents);
          setStudents(localStudents);
        }
        
        // ユーザープロファイル情報を設定
        // ロールに応じた情報を設定
        let profileToSet: UserProfile | null = null;
        
        if (role === 'tutor' && localTutorProfile) {
          console.log("Creating user profile from tutor profile:", localTutorProfile);
          profileToSet = {
            id: localTutorProfile.id,
            display_name: `${localTutorProfile.last_name} ${localTutorProfile.first_name}`,
            role: 'tutor',
            email: session.user.email || '',
            profile_completed: true,
          };
        } else if (role === 'parent' && localParentProfile) {
          console.log("Creating user profile from parent profile:", localParentProfile);
          profileToSet = {
            id: localParentProfile.id,
            display_name: localParentProfile.parent_name,
            role: 'parent',
            email: session.user.email || '',
            profile_completed: true,
          };
        } else if (role === 'student' && localStudents.length > 0) {
          console.log("Creating user profile from student profile:", localStudents[0]);
          const student = localStudents[0];
          profileToSet = {
            id: student.id,
            display_name: `${student.last_name} ${student.first_name}`,
            role: 'student',
            email: session.user.email || '',
            profile_completed: true,
          };
        }
        
        console.log("Final profile to set:", profileToSet);
        
        if (profileToSet) {
          setUserProfile(profileToSet);
        } else {
          console.error("Could not create user profile from found profiles.");
          setError("プロフィール情報の処理中にエラーが発生しました。");
        }
        
      } catch (error: any) {
        console.error('Failed to fetch user data:', error);
        setError(error.message || "ユーザー情報の取得中にエラーが発生しました");
        
        toast({
          title: "データ取得エラー",
          description: error.message || "ユーザー情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
        
        // エラーが発生した場合でも、プロフィールが設定されていないとみなしてリダイレクト
        router.push('/profile-setup');
      } finally {
        setTimeout(() => {
          console.log("Final states after fetch:");
          console.log("userProfile:", userProfile);
          console.log("tutorProfile:", tutorProfile);
          console.log("parentProfile:", parentProfile);
          console.log("students:", students);
          
          setLoading(false);
        }, 500); // データの設定が完了するまで少し遅延
      }
    };

    fetchUserData();
  }, []);  // 依存配列を空にして初回レンダリング時のみ実行

  // useEffectのタイミングの問題を解決するため、データが揃ったか確認する
  useEffect(() => {
    if (!loading && tutorProfile && !userProfile) {
      console.log("Manual profile creation from tutorProfile after loading:", tutorProfile);
      setUserProfile({
        id: tutorProfile.id,
        display_name: `${tutorProfile.last_name} ${tutorProfile.first_name}`,
        role: 'tutor',
        email: '',  // セッションからemailを取得できないため空にする
        profile_completed: true,
      });
    }
  }, [loading, tutorProfile, userProfile]);

  // Loading状態の表示
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">読み込み中...</span>
      </div>
    );
  }

  // エラーの表示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <div className="flex space-x-4">
          <button 
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
            onClick={() => router.reload()}
          >
            再読み込み
          </button>
          <button 
            className="px-4 py-2 bg-primary text-white rounded-md"
            onClick={() => router.push('/profile-setup')}
          >
            プロフィール設定へ
          </button>
        </div>
      </div>
    );
  }

  // ここでは直接tutorProfileを確認して表示を切り替え
  if (tutorProfile && !userProfile) {
    console.log("Found tutorProfile but userProfile is not set - creating on-the-fly");
    // userProfileが設定されていないが、tutorProfileがある場合は強制的にダッシュボードを表示
    return (
      <Dashboard
        userProfile={{
          id: tutorProfile.id,
          display_name: `${tutorProfile.last_name} ${tutorProfile.first_name}`,
          role: 'tutor',
          email: '',
          profile_completed: true,
        }}
        students={students}
        tutorProfile={tutorProfile}
        parentProfile={parentProfile}
        availableTickets={availableTickets}
      />
    );
  }

  // 通常のプロフィール未設定エラー表示
  if (!userProfile && !tutorProfile && !parentProfile && students.length === 0) {
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

  // 標準の表示
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