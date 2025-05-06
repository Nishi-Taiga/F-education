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
    // 初期データ取得を試みる
    const tryLoadInitialData = async () => {
      console.log("レポート編集ページが初期化されました");
      
      try {
        // セッションストレージから予約データを取得
        const storedBookingData = sessionStorage.getItem('EDIT_BOOKING_DATA');
        if (storedBookingData) {
          console.log("セッションストレージから予約データを読み込みました");
          setBookingData(JSON.parse(storedBookingData));
        }
        
        // 初期レポートデータがあれば取得 (新規作成時のみ)
        const initialReportData = sessionStorage.getItem('INITIAL_REPORT_DATA');
        
        // 必要な情報がセッションストレージにない場合
        if (!storedBookingData && (!reportId || !reportData) && !bookingId) {
          toast({
            title: "エラー",
            description: "編集するレポートデータが見つかりません。レポート一覧に戻ります。",
            variant: "destructive",
          });
          setTimeout(() => setLocation('/'), 1500);
          return;
        }
        
        // 予約データがない場合はAPIから取得（reportIdまたはbookingIdがある場合）
        if (!storedBookingData && (reportId || bookingId)) {
          console.log("APIから予約データを取得します");
          
          if (reportId && reportData && typeof reportData === 'object' && 'bookingId' in reportData && reportData.bookingId) {
            // レポートIDからAPIで予約データを取得
            const response = await fetch(`/api/bookings/${reportData.bookingId}`);
            if (response.ok) {
              const booking = await response.json();
              console.log("レポートIDから予約データを取得しました", booking);
              setBookingData({
                ...booking,
                lessonReport: reportData
              });
            } else {
              throw new Error("予約データの取得に失敗しました");
            }
          } 
          else if (bookingId) {
            // 予約IDからAPIで予約データを取得
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
              const booking = await response.json();
              console.log("予約IDから予約データを取得しました", booking);
              
              // 初期レポートデータがあれば追加
              if (initialReportData) {
                const initialData = JSON.parse(initialReportData);
                booking.lessonReport = {
                  id: 0,
                  bookingId: booking.id,
                  tutorId: booking.tutorId,
                  studentId: booking.studentId,
                  ...initialData,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
              }
              
              setBookingData(booking);
            } else {
              throw new Error("予約データの取得に失敗しました");
            }
          }
        }
        
        // データ取得完了、モーダルを表示
        setLoading(false);
        setModalOpen(true);
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "レポートデータの読み込みに失敗しました。",
          variant: "destructive",
        });
        setTimeout(() => setLocation('/'), 1500);
      }
    };
    
    tryLoadInitialData();
  }, [reportId, bookingId, reportData, toast, setLocation]);
  
  // モーダルを閉じたときの挙動
  const handleClose = () => {
    console.log("レポート編集モーダルが閉じられました");
    // マイページにリダイレクト
    setLocation('/');
    
    // セッションストレージのクリーンアップ
    try {
      sessionStorage.removeItem('EDIT_BOOKING_DATA');
      sessionStorage.removeItem('INITIAL_REPORT_DATA');
    } catch (e) {
      console.error("セッションストレージのクリーンアップに失敗", e);
    }
  };
  
  // モーダル保存成功時の挙動
  const handleSuccess = () => {
    console.log("レポートが正常に保存されました");
    
    // 確実にマイページのデータが更新されるよう、全ての関連クエリを無効化
    try {
      // 全てのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-reports"] });
      
      // 個別のレポートIDに対するキャッシュも無効化
      if (reportId) {
        queryClient.invalidateQueries({ queryKey: [`/api/lesson-reports/${reportId}`] });
      }
      
      // 個別の予約IDに対するキャッシュも無効化
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}`] });
      }
    } catch (e) {
      console.error("クエリキャッシュの更新エラー:", e);
    }
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