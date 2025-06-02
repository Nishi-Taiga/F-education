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

        // 生徒ユーザーの場合、student_profileから情報を取得
        const { data: studentProfileData, error: studentProfileError } = await supabase
          .from('student_profile')
          // emailカラムを削除
          .select('id, first_name, last_name, user_id') // email, role を削除し、user_idを追加
          .eq('user_id', sessionData.session.user.id)
          .single();

        console.log("Fetched student profile:", { studentProfileData, studentProfileError });

        if (studentProfileError && studentProfileError.code !== 'PGRST116') { // PGRST116はデータがない場合のエラーコード
           throw studentProfileError;
        }

        if (studentProfileData) {
          // studentProfileDataが存在する場合、それをユーザー情報としてセット
          // useAuthのUserProfile型に合わせるためにマッピング
          setUser({
            id: studentProfileData.id,
            auth_user_id: studentProfileData.user_id, // auth_user_idとして紐付け
            email: sessionData.session.user.email, // Authからemailを使用
            first_name: studentProfileData.first_name,
            last_name: studentProfileData.last_name,
            role: 'student', // ロールはstudentで固定
            profile_completed: !!(studentProfileData.first_name && studentProfileData.last_name) // first_nameとlast_nameがあれば完了とみなす
          });
          console.log("User set from student profile:", studentProfileData);

          // プロフィール完了チェックはuseAuth側で行われるため、ここではデータ取得のみに専念
          // 必要であれば、ここでrequireProfileとprofile_completedに基づいたリダイレクトロジックを追加することも可能ですが、
          // useAuthの汎用ロジックに任せるのがシンプルです。

        } else {
          // student_profileが見つからなかった場合
          console.log("No student profile found for auth user id:", sessionData.session.user.id);
          // student_profileが存在しない場合は、ユーザーを特定できないため、認証失敗として扱うか、
          // プロフィール作成画面にリダイレクトするなどの対応が必要。
          // 現在のuseAuthロジックではprofileが見つからないと認証失敗になるため、そのまま進む。
        }

      } catch (err) {
        console.error('Auth error during profile fetch/processing:', err);
        setError(err);
        toast({
          title: '認証エラー',
          description: '認証情報の取得に失敗しました',
          variant: 'destructive',
        });
        setUser(null); // エラーが発生した場合もユーザーをnullにセット

      } finally {
        // 全ての非同期処理が終わった後にloadingをfalseにする
        // ロールに基づいたリダイレクトチェックや権限チェックは、
        // setUserが呼ばれてuser stateが更新された後にuseEffectの別の箇所で行うか、
        // またはこのtry/catch/finallyブロックの直後に行う必要がある。
        // いずれにしても、プロフィールが見つからなかった場合でもisLoadingはfalseになるべき。
        setLoading(false);
        console.log("fetchUser process finished.");
      }
    };

    // checkUser 関数本体のロジックを修正する
    const checkUserLogic = async () => {
       try {
          setLoading(true);
          setError(null);

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (!sessionData.session) {
            console.log('No session found in checkUserLogic, redirecting to', redirectTo);
            if (redirectTo) router.push(redirectTo);
            setLoading(false);
            return;
          }

          setSession(sessionData.session);
          console.log('Session found in checkUserLogic for user:', sessionData.session.user.email);

          let fetchedUser: UserProfile | null = null;

          // usersテーブルから基本情報を取得してロールを判断
          const { data: basicUserData, error: basicUserError } = await supabase
            .from('users')
            .select('id, auth_user_id, email, role, profile_completed') // roleとprofile_completedを取得
            .eq('auth_user_id', sessionData.session.user.id)
            .single();

          if (basicUserError && basicUserError.code !== 'PGRST116') {
             // usersテーブルからの取得でエラーがあればthrow
             throw basicUserError;
          }

          if (!basicUserData) {
             // usersテーブルにエントリがない新規ユーザーの場合
             console.log('User not found in users table, creating new user entry');
             // 新規ユーザーを作成 (このロジックはSignUpページ等に移動する方が適切かもしれませんが、useAuthにも残します)
             const { data: newUserEntry, error: createError } = await supabase
               .from('users')
               .insert([{ // 必須フィールドのみで挿入
                 auth_user_id: sessionData.session.user.id,
                 email: sessionData.session.user.email,
                 role: 'parent', // デフォルトロールをparentに設定
                 profile_completed: false
               }])
               .select('id, auth_user_id, email, role, profile_completed'); // 挿入後のデータを取得

             if (createError) { throw createError; }
             
             console.log("New user entry created:", newUserEntry);
             fetchedUser = newUserEntry ? newUserEntry[0] as UserProfile : null;

          } else {
             // usersテーブルにエントリがあった場合
             console.log("User entry found in users table:", basicUserData);
             // UserProfileに必要な情報をマッピング
             fetchedUser = {
               id: basicUserData.id,
               auth_user_id: basicUserData.auth_user_id,
               email: basicUserData.email,
               first_name: basicUserData.first_name || undefined, // first_name, last_name, profile_completed は users テーブルに存在しない場合がある
               last_name: basicUserData.last_name || undefined,
               role: basicUserData.role,
               profile_completed: basicUserData.profile_completed || false
             };
             
             // ロールがstudentの場合、student_profileから詳細を取得
             if (fetchedUser.role === 'student') {
                console.log("User role is student, fetching student profile...");
                const { data: studentProfileData, error: studentProfileError } = await supabase
                  .from('student_profile')
                  // email, role を削除
                  .select('id, first_name, last_name') // user_id は student_profile には直接不要 (users.auth_user_idで紐付け)
                  .eq('user_id', fetchedUser.auth_user_id) // users.auth_user_id と student_profile.user_id を紐付け
                  .single();

                console.log("Fetched student profile details:", { studentProfileData, studentProfileError });

                if (studentProfileError && studentProfileError.code !== 'PGRST116') { throw studentProfileError; }

                if (studentProfileData) {
                   // student_profileの情報をfetchedUserにマージ
                   fetchedUser = {
                     ...fetchedUser,
                     id: studentProfileData.id, // student_profileのIDをUserProfile.idとして使うか検討が必要（今回はusers.idを維持）
                     first_name: studentProfileData.first_name,
                     last_name: studentProfileData.last_name,
                     // roleはusersテーブルから取得したものを維持
                     profile_completed: !!(studentProfileData.first_name && studentProfileData.last_name)
                   };
                   console.log("Merged student profile data:", fetchedUser);
                } else {
                   console.log("No detailed student profile found for auth user id:", fetchedUser.auth_user_id);
                   // 詳細プロフィールが見つからなくても、usersテーブルの情報で基本ユーザーとしては認証済みとする
                   // profile_completedはfalseのままとなる
                }

             } else if (fetchedUser.role === 'tutor') {
                 // TODO: 講師プロフィールも同様に取得する必要がある場合はここに追加
                 console.log("User role is tutor. Fetching tutor profile not implemented yet.");
                 // 講師プロフィール取得ロジックを追加
                 const { data: tutorProfileData, error: tutorProfileError } = await supabase
                   .from('tutor_profile')
                   .select('id, first_name, last_name') // 必要に応じて他のカラムも追加
                   .eq('user_id', fetchedUser.auth_user_id)
                   .single();

                 console.log("Fetched tutor profile details:", { tutorProfileData, tutorProfileError });

                 if (tutorProfileError && tutorProfileError.code !== 'PGRST116') { throw tutorProfileError; }

                 if (tutorProfileData) {
                    fetchedUser = {
                      ...fetchedUser,
                      id: tutorProfileData.id, // tutor_profileのIDを使うか検討
                      first_name: tutorProfileData.first_name,
                      last_name: tutorProfileData.last_name,
                      profile_completed: !!(tutorProfileData.first_name && tutorProfileData.last_name)
                    };
                     console.log("Merged tutor profile data:", fetchedUser);
                 } else {
                    console.log("No detailed tutor profile found for auth user id:", fetchedUser.auth_user_id);
                 }

             } else if (fetchedUser.role === 'parent') {
                 // 保護者ロールの場合は、usersテーブルに parent_profile_id が紐づいているはず（初期設定時）
                 // ただし、parent_profileテーブル自体から詳細情報を取得する必要があるかもしれない
                 console.log("User role is parent.");
                 const { data: parentProfileData, error: parentProfileError } = await supabase
                   .from('parent_profile')
                   .select('id, name, phone, postal_code, prefecture, city, address') // 必要に応じて他のカラムも追加
                   .eq('user_id', fetchedUser.auth_user_id) // users.auth_user_id と parent_profile.user_id を紐付け
                   .single();

                 console.log("Fetched parent profile details:", { parentProfileData, parentProfileError });

                 if (parentProfileError && parentProfileError.code !== 'PGRST116') { throw parentProfileError; }

                 if (parentProfileData) {
                    fetchedUser = {
                      ...fetchedUser,
                      id: parentProfileData.id, // parent_profileのIDを使うか検討
                      first_name: parentProfileData.name ? parentProfileData.name.split(' ')[1] : undefined, // 名前の分割は仮
                      last_name: parentProfileData.name ? parentProfileData.name.split(' ')[0] : undefined, // 名前の分割は仮
                      // emailはusersテーブルから取得したものを維持
                      // roleはusersテーブルから取得したものを維持
                      profile_completed: !!(parentProfileData.name && parentProfileData.phone)
                    };
                    console.log("Merged parent profile data:", fetchedUser);
                 } else {
                    console.log("No detailed parent profile found for auth user id:", fetchedUser.auth_user_id);
                 }

             }
          }

          // fetchedUser が取得できた場合
          if (fetchedUser) {
            setUser(fetchedUser); // 最終的なユーザー情報をセット
            console.log("Final user state after fetch:", fetchedUser);

            // プロフィール完了チェックと権限チェック
            if (requireProfile && !fetchedUser.profile_completed) {
              console.log('Profile required and incomplete, redirecting to profile setup');
              toast({
                title: 'プロフィール設定が必要です',
                description: 'ユーザー情報を設定してください',
                variant: 'default'
              });
              router.push('/profile-setup');
              return;
            }

            if (allowedRoles.length > 0 && fetchedUser.role && !allowedRoles.includes(fetchedUser.role)) {
              console.log('User role not allowed:', fetchedUser.role);
              toast({
                title: 'アクセス権限がありません',
                description: 'このページへのアクセス権限がありません',
                variant: 'destructive'
              });
              router.push('/dashboard'); // ダッシュボード自体に権限がない場合はここにリダイレクトしても無限ループになる可能性
              // アクセス権限がない場合の適切なリダイレクト先を検討する必要があります。
              // 例: エラーページ、または権限のあるデフォルトページ
              // 一旦ルートにリダイレクトするようにします。
               router.push('/');
              return;
            }

             console.log("Auth check passed, user is authenticated and authorized.");

          } else {
             // セッションはあるが users テーブルにも profile テーブルにも情報が見つからない場合など
             // この場合、認証情報はあるがアプリケーションレベルでユーザー情報がないため、未認証扱いにする
             console.log("Session exists but no application user profile found. Treating as unauthenticated.");
             setUser(null); // ユーザーをnullにセット
             // 未認証の場合のリダイレクトはuseEffectの別のロジックで行われる
          }

       } catch (err) {
         console.error('Auth error in checkUserLogic:', err);
         setError(err);
         toast({
           title: '認証エラー',
           description: '認証情報の取得に失敗しました',
           variant: 'destructive',
         });
         setUser(null); // エラー時もユーザーをnullにセット
       } finally {
         setLoading(false);
         console.log("checkUserLogic finished.");
       }
    };

    // checkUserLogic を呼び出す
    console.log("useAuth Effect: Running checkUserLogic...");
    checkUserLogic();

    // 認証状態の変更を監視
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('useAuth AuthListener: event:', event, session);
        if (event === 'SIGNED_OUT') {
          console.log("AuthListener: SIGNED_OUT, clearing user/session.");
          setUser(null);
          setSession(null);
          if (redirectTo) {
             console.log('AuthListener: Redirecting to', redirectTo);
             router.push(redirectTo);
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          console.log("AuthListener: SIGNED_IN or TOKEN_REFRESHED or INITIAL_SESSION, re-running checkUserLogic.");
          // セッションが確立または更新されたら、再度ユーザー情報をチェック
          await checkUserLogic();
        }
      }
    );

    return () => {
      // クリーンアップ
      console.log("useAuth Effect: Cleaning up auth listener.");
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [router, redirectTo, requireProfile, allowedRoles, toast]); // 依存配列にtoastを追加

  // ログアウト関数
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    router.push('/');
  };

  return { user, session, loading, error, signOut };
}