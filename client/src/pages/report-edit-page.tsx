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
        console.log("レポート編集ページ - データ読み込み開始:", { reportId, bookingId });
        
        // 1. セッションストレージから予約データを最初に確認（最も高速）
        const storedBookingData = sessionStorage.getItem('EDIT_BOOKING_DATA');
        const initialReportData = sessionStorage.getItem('INITIAL_REPORT_DATA');
        
        console.log("セッションストレージから取得したデータ:", { 
          hasBookingData: !!storedBookingData, 
          hasReportData: !!initialReportData 
        });
        
        if (storedBookingData) {
          // セッションストレージからデータを読み込む
          const parsedBookingData = JSON.parse(storedBookingData);
          console.log("パース済みの予約データ:", parsedBookingData);
          
          // 初期レポートデータがある場合は予約データに統合
          if (initialReportData) {
            try {
              const parsedReportData = JSON.parse(initialReportData);
              console.log("パース済みの初期レポートデータ:", parsedReportData);
              
              // 予約データにレポートデータが含まれていない場合のみ追加
              if (!parsedBookingData.lessonReport) {
                parsedBookingData.lessonReport = {
                  id: parsedBookingData.lessonReport?.id,
                  bookingId: parsedBookingData.id,
                  tutorId: parsedBookingData.tutorId,
                  studentId: parsedBookingData.studentId,
                  date: parsedBookingData.date,
                  timeSlot: parsedBookingData.timeSlot,
                  ...parsedReportData,
                };
                console.log("レポートデータを統合しました");
              }
            } catch (e) {
              console.error("レポートデータの解析エラー:", e);
            }
          }
          
          // 整形したデータを設定
          setBookingData(parsedBookingData);
          setLoading(false);
          setModalOpen(true);
          console.log("予約データを設定し、モーダルを開きます");
          return; // 早期リターンで後続の処理をスキップ
        }
        
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
        
        // 4. 高速化: レポートIDから予約データを取得
        if (reportId && reportData && typeof reportData === 'object' && 'bookingId' in reportData && reportData.bookingId) {
          try {
            // APIリクエストを開始 - カスタムヘッダーを追加して高速化
            const bookingId = reportData.bookingId;
            const response = await fetch(`/api/bookings/${bookingId}`, {
              headers: { 'X-Priority': 'high' } // 優先度の高いリクエストとしてマーク
            });
            
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
            console.error("レポートからの予約データ取得に失敗:", error);
            throw new Error("レポートに関連付けられた予約データの取得に失敗しました");
          }
        } 
        // 5. 高速化: 予約IDから取得（並列処理）
        else if (bookingId) {
          try {
            // 並列処理で複数のリクエストを同時に実行して高速化
            const [bookingResponse, reportResponse] = await Promise.all([
              fetch(`/api/bookings/${bookingId}`, {
                headers: { 'X-Priority': 'high' } // 優先度の高いリクエストとしてマーク
              }),
              fetch(`/api/lesson-reports/booking/${bookingId}`, {
                headers: { 'X-Priority': 'high' } // 優先度の高いリクエストとしてマーク
              })
            ]);
            
            if (!bookingResponse.ok) {
              throw new Error("予約データの取得に失敗しました");
            }
            
            const booking = await bookingResponse.json();
            
            // レポートデータの処理（存在する場合）
            if (reportResponse.ok) {
              const fetchedReportData = await reportResponse.json();
              if (fetchedReportData) {
                booking.lessonReport = fetchedReportData;
              }
            }
            
            // 初期レポートデータがあり、APIからのレポートがない場合は初期データを使用
            if (!booking.lessonReport && initialReportData) {
              try {
                const initialData = JSON.parse(initialReportData);
                booking.lessonReport = {
                  id: 0, // 新規レポート
                  bookingId: booking.id,
                  tutorId: booking.tutorId,
                  studentId: booking.studentId,
                  unitContent: initialData.unitContent || "",
                  messageContent: initialData.messageContent || "",
                  goalContent: initialData.goalContent || "",
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
              } catch (parseError) {
                // 初期データのパースエラーは無視して続行
              }
            }
            
            // reportContentがあるが、lessonReportがない場合はreportContentから内容を抽出してlessonReportを作成
            if (!booking.lessonReport && booking.reportContent) {
              let unitContent = "";
              let messageContent = "";
              let goalContent = "";
              
              if (booking.reportContent.includes('【単元】')) {
                try {
                  const unitMatch = booking.reportContent.match(/【単元】([\s\S]*?)(?=【伝言事項】)/);
                  const messageMatch = booking.reportContent.match(/【伝言事項】([\s\S]*?)(?=【来週までの目標\(課題\)】)/);
                  const goalMatch = booking.reportContent.match(/【来週までの目標\(課題\)】([\s\S]*)/);
                  
                  unitContent = unitMatch ? unitMatch[1].trim() : "";
                  messageContent = messageMatch ? messageMatch[1].trim() : "";
                  goalContent = goalMatch ? goalMatch[1].trim() : "";
                } catch (e) {
                  unitContent = booking.reportContent;
                }
              } else {
                const parts = booking.reportContent.split("\n");
                unitContent = parts[0] || "";
                messageContent = parts[1] || "";
                goalContent = parts[2] || "";
              }
              
              booking.lessonReport = {
                id: 0,
                bookingId: booking.id,
                tutorId: booking.tutorId,
                studentId: booking.studentId,
                unitContent,
                messageContent,
                goalContent,
                createdAt: new Date(),
                updatedAt: new Date()
              };
            }
            
            setBookingData(booking);
          } catch (error) {
            console.error("予約データ取得エラー:", error);
            throw new Error("予約データの取得に失敗しました");
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
          <div className="p-8 bg-white rounded-lg shadow-md">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">レポート編集画面を表示中...</p>
                <p className="text-sm text-gray-500 mt-2">データを読み込んでいます。しばらくお待ちください。</p>
              </div>
            </div>
          </div>
        </div>
      ) : !bookingData ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
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