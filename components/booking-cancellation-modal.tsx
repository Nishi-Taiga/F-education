"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { format, parse, addHours } from "date-fns";
import { ja } from "date-fns/locale";

// 予約タイプの定義
type Booking = {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  tutorShiftId?: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string;
  studentName?: string;
};

interface BookingCancellationModalProps {
  isOpen: boolean;
  booking: Booking;
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function BookingCancellationModal({
  isOpen,
  booking,
  onCancel,
  onConfirm,
  isProcessing
}: BookingCancellationModalProps) {
  // 日付をフォーマット
  const formattedDate = booking?.date 
    ? format(parse(booking.date, "yyyy-MM-dd", new Date()), "yyyy年M月d日 (E)", { locale: ja })
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            予約をキャンセルしますか？
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            以下の授業予約をキャンセルします。キャンセルすると、チケットが1枚返却されます。
            <div className="flex items-center mt-2 p-2 bg-amber-50 text-amber-700 rounded-md text-xs">
              <Info className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>授業開始の24時間前を過ぎると、予約のキャンセルができなくなります。（葬儀等の緊急時はLINEにてご連絡ください）</span>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg p-4 my-4 bg-gray-50">
          <div className="mb-2">
            <div className="text-sm text-gray-500">日付</div>
            <div className="font-medium">{formattedDate}</div>
          </div>
          <div className="mb-2">
            <div className="text-sm text-gray-500">時間</div>
            <div className="font-medium">{booking?.timeSlot}</div>
          </div>
          {booking?.subject && (
            <div className="mb-2">
              <div className="text-sm text-gray-500">科目</div>
              <div className="font-medium">{booking.subject}</div>
            </div>
          )}
          {booking?.studentName && (
            <div>
              <div className="text-sm text-gray-500">生徒</div>
              <div className="font-medium">{booking.studentName}</div>
            </div>
          )}
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            キャンセルしない
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              "予約をキャンセルする"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}