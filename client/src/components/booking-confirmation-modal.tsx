import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, User } from "lucide-react";

interface BookingConfirmationModalProps {
  isOpen: boolean;
  bookings: Array<{
    date: string;
    formattedDate: string;
    timeSlot: string;
    studentId?: number;
    studentName?: string;
    subject?: string;
  }>;
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function BookingConfirmationModal({
  isOpen,
  bookings,
  onCancel,
  onConfirm,
  isProcessing
}: BookingConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>予約確認</DialogTitle>
          <DialogDescription>
            以下の授業を予約します。よろしいですか？
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 my-4">
          {bookings.map((booking, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-md">
              <div className="font-medium">{booking.formattedDate}</div>
              <div className="text-sm text-gray-600">{booking.timeSlot}</div>
              {booking.subject && (
                <div className="text-sm text-gray-600 mt-1">
                  科目: <span className="font-medium">{booking.subject}</span>
                </div>
              )}
              {!booking.subject && (
                <div className="mt-1 text-xs text-amber-600">
                  科目が選択されていません
                </div>
              )}
              {booking.studentName && (
                <div className="flex items-center mt-2 text-sm text-primary">
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  <span>{booking.studentName}</span>
                </div>
              )}
              {!booking.studentName && (
                <div className="mt-2 text-xs text-amber-600">
                  生徒が選択されていません
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                予約の確定後はチケット{bookings.length}枚を消費します。
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            キャンセル
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              "確定する"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
