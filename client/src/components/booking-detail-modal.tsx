import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Booking } from "@shared/schema";
import { FileText, User, Calendar, Clock, BookOpen, MapPin, Phone, History, Edit } from "lucide-react";
import { format } from "date-fns";

interface BookingDetailModalProps {
  isOpen: boolean;
  booking: Booking & { 
    studentName?: string;
    tutorName?: string;
    previousReport?: {
      date: string;
      content: string;
    } | null;
  };
  onClose: () => void;
  onCreateReport?: () => void;
  onViewReport?: () => void;
  onEditReport?: () => void; // レポート編集用コールバック追加
  studentDetails?: {
    lastName: string;
    firstName: string;
    school: string;
    grade: string;
    address?: string;
    phone?: string;
  } | null;
}

export function BookingDetailModal({
  isOpen,
  booking,
  onClose,
  onCreateReport,
  onViewReport,
  onEditReport,
  studentDetails
}: BookingDetailModalProps) {
  // 授業のステータスを判定
  const isCompletedWithReport = booking.reportStatus === 'completed' || (booking.reportStatus && booking.reportStatus.startsWith('completed:'));
  const isCompletedNoReport = booking.reportStatus === 'pending' || booking.reportStatus === null;
  
  // デバッグ情報を追加
  console.log("Booking Detail Debug:", {
    bookingId: booking.id,
    date: booking.date,
    reportStatus: booking.reportStatus,
    hasReportContent: Boolean(booking.reportContent),
    isCompletedWithReport: isCompletedWithReport,
    hasEditCallback: Boolean(onEditReport)
  });
  
  // 日本時間を取得するヘルパー関数
  const getJapanTime = () => {
    const now = new Date();
    // 日本時間（UTC+9）に調整
    return new Date(now.getTime() + (9 * 60 * 60 * 1000));
  };
  
  // 授業が過去のものかどうか確認
  const isPastLesson = () => {
    const japanTime = getJapanTime();
    const todayStr = format(japanTime, 'yyyy-MM-dd');
    return booking.date < todayStr;
  };
  
  // 授業が終了していて、かつ報告書が未作成の場合
  const showCreateReportButton = isPastLesson() && isCompletedNoReport && onCreateReport;
  
  // 報告書が作成済みの場合（保護者側ではボタンを常に表示、講師側では条件付き）
  const showViewReportButton = isCompletedWithReport && onViewReport;
  
  // レポート編集ボタンを表示する条件（講師用）
  // レポートが作成済みかつ編集コールバックが提供されている場合に表示
  const showEditReportButton = isCompletedWithReport && onEditReport;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">授業詳細</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 1. 日付と時間 */}
          <div className="flex items-start">
            <Calendar className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
            <div>
              <p className="font-medium text-gray-900">{booking.date}</p>
              <p className="text-sm text-gray-500">{booking.timeSlot}</p>
            </div>
          </div>
          
          {/* 2. 生徒情報 */}
          {booking.studentName && (
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="font-medium text-gray-900">生徒</p>
                <p className="text-sm text-gray-600">{booking.studentName}</p>
                {studentDetails && (
                  <div className="mt-1 text-xs text-gray-500">
                    <p>{studentDetails.school} {studentDetails.grade}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 3. 科目 */}
          <div className="flex items-start">
            <BookOpen className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
            <div>
              <p className="font-medium text-gray-900">科目</p>
              <p className="text-sm text-gray-600">{booking.subject}</p>
            </div>
          </div>
          
          {/* 講師情報 */}
          {booking.tutorName && (
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="font-medium text-gray-900">講師</p>
                <p className="text-sm text-gray-600">{booking.tutorName}</p>
              </div>
            </div>
          )}
          
          {/* 電話番号 - 講師用のみ表示 */}
          {studentDetails?.phone && (
            <div className="flex items-start">
              <Phone className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="font-medium text-gray-900">電話番号</p>
                <p className="text-sm text-gray-600">{studentDetails.phone}</p>
              </div>
            </div>
          )}
          
          {/* 住所 - 講師用のみ表示 */}
          {studentDetails?.address && (
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="font-medium text-gray-900">住所</p>
                <p className="text-sm text-gray-600">{studentDetails.address}</p>
              </div>
            </div>
          )}
          
          {/* 前回授業のレポート - 授業前は常に表示、授業後で今回のレポートが無い場合も表示 */}
          {(!isPastLesson() || (isPastLesson() && !isCompletedWithReport)) && (
            <div className="flex items-start">
              <History className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="font-medium text-gray-900">前回の授業レポート</p>
                {booking.previousReport ? (
                  <div className="text-sm text-gray-600">
                    <p className="text-xs text-gray-500">{booking.previousReport.date}</p>
                    <div className="bg-gray-50 p-3 rounded-md mt-1 border border-gray-200 max-h-40 overflow-y-auto">
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {booking.previousReport.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">前回のレポートはありません。</p>
                )}
              </div>
            </div>
          )}
          
          {/* レポート状態と内容 - 授業後のみ表示 */}
          {isPastLesson() && (
            <>
              <div className="flex items-start">
                <FileText className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">今回の授業レポート</p>
                  {isCompletedWithReport ? (
                    <p className="text-sm text-green-600 font-medium">作成済み</p>
                  ) : (
                    <p className="text-sm text-red-500 font-medium">未作成</p>
                  )}
                </div>
              </div>
              
              {/* 今回のレポート内容があれば表示（プレビュー） */}
              {isCompletedWithReport && booking.reportContent && (
                <div className="bg-gray-50 p-3 rounded-md mt-2 border border-gray-200">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium text-gray-900">レポート内容</p>
                    {onViewReport && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 flex items-center text-green-600 hover:text-green-700 hover:bg-green-50 -mt-1 -mr-1"
                        onClick={onViewReport}
                      >
                        <span className="text-xs mr-1">詳細</span>
                        <FileText className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 whitespace-pre-line max-h-40 overflow-y-auto">
                    {booking.reportContent}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showCreateReportButton && (
            <Button
              type="button"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onCreateReport}
            >
              <FileText className="mr-2 h-4 w-4" />
              レポート作成
            </Button>
          )}
          
          {showViewReportButton && (
            <Button
              type="button"
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
              onClick={onViewReport}
            >
              <FileText className="mr-2 h-4 w-4" />
              レポート確認
            </Button>
          )}
          
          {showEditReportButton && (
            <Button
              type="button"
              variant="outline"
              className="border-amber-600 text-amber-600 hover:bg-amber-50"
              onClick={onEditReport}
            >
              <Edit className="mr-2 h-4 w-4" />
              レポート編集
            </Button>
          )}
          
          <Button type="button" variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}