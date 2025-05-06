import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// レポートIDを使用して特定のレポートを取得するフック
export function useLessonReportById(reportId: number | null) {
  return useQuery({
    queryKey: [reportId ? `/api/lesson-reports/${reportId}` : null],
    enabled: !!reportId,
  });
}

// 予約IDを使用してレポートを取得するフック
export function useLessonReportByBookingId(bookingId: number | null) {
  return useQuery({
    queryKey: [bookingId ? `/api/lesson-reports/booking/${bookingId}` : null],
    enabled: !!bookingId,
  });
}

// 講師が担当している全レポートを取得するフック
export function useTutorLessonReports() {
  return useQuery({
    queryKey: ['/api/lesson-reports/tutor'],
  });
}

// 生徒の全レポートを取得するフック
export function useStudentLessonReports(studentId: number | null) {
  return useQuery({
    queryKey: [studentId ? `/api/lesson-reports/student/${studentId}` : null],
    enabled: !!studentId,
  });
}

// レポートを作成するフック
export function useCreateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest("POST", "/api/lesson-reports", reportData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "授業レポートを作成しました",
        description: "レポートが正常に保存されました",
      });
      
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/tutor'] });
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

// レポートを更新するフック
export function useUpdateLessonReport() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ reportId, data }: { reportId: number, data: any }) => {
      const res = await apiRequest("PUT", `/api/lesson-reports/${reportId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "授業レポートを更新しました",
        description: "レポートが正常に更新されました",
      });
      
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ['/api/lesson-reports/tutor'] });
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