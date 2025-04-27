'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";

export default function RedirectPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const session = useSession();

  useEffect(() => {
    if (session === undefined) return; // sessionがまだ取得中の状態
  
    const checkProfile = async () => {
      if (!session) return;
  
      const userId = session.user.id;
  
      const { data, error } = await supabase
        .from("guardians")
        .select("id")
        .eq("auth_id", userId)
        .single();
  
      if (error || !data) {
        router.replace("/student/register");
      } else {
        router.replace("/student/dashboard");
      }
    };
  
    checkProfile();
  }, [session, supabase, router]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-lg font-semibold mb-4">プロフィール確認中です...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
  
}
