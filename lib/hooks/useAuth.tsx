"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

// ユーザーの型定義
export type UserProfile = {
  id: number;
  auth_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  profile_completed?: boolean;
};

// フックのオプション型
type UseAuthOptions = {
  redirectTo?: string;
  requireProfile?: boolean;
  allowedRoles?: string[];
};

/**
 * 認証状態を管理するカスタムフック
 * @param options 認証オプション
 * @returns ユーザー情報と認証状態
 */
export function useAuth(options: UseAuthOptions = {}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const router = useRouter();
  const { toast } = useToast();

  // デフォルトオプション
  const {
    redirectTo = '/',
    requireProfile = false,
    allowedRoles = ['parent', 'student', 'tutor']
  } = options;

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        setError(null);

        // セッションを取得
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // セッションがない場合はリダイレクト
        if (!sessionData.session) {
          console.log('No session found, redirecting to', redirectTo);
          if (redirectTo) router.push(redirectTo);
          setLoading(false);
          return;
        }

        // セッションを設定
        setSession(sessionData.session);
        console.log('Session found for user:', sessionData.session.user.email);

        // ユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', sessionData.session.user.id)
          .single();

        // ユーザーが見つからない場合
        if (userError && userError.code === 'PGRST116') {
          console.log('User not found in database, creating new user');
          
          // 新規ユーザーを作成
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
              auth_user_id: sessionData.session.user.id,
              email: sessionData.session.user.email,
              role: 'parent',
              profile_completed: false
            }])
            .select();
            
          if (createError) {
            throw createError;
          }

          // プロフィール設定が必要な場合はリダイレクト
          if (requireProfile) {
            console.log('Profile required, redirecting to profile setup');
            router.push('/profile-setup');
            return;
          }

          setUser(newUser ? newUser[0] : null);
        } else if (userError) {
          throw userError;
        } else {
          // ユーザーが見つかった場合
          setUser(userData);

          // プロフィールが必要で、まだ完了していない場合
          if (
            requireProfile && 
            (!userData.first_name || 
             !userData.last_name || 
             userData.profile_completed === false)
          ) {
            console.log('Profile incomplete, redirecting to profile setup');
            toast({
              title: 'プロフィール設定が必要です',
              description: 'ユーザー情報を設定してください',
              variant: 'default'
            });
            router.push('/profile-setup');
            return;
          }

          // 権限チェック
          if (
            allowedRoles.length > 0 && 
            userData.role && 
            !allowedRoles.includes(userData.role)
          ) {
            console.log('User role not allowed:', userData.role);
            toast({
              title: 'アクセス権限がありません',
              description: 'このページへのアクセス権限がありません',
              variant: 'destructive'
            });
            router.push('/dashboard');
            return;
          }
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError(err);
        toast({
          title: '認証エラー',
          description: '認証情報の取得に失敗しました',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // 認証状態の変更を監視
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          if (redirectTo) router.push(redirectTo);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // 再度ユーザー情報を取得
          await checkUser();
        }
      }
    );

    return () => {
      // クリーンアップ
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [router, redirectTo, requireProfile, allowedRoles, toast]);

  // ログアウト関数
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    router.push('/');
  };

  return { user, session, loading, error, signOut };
}