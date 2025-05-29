"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// レポート作成済み授業データの型定義 (編集用)
interface ReportedBooking {
  id: number; // Booking ID
  date: string; // YYYY-MM-DD
  time_slot: string; // HH:MM - HH:MM
  subject: string;
  student_profile: { id: number; last_name: string; first_name: string } | null;
  lesson_reports: { // レポートデータ
      id: number;
      unit_content: string;
      message_content: string;
      goal_content: string;
  }[] | null; // 予約に紐づくレポート (通常は1つ)
}

interface ReportEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorId: number | null; // レポート編集講師のID
  onReportUpdated: () => void; // レポート更新後に実行するコールバック
}

export const ReportEditModal: React.FC<ReportEditModalProps> = ({
  isOpen,
  onClose,
  tutorId,
  onReportUpdated,
}) => {
  const { toast } = useToast();

  const [reportedBookings, setReportedBookings] = useState<ReportedBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [currentReportId, setCurrentReportId] = useState<number | null>(null); // 編集対象のレポートID
  const [unit, setUnit] = useState('');
  const [message, setMessage] = useState('');
  const [homework, setHomework] = useState('');
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false); // 個別レポート読み込み中
  const [isSaving, setIsSaving] = useState(false);

  // モーダルが開かれたときにレポート作成済み授業を取得
  useEffect(() => {
    if (isOpen && tutorId !== null) {
      const fetchReportedBookings = async () => {
        setIsLoadingBookings(true);

        // report_statusが'completed'の授業（レポート作成済み相当）を取得
        // lesson_reports を同時にフェッチしてレポート内容も取得
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            date,
            time_slot,
            subject,
            student_profile (id, last_name, first_name),
            lesson_reports (id, unit_content, message_content, goal_content)
          `)
          .eq('tutor_id', tutorId) // 講師でフィルタ
          .eq('report_status', 'completed') // レポート作成済み
          .order('date', { ascending: false }); // 新しい順にソート

        if (error) {
          console.error('Error fetching reported bookings:', error);
          toast({
            title: '過去レポート取得エラー',
            description: `レポート済み授業リストの読み込みに失敗しました: ${error.message}`,
            variant: 'destructive',
          });
          setReportedBookings([]);
        } else {
          console.log('Fetched reported bookings:', data);
          // レポートデータがある予約のみをフィルタリング
          const bookingsWithReports = data.filter(b => b.lesson_reports && b.lesson_reports.length > 0);
          setReportedBookings(bookingsWithReports || []);
        }
        setIsLoadingBookings(false);
      };

      fetchReportedBookings();
    }
     // モーダルが閉じられたら状態をリセット
     if (!isOpen) {
        setSelectedBookingId(null);
        setCurrentReportId(null);
        setUnit('');
        setMessage('');
        setHomework('');
        setReportedBookings([]); // リストもクリア
        setIsLoadingReport(false);
        setIsSaving(false);
     }
  }, [isOpen, tutorId, toast]);

  // 授業選択時の処理
  const handleBookingSelect = (bookingId: string) => {
    const id = Number(bookingId);
    setSelectedBookingId(id);
    const selectedBooking = reportedBookings.find(b => b.id === id);

    if (selectedBooking && selectedBooking.lesson_reports && selectedBooking.lesson_reports.length > 0) {
      const report = selectedBooking.lesson_reports[0]; // 1つの予約にレポートは1つを想定
      setCurrentReportId(report.id);
      setUnit(report.unit_content || '');
      setMessage(report.message_content || '');
      setHomework(report.goal_content || '');
    } else {
       // レポートが見つからない、またはデータがおかしい場合
       setCurrentReportId(null);
       setUnit('');
       setMessage('');
       setHomework('');
       console.error('Selected booking has no report data:', selectedBooking);
       toast({
         title: 'レポート情報が見つかりません',
         description: '選択された授業に紐づくレポートが見つかりませんでした。',
         variant: 'destructive',
       });
    }
  };

  // レポート上書き保存処理
  const handleUpdateReport = async () => {
    if (currentReportId === null || selectedBookingId === null) {
      toast({
        title: '編集対象が選択されていません',
        description: '編集するレポートを選択してください。',
        variant: 'destructive',
      });
      return;
    }

     if (!unit.trim() || !message.trim() || !homework.trim()) {
          toast({
            title: '入力不足',
            description: '単元、伝言事項、来週までの課題を全て入力してください。',
            variant: 'destructive',
          });
          return;
     }

    setIsSaving(true);
    setIsLoadingReport(true); // 保存中もレポート部分は操作不可に

    const { error } = await supabase
      .from('lesson_reports')
      .update({
        unit_content: unit.trim(),
        message_content: message.trim(),
        goal_content: homework.trim(),
        updated_at: new Date().toISOString(), // 更新日時を記録
      })
      .eq('id', currentReportId);

    if (error) {
      console.error('Error updating lesson report:', error);
      toast({
        title: 'レポート更新エラー',
        description: `レポートの更新に失敗しました: ${error.message}`,
        variant: 'destructive',
      });
    } else {
       toast({
         title: 'レポート更新完了',
         description: '授業レポートが正常に更新されました。',
       });
       console.log('Report updated successfully.');
    }

    setIsSaving(false);
    setIsLoadingReport(false);
    onReportUpdated(); // レポート更新成功後に親コンポーネントに通知
    onClose(); // モーダルを閉じる
  };

  // 選択された予約がまだ読み込まれていない場合に備える
  const selectedBooking = reportedBookings.find(b => b.id === selectedBookingId);
  const isReportLoadedAndSelected = currentReportId !== null && selectedBookingId !== null;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>授業レポート編集</DialogTitle>
          <DialogDescription>
            作成済みの授業レポートを編集します。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 授業選択ドロップダウン */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lesson" className="text-right">
              授業
            </Label>
            <Select
              onValueChange={handleBookingSelect}
              value={selectedBookingId !== null ? String(selectedBookingId) : ''}
              disabled={isLoadingBookings || isSaving}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="編集するレポートを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingBookings ? (
                    <div className="p-2 text-center text-gray-500">読み込み中...</div>
                ) : reportedBookings.length === 0 ? (
                    <div className="p-2 text-center text-gray-500">編集可能なレポートはありません</div>
                ) : (
                    reportedBookings.map((booking) => {
                       // 日付と時刻を整形
                       const bookingDate = format(new Date(booking.date), 'yyyy/MM/dd (EEE)', { locale: ja });
                       const bookingTime = booking.time_slot.split(' - ')[0];
                       const studentName = booking.student_profile ? `${booking.student_profile.last_name}${booking.student_profile.first_name}` : '不明な生徒';

                       return (
                          // レポートデータが存在するbookingのみSelectItemをレンダリング
                          booking.lesson_reports && booking.lesson_reports.length > 0 && (
                             <SelectItem key={booking.id} value={String(booking.id)}>
                                {`${bookingDate} ${bookingTime} - ${studentName} (${booking.subject})`}
                             </SelectItem>
                          )
                       );
                    })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* レポート記入欄（授業選択後に表示・編集可能にする） */}
          {selectedBookingId !== null && (
             <>
                {isLoadingReport ? (
                   <div className="text-center col-span-4">レポート読み込み中...</div>
                ) : !isReportLoadedAndSelected ? (
                    <div className="text-center col-span-4 text-gray-500">授業を選択してください</div>
                ) : (
                    <>
                        {/* 単元入力 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="unit" className="text-right">
                            単元
                          </Label>
                          <Textarea
                            id="unit"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="col-span-3"
                            placeholder="例：図形、二次関数、Reading Comprehension"
                            disabled={isSaving || isLoadingReport}
                          />
                        </div>

                        {/* 伝言事項入力 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="message" className="text-right">
                            伝言事項
                          </Label>
                          <Textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="col-span-3"
                            placeholder="保護者の方への伝達事項を記入してください"
                            disabled={isSaving || isLoadingReport}
                          />
                        </div>

                        {/* 来週までの課題入力 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="homework" className="text-right">
                            来週までの課題
                          </Label>
                          <Textarea
                            id="homework"
                            value={homework}
                            onChange={(e) => setHomework(e.target.value)}
                            className="col-span-3"
                            placeholder="次回の授業までに取り組む課題を記入してください"
                            disabled={isSaving || isLoadingReport}
                          />
                        </div>
                    </>
                 )}
             </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>キャンセル</Button>
          <Button onClick={handleUpdateReport} disabled={isSaving || isLoadingBookings || !isReportLoadedAndSelected || !unit.trim() || !message.trim() || !homework.trim()}>
             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            上書き
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 