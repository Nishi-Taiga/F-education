import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ReportEditModal } from "@/components/report-edit-modal";

// シンプルなデバッグページ
export default function DebugPage() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  
  // テスト用の予約データ（最小限のフィールドのみ）
  const testBooking = {
    id: 999,
    userId: user?.id || 3,
    tutorId: 2,
    studentId: 4,
    tutorShiftId: 46,
    date: "2025-05-06",
    timeSlot: "16:00-17:30",
    subject: "テスト科目",
    status: "confirmed", 
    reportStatus: "completed",
    reportContent: "【単元】\nテスト単元\n\n【伝言事項】\nテストメッセージ\n\n【来週までの目標(課題)】\nテスト目標",
    createdAt: new Date().toISOString(),
    studentName: "テスト生徒"
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-center mb-8">レポート編集 デバッグページ</h1>
      
      <div className="flex justify-center mb-8">
        <Button 
          size="lg"
          className="bg-red-500 hover:bg-red-600 text-white text-xl p-8"
          onClick={() => {
            console.log("デバッグボタンがクリックされました");
            setShowModal(true);
          }}
        >
          レポート編集モーダルを表示
        </Button>
      </div>
      
      <div className="text-center text-gray-500">
        <p>このページはレポート編集モーダルのデバッグ用です</p>
        <p>上のボタンをクリックするとモーダルが表示されます</p>
      </div>
      
      {/* レポート編集モーダル */}
      <ReportEditModal
        isOpen={showModal}
        booking={testBooking}
        onClose={() => {
          console.log("モーダルを閉じます");
          setShowModal(false);
        }}
        onSuccess={() => {
          console.log("レポート保存成功");
          setShowModal(false);
        }}
      />
    </div>
  );
}