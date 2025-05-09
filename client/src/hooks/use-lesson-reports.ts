import { useQuery, useMutation, QueryObserverResult } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// パフォーマンス向上: staleTimeとcacheTimeの設定、プリフェッチ対応
const STALE_TIME_SHORT = 1000 * 60 * 5; // 5分
const CACHE_TIME = 1000 * 60 * 30; // 30分

// 特定のレポートをIDから高速に取得するフック (キャッシュ最適化)
export function useLessonReportById(reportId: string | number | null) {
  return useQuery({
    queryKey: [reportId ? `/api/lesson-reports/${reportId}` : null],
    enabled: !!reportId,
    staleTime: STALE_TIME_SHORT,
    gcTime: CACHE_TIME,
    retry: 1, // エラー時の再試行回数を制限
  });
}

// 予約IDからレポートを高速に取得するフック (キャッシュ最適化)
export function useLessonReportByBookingId(bookingId: number | null) {
  return useQuery({
    queryKey: [bookingId ? `/api/lesson-reports/booking/${bookingId}` : null],
    enabled: !!bookingId,
    staleTime: STALE_TIME_SHORT,
    gcTime: CACHE_TIME,
    retry: 1, // エラー時の再試行回数を制限
  });
}

// 特定のレポートデータをプリフェッチする関数
export function prefetchLessonReport(reportId: number | string): Promise<any> {
  return queryClient.prefetchQuery({
    queryKey: [`/api/lesson-reports/${reportId}`],
    staleTime: STALE_TIME_SHORT,
  });
}

// 特定の予約のレポートをプリフェッチする関数 
export function prefetchLessonReportByBookingId(bookingId: number): Promise<any> {
  return queryClient.prefetchQuery({
    queryKey: [`/api/lesson-reports/booking/${bookingId}`],
    staleTime: STALE_TIME_SHORT,
  });
}

// パフォーマンス向上: より長いキャッシュ時間設定
const STALE_TIME_LONG = 1000 * 60 * 15; // 15分

// 講師が担当している全レポートを取得するフック（キャッシュ最適化）
export function useTutorLessonReports() {
  return useQuery({
    queryKey: ['/api/lesson-reports/tutor'],
    staleTime: STALE_TIME_LONG,
    gcTime: CACHE_TIME,
  });
}

// 生徒の全レポートを取得するフック（キャッシュ最適化）
export function useStudentLessonReports(studentId: number | null) {
  return useQuery({
    queryKey: [studentId ? `/api/lesson-reports/student/${studentId}` : null],
    enabled: !!studentId,
    staleTime: STALE_TIME_LONG,
    gcTime: CACHE_TIME,
  });
}

// 講師レポート一覧をプリフェッチする関数
export function prefetchTutorLessonReports(): Promise<any> {
  return queryClient.prefetchQuery({
    queryKey: ['/api/lesson-reports/tutor'],
    staleTime: STALE_TIME_LONG,
  });
}

// レポート作成に使用する型定義（エディタ補完とType Safety向上）
export interface CreateLessonReportData {
  bookingId: number;
  tutorId: number;
  studentId: number | null;
  unitContent: string;
  messageContent: string;
  goalContent: string;
}

// 高速化: レポートを作成するフック（型安全性とエラーハンドリング強化）
export function useCreateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (reportData: CreateLessonReportData) => {
      const res = await apiRequest("POST", "/api/lesson-reports", reportData);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || '作成に失敗しました');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      // 成功時、特定のレポートのキャッシュも無効化（ID付き）
      if (data && data.id) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/lesson-reports/${data.id}`] 
        });
      }
      
      // 全レポート一覧のキャッシュを無効化
      queryClient.invalidateQueries({ 
        queryKey: ['/api/lesson-reports/tutor'] 
      });
      
      // バックグラウンドでプリフェッチを開始（ユーザー体験向上）
      prefetchTutorLessonReports();
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `レポートの作成に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}

// レポート更新に使用する型定義
export interface UpdateLessonReportData {
  reportId: number;
  data: {
    unitContent?: string;
    messageContent?: string;
    goalContent?: string;
  };
}

// 高速化: レポートを更新するフック（型安全性とエラーハンドリング強化）
export function useUpdateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ reportId, data }: UpdateLessonReportData) => {
      const res = await apiRequest("PUT", `/api/lesson-reports/${reportId}`, data);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || '更新に失敗しました');
      }
      
      return await res.json();
    },
    onSuccess: (data, variables) => {
      // 単一レポートのキャッシュを無効化
      queryClient.invalidateQueries({ 
        queryKey: [`/api/lesson-reports/${variables.reportId}`] 
      });
      
      // 関連する予約IDがあれば、そのキャッシュも無効化
      if (data && data.bookingId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/lesson-reports/booking/${data.bookingId}`] 
        });
        
        // 予約データも無効化
        queryClient.invalidateQueries({ 
          queryKey: [`/api/bookings/${data.bookingId}`] 
        });
      }
      
      // 全体リストのキャッシュを更新
      queryClient.invalidateQueries({ 
        queryKey: ['/api/lesson-reports/tutor'] 
      });
      
      // バックグラウンドでプリフェッチを開始（ユーザー体験向上）
      prefetchTutorLessonReports();
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: `レポートの更新に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}