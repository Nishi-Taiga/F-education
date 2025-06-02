"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";

// ユーザータイプの定義
export type UserRole = 'parent' | 'tutor' | 'student';

// ユーザー情報の型
export type User = {
  id: number; 
  auth_id: string;  // Supabaseの認証IDを格納
  displayName?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  email: string;
  profileCompleted: boolean;
};

// 認証されたユーザープロフィールの型定義
export type UserProfile = {
  id: number;
  auth_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  profile_completed?: boolean;
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
  // currentUser state は不要になるため削除またはコメントアウト
  // const [currentUser, setCurrentUser] = useState<User | null>(null);
  
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
          console.log("useAuth queryFn: No active session found");
          return null;
        }
        const userId = session.user.id;
        const userEmail = session.user.email;

        console.log("useAuth queryFn: Session found, fetching profile for user ID:", userId);

        // まずusersテーブルからユーザーのロールを取得する
        let userRole: UserRole | undefined;
        const { data: basicUserData, error: basicUserError } = await supabase
          .from('users')
          .select('role') // ロールのみを選択
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (basicUserError) {
          console.error("useAuth queryFn: Error fetching basic user data:", basicUserError);
          // エラーが発生した場合は、ロール不明として処理を続行
          userRole = undefined; // ロールを未定義とする
        } else {
           userRole = basicUserData?.role as UserRole | undefined;
           console.log("useAuth queryFn: Determined user role:", userRole);
        }


        let userProfile: User | null = null;

        // ロールに基づいてプロフィールを取得する順序を変更
        // usersテーブルからのロール取得に失敗した場合も、全てのプロフィールタイプを試行するフォールバックロジックを維持
        if (userRole === 'student') {
          // 1. 生徒プロファイル (生徒としてログインしている可能性が高い場合)
          const { data: student, error: studentError } = await supabase
            .from('student_profile')
            .select('*') // すべてのカラムを選択
            .eq('user_id', userId)
            .maybeSingle();

          if (!studentError && student) {
            userProfile = { ...student, role: 'student', auth_id: userId, email: userEmail };
            console.log("useAuth queryFn: Student profile found:", userProfile);
          } else {
            console.error("useAuth queryFn: Error fetching student_profile:", studentError);
          }
        }

        // ロールがstudentでない、またはstudentプロファイルが見つからなかった場合
        if (!userProfile) {
          // 2. 保護者プロファイル
          const { data: parent, error: parentError } = await supabase
            .from('parent_profile')
            .select('*') // すべてのカラムを選択
            .eq('user_id', userId)
            .maybeSingle();

          if (!parentError && parent) {
            userProfile = { ...parent, role: 'parent', auth_id: userId, email: userEmail };
            console.log("useAuth queryFn: Parent profile found (fallback):", userProfile);
          } else {
            console.error("useAuth queryFn: Error fetching parent_profile (fallback):", parentError);
          }
        }

        // 上記いずれでも見つからなかった場合
        if (!userProfile && userRole !== 'student') {
           // 3. 講師プロファイル (ロールがtutorの場合、またはロール不明の場合)
           const { data: tutor, error: tutorError } = await supabase
             .from('tutor_profile')
             .select('*') // すべてのカラムを選択
             .eq('user_id', userId)
             .maybeSingle();

            if (!tutorError && tutor) {
              userProfile = { ...tutor, role: 'tutor', auth_id: userId, email: userEmail };
              console.log("useAuth queryFn: Tutor profile found (fallback):", userProfile);
            } else {
              console.error("useAuth queryFn: Error fetching tutor_profile (fallback):", tutorError);
            }
        }

        if (!userProfile) {
          console.log("useAuth queryFn: Profile not found for determined role or role is unknown. Checking other profiles as fallback...");
           // ロールが不明または取得に失敗し、かつ上記の順序でプロフィールが見つからなかった場合、全てのプロフィールタイプを再確認

          // 生徒プロファイル再確認
          const { data: student, error: studentError } = await supabase
            .from('student_profile')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!studentError && student) {
            userProfile = { ...student, role: 'student', auth_id: userId, email: userEmail };
            console.log("useAuth queryFn: Student profile found (fallback):", userProfile);
          }

           // 保護者プロファイル再確認
          if (!userProfile) {
             const { data: parent, error: parentError } = await supabase
               .from('parent_profile')
               .select('*')
               .eq('user_id', userId)
               .maybeSingle();

             if (!parentError && parent) {
               userProfile = { ...parent, role: 'parent', auth_id: userId, email: userEmail };
               console.log("useAuth queryFn: Parent profile found (fallback):", userProfile);
             } else {
              console.error("useAuth queryFn: Error fetching parent_profile (fallback):", parentError);
            }
          }

           // 講師プロファイル再確認
          if (!userProfile) {
             const { data: tutor, error: tutorError } = await supabase
               .from('tutor_profile')
               .select('*')
               .eq('user_id', userId)
               .maybeSingle();

             if (!tutorError && tutor) {
               userProfile = { ...tutor, role: 'tutor', auth_id: userId, email: userEmail };
               console.log("useAuth queryFn: Tutor profile found (fallback):", userProfile);
             } else {
               console.error("useAuth queryFn: Error fetching tutor_profile (fallback):", tutorError);
             }
          }

        }


        if (userProfile) {
          console.log("useAuth queryFn: Final user profile:", userProfile);
          // プロファイル情報とauth_idを統合して返す
          return userProfile;
        } else {
          console.warn("useAuth queryFn: No profile found for user ID:", userId);
          return null; // プロファイルが見つからなかった場合
        }

      } catch (error) {
        console.error("useAuth queryFn: Unexpected error:", error);
        return null; // エラー時はnullを返す
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Supabase 認証状態の変更をリッスンし、クエリを再実行する Effect
  useEffect(() => {
    console.log("useAuth Effect: Setting up auth listener...");
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`useAuth AuthListener: event: ${event}`, { session });
      // 認証状態が変化したら（ログイン、ログアウト、初期セッションなど）、ユーザーデータを再取得
      // これにより、useQuery の cache が更新され、user の値が最新の状態になる
      refetch();

      // SIGNED_OUT イベントの場合、明示的にホームまたはログインページへリダイレクト
      // これにより、AuthContext を使用しているコンポーネントが null を受け取った際に即座に遷移できる
      if (event === 'SIGNED_OUT') {
        console.log("useAuth AuthListener: Signed out, redirecting.");
        // ダッシュボードページ以外からのログアウトでも機能するように、ここではシンプルにルートへリダイレクト
        // ダッシュボードページでは、useAuth の user が null になったことを検知して auth へリダイレクトするロジックがあるはず
        // router.push('/'); // または '/auth'
      }
      // その他のイベント発生時も refetch() で最新のセッションとユーザー情報を取得し、state を更新
    });

    // クリーンアップ関数
    return () => {
      console.log("useAuth Effect: Cleaning up auth listener.");
      authListener?.unsubscribe();
    };
  }, [refetch]);
  // 空の依存配列 [] は初回マウント時のみ実行される。
  // refetch を含めると、refetch が安定している限り初回マウント時と同様に振る舞う。

  // ログイン処理 - 認証チェックのみ
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("useAuth loginMutation: Attempting login for email:", credentials.email);
      
      // Supabaseで認証のみを実行
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      
      if (error) {
        console.error("useAuth loginMutation: Login authentication error:", error);
        throw new Error(error.message);
      }
      
      if (!data.user) {
        console.error("useAuth loginMutation: No user returned from authentication");
        throw new Error("認証情報の取得に失敗しました");
      }
      
      console.log("useAuth loginMutation: Successful login with Supabase auth, user id:", data.user.id);
      
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
      console.error("useAuth loginMutation: onError:", error);
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
      console.log("useAuth registerMutation: Starting registration process for email:", data.email);
      
      // Supabaseで認証アカウントを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            email: data.email,
            // 最低限の情報のみを保存
            role: data.role, // ここでロールを metadata に含める例
          }
        }
      });
      
      if (authError) {
        console.error("useAuth registerMutation: Auth signup error:", authError);
        throw new Error(authError.message);
      }
      
      // 認証成功のログ
      console.log("useAuth registerMutation: Auth signup successful. User ID:", authData.user?.id);
      
      if (!authData.user) {
        throw new Error("認証は成功しましたが、ユーザー情報が取得できませんでした");
      }
      
      // ユーザーのロールに応じてプロフィールテーブルに基本情報を登録
      // Supabase のトリガーや Edge Functions で行う方が一般的で安全ですが、
      // ここではクライアントサイドで行う例として残します。
      let profileData;
      let profileError;

      // user_metadata からロールを取得することを推奨
      const userRole = (authData.user.user_metadata as any)?.role as UserRole || data.role || 'parent';
      console.log("useAuth registerMutation: Determined user role:", userRole);

      if (userRole === 'tutor') {
        // 講師の場合
        ({ data: profileData, error: profileError } = await supabase
          .from('tutor_profile')
          .insert([{
            user_id: authData.user.id,
            email: data.email,
            // 講師プロファイルに必要な他の初期データがあればここに追加
            last_name: data.lastName || '',
            first_name: data.firstName || '',
            profile_completed: false,
          }])
          .select());
      } else if (userRole === 'parent') { // 保護者の場合
        ({ data: profileData, error: profileError } = await supabase
          .from('parent_profile')
          .insert([{
            user_id: authData.user.id,
            email: data.email,
            name: `${data.lastName || ''} ${data.firstName || ''}`.trim(),
            // role: userRole, // parent_profile に role フィールドがない場合がある
            // 保護者プロファイルに必要な他の初期データがあればここに追加
          }])
          .select());
      } else if (userRole === 'student') { // 生徒の場合
        ({ data: profileData, error: profileError } = await supabase
          .from('student_profile')
          .insert([{
            user_id: authData.user.id,
            email: data.email,
            last_name: data.lastName || '',
            first_name: data.firstName || '',
            // role: userRole, // student_profile に role フィールドがない場合がある
            // 生徒プロファイルに必要な他の初期データがあればここに追加
          }])
          .select());
      } else {
        console.warn("useAuth registerMutation: Unhandled user role during profile creation:", userRole);
        // 未対応ロールの場合もエラーとはしないがログを出す
      }

      if (profileError) {
        console.error("useAuth registerMutation: Profile insertion error:", profileError);
        // ここで認証ユーザーを削除するなどのロールバック処理を検討しても良い
        // 一旦エラーを投げて登録失敗とする
        // throw new Error(`プロフィールの作成に失敗しました: ${profileError.message}`); // プロファイル作成失敗でも認証は成功しているため、エラーにしない
      }
      
      console.log("useAuth registerMutation: Profile creation process completed.");

      // 成功したら認証情報を再取得してContextを更新
      await refetch();

      return { email: data.email };
    },
    onSuccess: ({ email }) => {
      toast({
        title: "登録成功",
        description: `ユーザー登録が完了しました。`,
      });
      
      // 登録後、必要に応じてプロフィール設定ページなどに遷移
      router.push('/dashboard'); // 例：ダッシュボードへ遷移
    },
    onError: (error: Error) => {
      console.error("useAuth registerMutation: onError:", error);
      toast({
        title: "登録に失敗しました",
        description: error.message || "ユーザー登録中にエラーが発生しました",
        variant: "destructive",
      });
    },
  });

  // ログアウト処理
  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("useAuth logoutMutation: Attempting sign out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("useAuth logoutMutation: Sign out error:", error);
        throw new Error(error.message);
      }
      console.log("useAuth logoutMutation: Sign out successful.");
    },
    onSuccess: () => {
      // setCurrentUser(null); // currentUser は削除した
      // refetch(); // onAuthStateChange リスナーが SIGNED_OUT を検知して refetch をトリガーするはず
      toast({
        title: "ログアウト完了",
        description: "ログアウトしました。またのご利用をお待ちしております。",
      });
      // ログアウト後のリダイレクトは、ダッシュボードページなどの AuthContext 利用側で行う方が適切
      // 例: user が null になったら /auth にリダイレクト
      // router.push('/'); // ここでの強制リダイレクトは AuthContext 利用側の制御を妨げる可能性がある
    },
    onError: (error: Error) => {
      console.error("useAuth logoutMutation: onError:", error);
      toast({
        title: "ログアウトに失敗しました",
        description: error.message, // またはカスタムメッセージ
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user,
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