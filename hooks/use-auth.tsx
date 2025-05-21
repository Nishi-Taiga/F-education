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
  
  // ユーザー情報の取得 - この関数は認証情報のみを確認し、必要時に実行される
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
        
        console.log("Session found, user email:", session.user.email);
        console.log("Session user ID:", session.user.id);
        
        // まずはusersテーブルからauth_idをチェック
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .maybeSingle();
          
        if (userError) {
          console.error("Error fetching user by auth_id:", userError);
        }
        
        if (userData) {
          console.log("Found user by auth_id:", userData);
          return {
            id: userData.id,
            auth_id: session.user.id,
            displayName: userData.display_name || '',
            username: userData.username || session.user.email,
            role: userData.role,
            email: userData.email || session.user.email,
            profileCompleted: userData.profile_completed
          };
        }
        
        // auth_idでマッチするデータがない場合は、メールアドレスで検索
        const { data: userDataByEmail, error: userErrorByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (userErrorByEmail) {
          console.error("Error fetching user by email:", userErrorByEmail);
        }
        
        if (userDataByEmail) {
          console.log("Found user by email:", userDataByEmail);
          
          // auth_idを更新
          const { error: updateError } = await supabase
            .from('users')
            .update({ auth_id: session.user.id })
            .eq('id', userDataByEmail.id);
            
          if (updateError) {
            console.error("Error updating auth_id:", updateError);
          }
          
          return {
            id: userDataByEmail.id,
            auth_id: session.user.id,
            displayName: userDataByEmail.display_name || '',
            username: userDataByEmail.username || session.user.email,
            role: userDataByEmail.role,
            email: userDataByEmail.email || session.user.email,
            profileCompleted: userDataByEmail.profile_completed
          };
        }
        
        // ユーザーが存在しない場合は基本情報のみでユーザーエントリを作成
        console.log("Creating new user entry for:", session.user.email);
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            auth_id: session.user.id,
            email: session.user.email,
            username: session.user.email,
            role: 'parent',  // デフォルトロール
            profile_completed: false
          }])
          .select();
          
        if (insertError) {
          console.error("Error creating new user:", insertError);
          return {
            id: 0,
            auth_id: session.user.id,
            displayName: '',
            username: session.user.email,
            firstName: '',
            lastName: '',
            role: 'parent', // デフォルト値
            email: session.user.email,
            profileCompleted: false
          };
        }
        
        if (newUser && newUser.length > 0) {
          return {
            id: newUser[0].id,
            auth_id: session.user.id,
            displayName: '',
            username: session.user.email,
            role: 'parent',
            email: session.user.email,
            profileCompleted: false
          };
        }
        
        // 最終的に何かしらのユーザー情報を返す
        return {
          id: 0,
          auth_id: session.user.id,
          displayName: '',
          username: session.user.email,
          firstName: '',
          lastName: '',
          role: 'parent', // デフォルト値
          email: session.user.email,
          profileCompleted: false
        };
      } catch (error) {
        console.error("Error in user query:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    enabled: false, // 初回は自動実行しない
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