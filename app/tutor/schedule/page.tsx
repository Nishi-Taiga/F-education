'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfWeek, subDays, addWeeks, subWeeks, parseISO, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Home, Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// シフト情報の型定義
type Shift = {
  id: number;
  tutor_id: string;
  date: string;
  time_slot: string;
  subject: string;
  is_available: boolean;
  created_at: string;
};

type DayShift = {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  shifts: {
    [key: string]: {
      exists: boolean;
      isAvailable: boolean;
      id?: number;
      subject?: string;
    };
  };
};

// 利用可能な時間枠の定義
const timeSlots = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
  '20:00-21:00'
];

export default function TutorSchedulePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingShifts, setPendingShifts] = useState<Array<{
    date: string;
    time_slot: string;
    is_available: boolean;
  }>>([]);
  
  // 現在の週の開始日（日曜日）
  const [weekStart, setWeekStart] = useState(() => {
    // 今日の日付から直近の日曜日を計算
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });
  
  // 講師プロフィールの取得
  const [tutorProfile, setTutorProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // シフト情報の取得
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // ユーザー情報を取得
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true);
      setAuthError(null);
      
      try {
        // ユーザー情報取得
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          setAuthError(error.message);
          return;
        }
        
        if (!data.user) {
          setAuthError('ユーザーが見つかりません。ログインしてください。');
          return;
        }
        
        // テスト用の仮設定 - 開発を容易にするため
        setUser({ ...data.user, role: 'tutor' });
        
        // 本番環境では以下のコードを使ってroleを取得する
        /* const { data: userData, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();
        
        if (roleError) {
          setAuthError(roleError.message);
          return;
        }
        
        setUser({ ...data.user, role: userData?.role || 'unknown' }); */
      } catch (error: any) {
        setAuthError(error.message || 'ユーザー情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoadingUser(false);
      }
    };
    
    fetchUser();
  }, [supabase]);
  
  // 講師プロフィールを取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      if (!user) return;
      
      setIsLoadingProfile(true);
      setProfileError(null);
      
      try {
        // テスト用の仮のプロフィール - 開発を容易にするため
        setTutorProfile({
          id: '1',
          user_id: user.id,
          lastName: 'テスト',
          firstName: '講師',
          subjects: ['数学', '英語'],
          bio: 'テスト用プロフィール'
        });
        
        /* 本番環境では以下のコードを使ってプロフィールを取得する
        const { data, error } = await supabase
          .from('tutors')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            setProfileError('講師プロフィールが見つかりません。プロフィールの設定が必要です。');
          } else {
            setProfileError(error.message);
          }
          return;
        }
        
        setTutorProfile(data); */
      } catch (error: any) {
        setProfileError(error.message || '講師プロフィールの取得中にエラーが発生しました。');
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchTutorProfile();
  }, [user, supabase]);
  
  // シフト情報を取得
  useEffect(() => {
    const fetchShifts = async () => {
      if (!tutorProfile) {
        setIsLoadingShifts(false);
        return;
      }
      
      setIsLoadingShifts(true);
      setShiftsError(null);
      
      try {
        // テスト用の仮データ - 開発を容易にするため
        // 現在の週の月曜日に仮のシフトを設定
        const mondayDate = format(addDays(weekStart, 1), 'yyyy-MM-dd');
        
        setShifts([
          {
            id: 1,
            tutor_id: tutorProfile.id,
            date: mondayDate,
            time_slot: '13:00-14:00',
            subject: '数学',
            is_available: true,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            tutor_id: tutorProfile.id,
            date: mondayDate,
            time_slot: '14:00-15:00',
            subject: '英語',
            is_available: true,
            created_at: new Date().toISOString()
          }
        ]);
        
        /* 本番環境では以下のコードを使ってシフトを取得する
        const { data, error } = await supabase
          .from('tutor_shifts')
          .select('*')
          .eq('tutor_id', tutorProfile.id);
        
        if (error) {
          setShiftsError(error.message);
          return;
        }
        
        setShifts(data || []); */
      } catch (error: any) {
        setShiftsError(error.message || 'シフト情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoadingShifts(false);
      }
    };
    
    fetchShifts();
  }, [tutorProfile, weekStart, supabase]); // weekStartを依存配列に追加して週が変わるたびにデータを取得
  
  // 読み込み中の表示
  if (isLoadingUser) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>ユーザー情報を読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // 認証エラーの表示
  if (authError) {
    return (
      <div className="container py-8">
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-500">認証エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{authError}</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/auth')}
            >
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // ユーザーが存在しない場合
  if (!user) {
    return (
      <div className="container py-8">
        <Card className="border-yellow-300">
          <CardHeader>
            <CardTitle className="text-yellow-500">ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p>このページにアクセスするにはログインが必要です。</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/auth')}
            >
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // プロフィールの読み込み中
  if (isLoadingProfile) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>講師プロフィールを読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // プロフィールが未登録の場合
  if (!tutorProfile) {
    return (
      <div className="container py-8">
        <Card className="border-orange-300">
          <CardHeader>
            <CardTitle className="text-orange-500">プロフィール設定が必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{profileError || 'シフトを登録する前に、まずプロフィール情報を入力してください。'}</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/tutor/profile')}
            >
              プロフィール設定へ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
