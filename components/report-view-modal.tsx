"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, BookOpen, User, FileText } from "lucide-react";

interface ReportViewModalProps {
  isOpen: boolean;
  booking: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    subject: string;
    studentId: string;
    tutorId: string;
    reportStatus: string | null;
    reportContent: string | null;
    studentName: string;
    tutorName: string;
  };
  onClose: () => void;
  onEdit?: () => void;
}

export function ReportViewModal({
  isOpen,
  booking,
  onClose,
  onEdit
}: ReportViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>授業レポート</DialogTitle>
          <DialogDescription>
            授業内容と進捗の記録
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="font-medium">日付:</span>
              <span className="ml-2">
                {format(new Date(booking.date), 'yyyy年MM月dd日(EEE)', { locale: ja })}
              </span>
            </div>
            
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              <span className="font-medium">時間:</span>
              <span className="ml-2">
                {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
              </span>
            </div>
            
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 mr-2" />
              <span className="font-medium">科目:</span>
              <span className="ml-2">{booking.subject}</span>
            </div>
            
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              <span className="font-medium">生徒:</span>
              <span className="ml-2">{booking.studentName}</span>
            </div>
            
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              <span className="font-medium">講師:</span>
              <span className="ml-2">{booking.tutorName}</span>
            </div>
            
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              <span className="font-medium">レポート状態:</span>
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                booking.reportStatus === 'published' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {booking.reportStatus === 'published' ? '公開中' : '下書き'}
              </span>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">授業内容</h3>
            <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap min-h-[200px]">
              {booking.reportContent || '内容がありません'}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="mr-auto"
            >
              編集する
            </Button>
          )}
          <Button onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}