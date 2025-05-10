import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createServerClient();
  
  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect("/auth");
  }
  
  // User is authenticated, redirect to dashboard
  redirect("/dashboard");
}
