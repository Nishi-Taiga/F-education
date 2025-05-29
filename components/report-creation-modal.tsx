"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase/client'; // Supabaseクライアントのインポート
import { useToast } from '@/components/ui/use-toast'; // Toast通知用のuseToastをインポート

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

// 過去の授業データの型定義
interface PastBooking {
  id: number;
  date: string; // YYYY-MM-DD形式で取得される想定
  time_slot: string; // HH:MM - HH:MM形式で取得される想定
  subject: string;
  student_profile: { id: number; last_name: string; first_name: string } | null; // 学生名とIDを取得
}

interface ReportCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorId: number | null; // レポート作成講師のID
  onReportCreated: () => void; // レポート作成後に実行するコールバック（例: 予約リストの再取得）
}

export const ReportCreationModal: React.FC<ReportCreationModalProps> = ({
  isOpen,
  onClose,
  tutorId,
  onReportCreated,
}) => {
  const { toast } = useToast();

  const [pastBookings, setPastBookings] = useState<PastBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<PastBooking | null>(null);
  const [unit, setUnit] = useState('');
  const [message, setMessage] = useState('');
  const [homework, setHomework] = useState('');
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // モーダルが開かれたときに過去の授業を取得
  useEffect(() => {
    if (isOpen && tutorId !== null) {
      const fetchPastBookings = async () => {
        setIsLoadingBookings(true);
        // 今日の日付を取得し、YYYY-MM-DD形式にフォーマット
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            date,
            time_slot,
            subject,
            student_profile (id, last_name, first_name)
          `)
          .eq('tutor_id', tutorId) // 講師でフィルタ
          .lt('date', today) // 本日以前の授業
          .eq('report_status', 'pending') // report_statusが'pending'の授業のみ（レポート未作成相当）
          .order('date', { ascending: false }); // 新しい順にソート

        if (error) {
          console.error('Error fetching past bookings:', error);
          toast({
            title: '過去の授業取得エラー',
            description: `授業リストの読み込みに失敗しました: ${error.message}`,
            variant: 'destructive',
          });
          setPastBookings([]);
        } else {
          console.log('Fetched past bookings:', data);
          setPastBookings(data || []);
        }
        setIsLoadingBookings(false);
      };

      fetchPastBookings();
    }
     // モーダルが閉じられたら状態をリセット
     if (!isOpen) {
        setSelectedBookingId(null);
        setSelectedBooking(null);
        setUnit('');
        setMessage('');
        setHomework('');
        setPastBookings([]); // リストもクリア
     }
  }, [isOpen, tutorId, toast]);

  const handleSaveReport = async () => {
    if (selectedBookingId === null) {
      toast({
        title: '授業が選択されていません',
        description: 'レポートを作成する授業を選択してください。',
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
    
    // 選択された予約がない場合はエラー
    if (!selectedBooking) {
         toast({
           title: '授業情報が見つかりません',
           description: '選択された授業の詳細情報を取得できませんでした。ページを更新して再度お試しください。',
           variant: 'destructive',
         });
         setIsSaving(false);
         return;
    }

    // 1. lesson_reports テーブルにデータを挿入
    const { data: reportData, error: reportError } = await supabase
      .from('lesson_reports')
      .insert([
        {
          booking_id: selectedBookingId,
          tutor_id: tutorId,
          student_id: selectedBooking.student_profile?.id,
          unit_content: unit.trim(),
          message_content: message.trim(),
          goal_content: homework.trim(),
        },
      ])
      .select(); // 挿入されたレポートのIDを取得するためにselect()を使用

    if (reportError) {
      console.error('Error inserting lesson report:', reportError);
      toast({
        title: 'レポート保存エラー',
        description: `レポートの保存に失敗しました: ${reportError.message}`,
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    const newReportId = reportData?.[0]?.id;

    if (!newReportId) {
         console.error('Error: Inserted report ID is null', reportData);
         toast({
            title: 'レポート保存エラー',
            description: 'レポートは保存されましたが、IDの取得に失敗しました。予約との紐付けができませんでした。',
            variant: 'destructive',
          });
          setIsSaving(false);
          // レポートデータ自体は保存されている可能性があるので、手動での対応が必要になる場合がある
          onReportCreated(); // 失敗時もリストを再取得して状態を更新
          onClose();
         return;
    }

    // 2. bookings テーブルの該当レコードを更新 (report_id と report_status)
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({ report_status: 'completed' }) // report_status のみ更新
      .eq('id', selectedBookingId);

    if (bookingUpdateError) {
      console.error('Error updating booking with report_status:', bookingUpdateError);
      toast({
        title: '予約更新エラー',
        description: `レポートは保存されましたが、予約情報の更新に失敗しました: ${bookingUpdateError.message}`,
        variant: 'destructive',
      });
      // この場合もレポートデータ自体は保存されているので、手動対応が必要になる場合がある
    } else {
       toast({
         title: 'レポート作成完了',
         description: '授業レポートが正常に保存されました。',
       });
       console.log('Report saved and booking updated successfully.');
    }

    setIsSaving(false);
    onReportCreated(); // レポート作成成功後に親コンポーネントに通知
    onClose(); // モーダルを閉じる
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新規授業レポート作成</DialogTitle>
          <DialogDescription>
            本日以前に完了した授業のレポートを作成します。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 授業選択ドロップダウン */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lesson" className="text-right">
              授業
            </Label>
            <Select
              onValueChange={(value) => {
                const bookingId = Number(value);
                setSelectedBookingId(bookingId);
                // 選択された予約オブジェクトをpastBookingsから見つけてstateに設定
                const booking = pastBookings.find(b => b.id === bookingId);
                setSelectedBooking(booking || null);
              }}
              value={selectedBookingId !== null ? String(selectedBookingId) : ''}
              disabled={isLoadingBookings || isSaving}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="授業を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingBookings ? (
                    <div className="p-2 text-center text-gray-500">読み込み中...</div>
                ) : pastBookings.length === 0 ? (
                    <div className="p-2 text-center text-gray-500">レポート作成可能な授業はありません</div>
                ) : (
                    pastBookings.map((booking) => {
                       // 日付と時刻を整形
                       const bookingDate = format(new Date(booking.date), 'yyyy/MM/dd (EEE)', { locale: ja });
                       const bookingTime = booking.time_slot.split(' - ')[0];
                       const studentName = booking.student_profile ? `${booking.student_profile.last_name}${booking.student_profile.first_name}` : '不明な生徒';

                       return (
                          <SelectItem key={booking.id} value={String(booking.id)}>
                             {`${bookingDate} ${bookingTime} - ${studentName} (${booking.subject})`}
                          </SelectItem>
                       );
                    })
                )}
              </SelectContent>
            </Select>
          </div>

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
              disabled={isSaving}
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
              disabled={isSaving}
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
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>キャンセル</Button>
          <Button onClick={handleSaveReport} disabled={isSaving || isLoadingBookings || pastBookings.length === 0 || selectedBookingId === null || !unit.trim() || !message.trim() || !homework.trim()}>
             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 