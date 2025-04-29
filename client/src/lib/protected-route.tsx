import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  skipProfileCheck,
}: {
  path: string;
  component: () => React.JSX.Element | null;
  skipProfileCheck?: boolean;
}): React.JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // プロフィールチェックをスキップするルート（プロフィール設定ページ自体など）以外で、
  // プロフィールが未設定の場合は、プロフィール設定ページにリダイレクト
  // 生徒アカウント（student）はプロフィール設定をスキップします
  if (!skipProfileCheck && !user.profileCompleted && path !== "/profile-setup" && 
      user.role !== "tutor" && user.role !== "student") {
    return (
      <Route path={path}>
        <Redirect to="/profile-setup" />
      </Route>
    );
  }
  
  // 講師ユーザーで、講師プロフィールページ以外にアクセスしようとした場合で、
  // 講師プロフィールを未入力の場合は、講師プロフィール設定ページにリダイレクト
  if (user.role === "tutor" && !(user as any).tutorProfileCompleted && path !== "/tutor/profile") {
    return (
      <Route path={path}>
        <Redirect to="/tutor/profile" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
