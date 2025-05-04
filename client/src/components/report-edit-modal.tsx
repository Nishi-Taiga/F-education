import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, CalendarDays, BookOpen, Loader2, AlertTriangle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Booking } from "@shared/schema";

interface ReportEditModalProps {
  isOpen: boolean;
  booking: Booking & { studentName?: string; tutorName?: string };
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportEditModal({
  isOpen,
  booking,
  onClose,
  onSuccess
}: ReportEditModalProps) {
  // デバッグ情報の出力
  console.log("レポート編集モーダルが呼び出されました", { isOpen, bookingId: booking?.id });
  
  // 強制的に表示するためのテスト
  useEffect(() => {
    if (isOpen) {
      console.log("レポート編集モーダルが開きました", booking);
    }
  }, [isOpen, booking]);
  const { toast } = useToast();
  const [unitContent, setUnitContent] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [goalContent, setGoalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 日付をフォーマット（無効な日付値のエラー処理を追加）
  let formattedDate = "日付不明";
  try {
    if (booking.date && booking.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
      if (!isNaN(dateObj.getTime())) {
        formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
      }
    }
  } catch (error) {
    console.error("Invalid date format:", booking.date);
  }

  // マウント時に既存のレポート内容を解析して各フィールドに設定する
  // 予約情報のデバッグ出力
  useEffect(() => {
    console.log("ReportEditModal - 受け取った予約情報:", booking);
  }, [booking]);

  // レポートコンテンツが更新されたら、各テキストエリアを更新
  useEffect(() => {
    console.log("レポート内容を解析します:", booking.reportContent);
    
    if (booking.reportContent) {
      if (booking.reportContent.includes('【単元】')) {
        // 新フォーマットの場合
        try {
          console.log("新フォーマットのレポートを検出しました");
          const unitPart = booking.reportContent.split('【単元】')[1].split('【伝言事項】')[0].trim();
          const messagePart = booking.reportContent.split('【伝言事項】')[1].split('【来週までの目標(課題)】')[0].trim();
          const goalPart = booking.reportContent.split('【来週までの目標(課題)】')[1].trim();
          
          console.log("パースしたコンテンツ:", { unitPart, messagePart, goalPart });
          
          setUnitContent(unitPart);
          setMessageContent(messagePart);
          setGoalContent(goalPart);
        } catch (e) {
          // 解析に失敗した場合は、全てをユニットコンテンツに設定
          console.error("レポート解析エラー:", e);
          setUnitContent(booking.reportContent);
        }
      } else {
        // 古いフォーマットの場合
        console.log("古いフォーマットのレポートを検出しました");
        const parts = booking.reportContent.split("\n");
        if (parts.length >= 1) setUnitContent(parts[0]);
        if (parts.length >= 2) setMessageContent(parts[1]);
        if (parts.length >= 3) setGoalContent(parts[2]);
      }
    } else {
      console.log("レポート内容がありません");
      // レポート内容がない場合は空にする
      setUnitContent("");
      setMessageContent("");
      setGoalContent("");
    }
  }, [booking.reportContent]);

  // レポート保存のミューテーション
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      // 入力チェック
      if (!unitContent.trim() && !messageContent.trim() && !goalContent.trim()) {
        throw new Error("少なくとも1つの項目を入力してください");
      }

      const response = await fetch(`/api/bookings/${booking.id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unit: unitContent,
          message: messageContent,
          goal: goalContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "レポートの保存に失敗しました");
      }

      return await response.json();
    },
    onMutate: () => {
      setIsSaving(true);
    },
    onSuccess: () => {
      toast({
        title: "レポートを更新しました",
        description: "レポート内容が正常に保存されました",
      });

      // データを再取得してUIを更新
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      
      setIsSaving(false);
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "レポートの保存に失敗しました",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveReportMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>レポート編集</DialogTitle>
          <DialogDescription>
            {formattedDate} {booking.timeSlot}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 基本情報 */}
          <div className="space-y-2 bg-gray-50 p-3 rounded-md">
            {/* 日時 */}
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">日時:</span>
              <span className="text-sm ml-2">{formattedDate} {booking.timeSlot}</span>
            </div>
            
            {/* 生徒名 */}
            <div className="flex items-center">
              <User className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">生徒:</span>
              <span className="text-sm ml-2">{booking.studentName || `生徒ID: ${booking.studentId}`}</span>
            </div>
            
            {/* 科目 */}
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">科目:</span>
              <span className="text-sm ml-2">{booking.subject}</span>
            </div>
          </div>
          
          {/* 警告メッセージ */}
          <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md flex items-start">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm text-yellow-700">
              このレポートは既に保存されています。編集内容は上書き保存されます。
            </p>
          </div>

          {/* レポート編集フォーム */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit">単元</Label>
              <Textarea
                id="unit"
                value={unitContent}
                onChange={(e) => setUnitContent(e.target.value)}
                placeholder="授業で扱った単元・内容"
                className="min-h-[80px]"
              />
            </div>
            
            <div>
              <Label htmlFor="message">伝言事項</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="保護者への伝言（褒めたいこと、改善点など）"
                className="min-h-[80px]"
              />
            </div>
            
            <div>
              <Label htmlFor="goal">来週までの目標(課題)</Label>
              <Textarea
                id="goal"
                value={goalContent}
                onChange={(e) => setGoalContent(e.target.value)}
                placeholder="次回までの目標または宿題"
                className="min-h-[80px]"
              />
            </div>
          </div>
        
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button 
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存する"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}