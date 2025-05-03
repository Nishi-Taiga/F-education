import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // ログイン成功時に必要なデータを事前に取得
      if (user.role === 'parent') {
        // 保護者アカウントの場合は、生徒情報を先に取得
        console.log("ユーザーログイン検出 - 生徒データを再取得します");
        queryClient.prefetchQuery({
          queryKey: ["/api/students"],
          staleTime: 10 * 60 * 1000, // 10分間キャッシュを保持
        });
        
        // チケット情報も取得
        queryClient.prefetchQuery({
          queryKey: ["/api/student-tickets"],
          staleTime: 10 * 60 * 1000,
        });
      } else if (user.role === 'tutor') {
        // 講師アカウントの場合は、講師プロフィールと予約情報を先に取得
        queryClient.prefetchQuery({
          queryKey: ["/api/tutor/profile"],
          staleTime: 10 * 60 * 1000,
        });
        
        queryClient.prefetchQuery({
          queryKey: ["/api/tutor/bookings"],
          staleTime: 5 * 60 * 1000, // 5分間キャッシュを保持
        });
      }
      
      // すべてのユーザータイプで予約データを取得
      queryClient.prefetchQuery({
        queryKey: ["/api/bookings"],
        staleTime: 5 * 60 * 1000,
      });
      
      toast({
        title: "ログイン成功",
        description: `こんにちは、${user.displayName || user.username}さん`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "ログインに失敗しました",
        description: error.message || "ユーザー名またはパスワードが正しくありません",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "アカウント作成完了",
        description: "登録が完了しました。サービスをご利用いただけます。",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "アカウント作成に失敗しました",
        description: error.message || "ユーザー名がすでに使用されている可能性があります",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "ログアウト完了",
        description: "ログアウトしました。またのご利用をお待ちしております。",
      });
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
        user: user ?? null,
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
