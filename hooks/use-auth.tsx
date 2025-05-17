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
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
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
  
  // ユーザー情報の取得
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
        
        // セッションがあれば、ユーザー情報を取得
        // まず全てのユーザーを取得して、コンソールに出力（デバッグ用）
        const { data: allUsers } = await supabase
          .from('users')
          .select('id, email, username')
          .limit(10);
          
        console.log("Available users:", allUsers);
        
        // email値を使って既存のユーザーデータを検索
        // まずは単純に一覧で取得して、クライアント側でフィルタリング
        const { data: usersList, error: usersError } = await supabase
          .from('users')
          .select('*');
          
        if (usersError) {
          console.error("Error fetching users list:", usersError);
          return null;
        }
        
        // メールアドレスが一致するユーザーを検索
        const userData = usersList?.find(user => 
          user.email?.toLowerCase() === session.user.email.toLowerCase() || 
          user.username?.toLowerCase() === session.user.email.toLowerCase()
        );
        
        if (!userData) {
          console.error("User not found for email:", session.user.email);
          return null;
        }
        
        console.log("Found user:", userData);
        
        // フロントエンド用のユーザーオブジェクト形式に変換
        return {
          id: userData.id,
          auth_id: session.user.id, // SupabaseのAuth UIを格納
          displayName: userData.display_name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim(),
          username: userData.username,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          email: userData.email || session.user.email,
          profileCompleted: userData.profile_completed
        };
      } catch (error) {
        console.error("Error in user query:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
  }, [user]);

  // ログイン処理
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // まずSupabaseで認証
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      
      if (error) throw new Error(error.message);
      
      console.log("Successful login with Supabase auth, email:", credentials.email);
      
      // ユーザー情報を取得
      // まずは単純に一覧で取得して、クライアント側でフィルタリング
      const { data: usersList, error: usersError } = await supabase
        .from('users')
        .select('*');
        
      if (usersError) {
        console.error("Error fetching users list:", usersError);
        throw new Error("ユーザー情報の取得に失敗しました");
      }
      
      // メールアドレスが一致するユーザーを検索
      const userData = usersList?.find(user => 
        user.email?.toLowerCase() === credentials.email.toLowerCase() || 
        user.username?.toLowerCase() === credentials.email.toLowerCase()
      );
      
      if (!userData) {
        console.error("User not found for email:", credentials.email);
        throw new Error("ユーザーが見つかりません");
      }
      
      console.log("Found user:", userData);
      
      // ユーザーオブジェクトの形式に変換して返す
      return {
        id: userData.id,
        auth_id: data.user.id,
        displayName: userData.display_name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim(),
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role,
        email: userData.email || credentials.email,
        profileCompleted: userData.profile_completed
      };
    },
    onSuccess: (user: User) => {
      setCurrentUser(user);
      toast({
        title: "ログイン成功",
        description: `こんにちは、${user.displayName || user.username || user.email}さん`,
      });
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

  // 登録処理
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      // Supabaseで認証アカウントを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            role: data.role || 'parent',
          }
        }
      });
      
      if (authError) throw new Error(authError.message);
      
      // データベースのユーザーテーブルに登録情報を作成
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([
          {
            username: data.email,
            email: data.email,
            first_name: data.firstName,
            last_name: data.lastName,
            role: data.role || 'parent',
            profile_completed: false,
            display_name: `${data.lastName || ''} ${data.firstName || ''}`.trim(),
            // 以下は古いスキーマとの互換性のためのダミーデータ
            password: 'supabase_auth_managed' // パスワード自体はSupabaseで管理
          }
        ])
        .select()
        .single();
        
      if (userError) throw new Error(userError.message);
      
      // ユーザーオブジェクトの形式に変換して返す
      return {
        id: userData.id,
        auth_id: authData.user?.id,
        displayName: userData.display_name,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role,
        email: userData.email,
        profileCompleted: userData.profile_completed
      };
    },
    onSuccess: (user: User) => {
      setCurrentUser(user);
      toast({
        title: "アカウント作成完了",
        description: "登録が完了しました。サービスをご利用いただけます。",
      });
      router.push('/profile-setup');
    },
    onError: (error: Error) => {
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