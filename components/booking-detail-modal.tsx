"use client";

import { useState } from 'react';
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Clock, BookOpen, User, FileText } from "lucide-react";

interface BookingDetailModalProps {
  isOpen: boolean;
  booking: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
    subject: string;
    studentId: string;
    tutorId: string;
    studentName?: string;
    tutorName?: string;
    reportId?: string | null;
    reportStatus?: string | null;
    reportContent?: string | null;
  };
  onClose: () => void;
  onCancel: () => void;
  onViewReport?: () => void;
  userRole: 'student' | 'parent' | 'tutor' | 'admin';
}

export function BookingDetailModal({
  isOpen,
  booking,
  onClose,
  onCancel,
  onViewReport,
  userRole
}: BookingDetailModalProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  const bookingDate = new Date(booking.date);
  const now = new Date();
  
  // 予約日24時間前かどうかを判定
  const isWithin24Hours = () => {
    const bookingTime = bookingDate.getTime();
    const nowTime = now.getTime();
    return bookingTime - nowTime < 24 * 60 * 60 * 1000;
  };
  
  // キャンセル可能かどうかを判定
  const canCancel = booking.status === 'confirmed' && 
                   (userRole === 'admin' || (!isWithin24Hours() && (userRole === 'parent' || userRole === 'student')));
  
  const isPast = bookingDate < now;
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>予約詳細</DialogTitle>
            <DialogDescription>
              授業の予約詳細情報
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="font-medium">日付:</span>
                <span className="ml-2">
                  {format(bookingDate, 'yyyy年MM月dd日(EEE)', { locale: ja })}
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
                <span className="font-medium">ステータス:</span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  isCancelled 
                    ? 'bg-gray-100 text-gray-800' 
                    : isCompleted 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                }`}>
                  {isCancelled 
                    ? 'キャンセル済' 
                    : isCompleted 
                      ? '完了' 
                      : '予定'}
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between flex-row">
            <div>
              {isCompleted && booking.reportId && onViewReport && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onViewReport();
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  レポートを見る
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
              >
                閉じる
              </Button>
              
              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  キャンセル
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約のキャンセル</AlertDialogTitle>
            <AlertDialogDescription>
              この予約をキャンセルしますか？この操作は取り消せません。
              <p className="font-medium mt-2">
                {format(bookingDate, 'yyyy年MM月dd日(EEE)', { locale: ja })} {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>いいえ</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel}>はい、キャンセルします</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}