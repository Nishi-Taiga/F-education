import { useEffect } from "react";
import { useLocation } from "wouter";
import ProfileSelectionPage from "./profile-selection-page";

export default function ProfileSelectionWrapper() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    console.log("プロファイル選択ページがマウントされました");
  }, []);
  
  return <ProfileSelectionPage />;
}