"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, addDays, subDays, startOfWeek, addWeeks, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  CalendarRange, 
  Clock, 
  Save,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  CalendarIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Database } from '@/types/supabase';

// 時間帯のオプション
const timeOptions = Array.from({ length: 15 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return { value: `${hour.toString().padStart(2, '0')}:${minute}`, label: `${hour}:${minute}` };
});

export default function TutorSchedulePage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tutorProfile, setTutorProfile] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 0 });
  });
  
  // シフト追加モーダル用の状態
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // 講師情報を取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      setLoading(true);
      
      try {
        // セッションチェック
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No active session found");
          // ログイン状態を先にチェックせずに、自動でリダイレクトされるようにする
          return;
        }
        
        console.log("Session found:", session.user.email);
        
        // 講師プロファイルを取得
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (tutorError) {
          console.error("Error fetching tutor profile:", tutorError);
          
          // メールで検索できない場合はIDで再試行
          const { data: tutorDataById, error: tutorErrorById } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (tutorErrorById) {
            console.error("Error fetching tutor profile by ID:", tutorErrorById);
            toast({
              title: "エラー",
              description: "講師情報の取得に失敗しました",
              variant: "destructive",
            });
            return;
          } else if (tutorDataById) {
            console.log("Found tutor profile by ID:", tutorDataById);
            setTutorProfile(tutorDataById);
            
            // シフト情報を取得
            await fetchShifts(tutorDataById.id);
          } else {
            toast({
              title: "講師プロフィールが見つかりません",
              description: "講師プロフィールの設定が必要です",
              variant: "destructive",
            });
            return;
          }
        } else if (tutorData) {
          console.log("Found tutor profile:", tutorData);
          setTutorProfile(tutorData);
          
          // シフト情報を取得
          await fetchShifts(tutorData.id);
        } else {
          toast({
            title: "講師プロフィールが見つかりません",
            description: "講師プロフィールの設定が必要です",
            variant: "destructive",
          });
          return;
        }
      } catch (error: any) {
        console.error("Error in fetchTutorProfile:", error);
        toast({
          title: "エラー",
          description: error.message || "講師情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchTutorProfile();
  }, []);