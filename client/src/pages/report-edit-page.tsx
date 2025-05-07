import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useLessonReportById } from "@/hooks/use-lesson-reports";
import { useSearchParams } from "@/hooks/use-search-params";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { ReportEditModal } from "@/components/report-edit-modal";

function parseSearchParam(param: string | null): number | null {
  if (!param) return null;
  const parsed = parseInt(param, 10);
  return isNaN(parsed) ? null : parsed;
}

export default function ReportEditPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = useSearchParams();
  const reportId = parseSearchParam(params.get("reportId"));
  const bookingId = parseSearchParam(params.get("bookingId"));
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // レポートIDがある場合はレポートを取得
  // レポートデータの取得 - 型安全にするために条件付きでIDをnullに
  const { data: reportData, isLoading: isLoadingReport } = useLessonReportById(
    reportId ? reportId.toString() : null
  );
  
  useEffect(() => {
    // 最適化された初期データ取得処理
    const tryLoadInitialData = async () => {
      try {
        // 1. セッションストレージから予約データを最初に確認（最も高速）
        const storedBookingData = sessionStorage.getItem('EDIT_BOOKING_DATA');
        if (storedBookingData) {
          // セッションストレージからデータを読み込む（最速）
          setBookingData(JSON.parse(storedBookingData));
          setLoading(false);
          setModalOpen(true);
          return; // 早期リターンで後続の処理をスキップ
        }
        
        // 2. 初期レポートデータ取得（新規作成時のみ必要）
        const initialReportData = sessionStorage.getItem('INITIAL_REPORT_DATA');
        
        // 3. APIパラメータ（reportIdかbookingId）がない場合は処理中断
        if ((!reportId || !reportData) && !bookingId) {
          toast({
            title: "エラー",
            description: "編集するレポートデータが見つかりません。マイページに戻ります。",
            variant: "destructive",
          });
          // すぐにリダイレクト
          setLocation('/');
          return;
        }
        
        // 4. レポートIDから予約データを取得
        if (reportId && reportData && typeof reportData === 'object' && 'bookingId' in reportData && reportData.bookingId) {
          try {
            // APIリクエストを開始
            const response = await fetch(`/api/bookings/${reportData.bookingId}`);
            if (response.ok) {
              const booking = await response.json();
              // レポートデータを結合
              setBookingData({
                ...booking,
                lessonReport: reportData
              });
            } else {
              throw new Error("予約データの取得に失敗しました");
            }
          } catch (error) {
            throw new Error("レポートからの予約データ取得に失敗しました");
          }
        } 
        // 5. または予約IDから取得
        else if (bookingId) {
          try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
              const booking = await response.json();
              
              // 初期レポートデータがあれば追加
              if (initialReportData) {
                try {
                  const initialData = JSON.parse(initialReportData);
                  booking.lessonReport = {
                    id: 0, // 新規レポート
                    bookingId: booking.id,
                    tutorId: booking.tutorId,
                    studentId: booking.studentId,
                    ...initialData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  };
                } catch (parseError) {
                  // 初期データのパースエラーは無視して続行
                }
              }
              
              setBookingData(booking);
            } else {
              throw new Error("予約データの取得に失敗しました");
            }
          } catch (error) {
            throw new Error("予約IDからの予約データ取得に失敗しました");
          }
        }
        
        // 6. データ取得完了、モーダルを表示
        setLoading(false);
        setModalOpen(true);
      } catch (error) {
        // エラー処理の統一
        toast({
          title: "エラー",
          description: error instanceof Error ? error.message : "レポートデータの読み込みに失敗しました。",
          variant: "destructive",
        });
        // すぐにリダイレクト
        setLocation('/');
      }
    };
    
    tryLoadInitialData();
  }, [reportId, bookingId, reportData, toast, setLocation]);
  
  // モーダルを閉じたときの挙動 - パフォーマンス最適化
  const handleClose = () => {
    // セッションストレージのクリーンアップを非同期で実行
    setTimeout(() => {
      try {
        sessionStorage.removeItem('EDIT_BOOKING_DATA');
        sessionStorage.removeItem('INITIAL_REPORT_DATA');
      } catch (e) {
        // エラーは無視
      }
    }, 0);
    
    // 即時リダイレクト
    setLocation('/');
  };
  
  // モーダル保存成功時の挙動 - 並列処理で高速化
  const handleSuccess = () => {
    // すべてのアクションを並列化
    Promise.all([
      // 1. メインデータのキャッシュ無効化
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-reports"] }),
      
      // 2. 条件付きキャッシュ無効化を遅延なく並列実行
      reportId ? queryClient.invalidateQueries({ queryKey: [`/api/lesson-reports/${reportId}`] }) : Promise.resolve(),
      bookingId ? queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}`] }) : Promise.resolve(),
      
      // 3. データを先に取得しておく
      queryClient.prefetchQuery({ queryKey: ["/api/tutor/bookings"] })
    ]).catch(() => {
      // エラーは無視 - ユーザー体験を優先
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center">
      {loading || isLoadingReport ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium">レポートデータを読み込み中...</p>
        </div>
      ) : !bookingData ? (
        <div className="text-center">
          <p className="text-lg text-red-500 font-medium">レポートデータの読み込みに失敗しました</p>
          <p className="mt-2">ページは自動的にリダイレクトされます</p>
        </div>
      ) : (
        <ReportEditModal
          isOpen={modalOpen}
          booking={bookingData}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}