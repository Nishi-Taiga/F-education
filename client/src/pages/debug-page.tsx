import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ReportEditModal } from "@/components/report-edit-modal";

// シンプルなデバッグページ
export default function DebugPage() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  
  // テスト用の予約データ（実際に存在する予約IDを使用）
  const testBooking = {
    id: 7, // 実際に存在する予約ID
    userId: user?.id || 3,
    tutorId: 2,
    studentId: 4,
    tutorShiftId: 61,
    date: "2025-05-01",
    timeSlot: "16:00-17:30",
    subject: "小学算数",
    status: "confirmed", 
    reportStatus: "completed",
    reportContent: "【単元】\n割り算の応用問題\n\n【伝言事項】\n基本的な計算はよくできています。\n\n【来週までの目標(課題)】\n教科書p.45-46の問題を解いてみましょう。",
    createdAt: new Date().toISOString(),
    studentName: "テスト 花子"
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