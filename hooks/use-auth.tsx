"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";

// ユーザータイプの定義
type UserRole = 'parent' | 'tutor' | 'student';

// ユーザー情報の型
type User = {
  id: number; 
  auth_id?: string;  // Supabaseの認証IDを格納
  displayName?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  email: string;
  profileCompleted?: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<{ email: string }, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<{ email: string }, Error, RegisterData>;
  refetch: () => Promise<any>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user/me"],
    queryFn: async () => {
      try {
        // Supabaseのセッションを確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log("No active session found");
          return null;
        }
        const userId = session.user.id;
        const userEmail = session.user.email;

        // 1. 講師プロファイル
        const { data: tutor, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (tutorError) {
          console.error("Error fetching tutor_profile:", tutorError);
        }
        if (tutor) {
          return {
            id: tutor.id,
            auth_id: userId,
            displayName: `${tutor.last_name} ${tutor.first_name}`,
            username: tutor.email || userEmail,
            firstName: tutor.first_name,
            lastName: tutor.last_name,
            role: 'tutor',
            email: tutor.email || userEmail,
            profileCompleted: tutor.profile_completed
          };
        }

        // 2. 保護者プロファイル
        const { data: parent, error: parentError } = await supabase
          .from('parent_profile')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (parentError) {
          console.error("Error fetching parent_profile:", parentError);
        }
        if (parent) {
          return {
            id: parent.id,
            auth_id: userId,
            displayName: parent.name,
            username: parent.email || userEmail,
            firstName: undefined,
            lastName: undefined,
            role: 'parent',
            email: parent.email || userEmail,
            profileCompleted: true // parent_profileにprofile_completedがなければtrue固定
          };
        }

        // 3. 生徒プロファイル
        const { data: student, error: studentError } = await supabase
          .from('student_profile')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (studentError) {
          console.error("Error fetching student_profile:", studentError);
        }
        if (student) {
          return {
            id: student.id,
            auth_id: userId,
            displayName: `${student.last_name} ${student.first_name}`,
            username: student.email || userEmail,
            firstName: student.first_name,
            lastName: student.last_name,
            role: 'student',
            email: student.email || userEmail,
            profileCompleted: true // student_profileにprofile_completedがなければtrue固定
          };
        }

        // どれにも該当しなければnull
        return null;
      } catch (error) {
        console.error("Error in user query:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
  }, [user]);

  // ログイン処理 - 認証チェックのみ
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login for email:", credentials.email);
      
      // Supabaseで認証のみを実行
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      
      if (error) {
        console.error("Login authentication error:", error);
        throw new Error(error.message);
      }
      
      if (!data.user) {
        console.error("No user returned from authentication");
        throw new Error("認証情報の取得に失敗しました");
      }
      
      console.log("Successful login with Supabase auth, user id:", data.user.id);
      
      // セッション情報を更新
      await refetch();
      
      // 認証情報のみを返す - データベース情報は後で取得
      return {
        email: credentials.email,
      };
    },
    onSuccess: ({ email }) => {
      toast({
        title: "ログイン成功",
        description: `ログインしました`,
      });
      
      // ダッシュボードに遷移 - データベース情報はダッシュボード表示時に取得される
      router.push('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: "ログインに失敗しました",
        description: error.message || "メールアドレスまたはパスワードが正しくありません",
        variant: "destructive",
      });
    },
  });

  // 登録処理 - 認証のみに簡略化
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      console.log("Starting registration process for email:", data.email);
      
      // Supabaseで認証アカウントを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            email: data.email,
            // 最低限の情報のみを保存
          }
        }
      });
      
      if (authError) {
        console.error("Auth signup error:", authError);
        throw new Error(authError.message);
      }
      
      // 認証成功のログ
      console.log("Auth signup successful. User ID:", authData.user?.id);
      
      if (!authData.user) {
        throw new Error("認証は成功しましたが、ユーザー情報が取得できませんでした");
      }
      
      // usersテーブルに基本情報を登録
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{
          auth_id: authData.user.id,
          email: data.email,
          username: data.email,
          role: 'parent',  // デフォルトロール
          profile_completed: false
        }])
        .select();
        
      if (userError) {
        console.error("Error creating user record:", userError);
        // 登録は成功しているのでエラーはスローしない
      } else {
        console.log("Created user record:", userData);
      }
      
      // 認証が成功した場合、メールアドレスのみを返す
      return {
        email: data.email,
      };
    },
    onSuccess: ({ email }) => {
      toast({
        title: "アカウント作成完了",
        description: "メールアドレスの確認メールをお送りしました。メール内のリンクをクリックして認証を完了してください。",
      });
      // メール確認を待つので、ここではページ遷移しない
    },
    onError: (error: Error) => {
      console.error("Registration mutation error:", error);
      toast({
        title: "アカウント作成に失敗しました",
        description: error.message || "このメールアドレスは既に使用されています",
        variant: "destructive",
      });
    },
  });

  // ログアウト処理
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      setCurrentUser(null);
      refetch();
      toast({
        title: "ログアウト完了",
        description: "ログアウトしました。またのご利用をお待ちしております。",
      });
      router.push('/');
    },
    onError: (error: Error) => {
      toast({
        title: "ログアウトに失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        refetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}