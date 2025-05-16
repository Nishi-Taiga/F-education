import { useEffect } from "react";
import { useLocation } from "wouter";
import TutorProfileSetupPage from "./tutor-profile-setup-page";

export default function TutorProfilePage() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    console.log("講師用プロファイルページがマウントされました");
  }, []);
  
  return <TutorProfileSetupPage />;
}