import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LessonReport, InsertLessonReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useLessonReportByBookingId(bookingId: number | null | undefined) {
  return useQuery<LessonReport | null>({
    queryKey: ['/api/lesson-reports/booking', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      try {
        const response = await fetch(`/api/lesson-reports/booking/${bookingId}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('レポートの取得に失敗しました');
        return await response.json();
      } catch (error) {
        console.error('レポート取得エラー:', error);
        throw error;
      }
    },
    enabled: !!bookingId
  });
}

export function useLessonReportsByStudentId(studentId: number | null | undefined) {
  return useQuery<LessonReport[]>({
    queryKey: ['/api/lesson-reports/student', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      try {
        const response = await fetch(`/api/lesson-reports/student/${studentId}`);
        if (!response.ok) throw new Error('レポート一覧の取得に失敗しました');
        return await response.json();
      } catch (error) {
        console.error('レポート一覧取得エラー:', error);
        throw error;
      }
    },
    enabled: !!studentId
  });
}

export function useTutorLessonReports() {
  return useQuery<LessonReport[]>({
    queryKey: ['/api/lesson-reports/tutor'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/lesson-reports/tutor');
        if (!response.ok) throw new Error('講師のレポート一覧の取得に失敗しました');
        return await response.json();
      } catch (error) {
        console.error('講師レポート一覧取得エラー:', error);
        throw error;
      }
    }
  });
}

export function useCreateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (reportData: InsertLessonReport) => {
      try {
        const response = await apiRequest('POST', '/api/lesson-reports', reportData);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'レポートの作成に失敗しました');
        }
        return await response.json();
      } catch (error: any) {
        console.error('レポート作成エラー:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'レポートを作成しました',
        description: 'レッスンレポートを正常に保存しました。',
      });
      
      // 関連するクエリの無効化
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/booking', data.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/student', data.studentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/tutor'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'レポート作成エラー',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}

export function useUpdateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertLessonReport> }) => {
      try {
        const response = await apiRequest('PUT', `/api/lesson-reports/${id}`, data);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'レポートの更新に失敗しました');
        }
        return await response.json();
      } catch (error: any) {
        console.error('レポート更新エラー:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'レポートを更新しました',
        description: 'レッスンレポートを正常に更新しました。',
      });
      
      // 関連するクエリの無効化
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/booking', data.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/student', data.studentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/tutor'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'レポート更新エラー',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}