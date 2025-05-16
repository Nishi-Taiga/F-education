import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

// プロファイルページタイプの解決
export default function ProfileSetupRouter() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  useEffect(() => {
    // 現在のパスを取得
    const currentPath = location;
    console.log("ProfileSetupRouter: 現在のパス", currentPath);
    
    // タイプ別のリダイレクト
    if (currentPath.includes("/profile-setup/parent")) {
      console.log("保護者プロファイルセットアップページにリダイレクトしています");
      setLocation("/parent-profile");
    } else if (currentPath.includes("/profile-setup/tutor")) {
      console.log("講師プロファイルセットアップページにリダイレクトしています");
      setLocation("/tutor-profile");
    } else {
      // 選択ページにリダイレクト
      console.log("プロファイル選択ページにリダイレクトしています");
      setLocation("/profile-selection");
    }
  }, [location, setLocation]);
  
  // ローディング表示
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}