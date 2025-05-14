import { useEffect } from "react";
import { useLocation } from "wouter";
import ParentProfileSetupPage from "./parent-profile-setup-page";

export default function ParentProfilePage() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    console.log("保護者用プロファイルページがマウントされました");
  }, []);
  
  return <ParentProfileSetupPage />;
}