"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { CommonHeader } from "@/components/common-header";

// ダミー生徒データ
const dummyStudents = [
  { id: 1, lastName: "山田", firstName: "太郎", grade: "小学6年", school: "○○小学校", type: "elementary" },
  { id: 2, lastName: "佐藤", firstName: "花子", grade: "中学2年", school: "△△中学校", type: "junior_high" },
];

const ticketPrices = {
  elementary: {
    4: { price: 17600, discount: "4回セット" },
    8: { price: 34200, discount: "8回セット" },
    12: { price: 48600, discount: "12回セット" }
  },
  junior_high: {
    4: { price: 19600, discount: "4回セット" },
    8: { price: 38000, discount: "8回セット" },
    12: { price: 54000, discount: "12回セット" }
  },
};

export default function TicketPurchasePage() {
  const [selectedStudent, setSelectedStudent] = useState(dummyStudents[0]);
  const [selectedCourse, setSelectedCourse] = useState("通常コース");
  const [cartItems, setCartItems] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // 生徒選択時にコース初期化
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    if (student.type === "elementary") {
      setSelectedCourse("通常コース");
    } else {
      setSelectedCourse("");
    }
  };

  // カート追加
  const addToCart = (quantity) => {
    setCartItems([
      ...cartItems,
      {
        id: Date.now(),
        quantity,
        price: ticketPrices[selectedStudent.type][quantity].price,
        discount: ticketPrices[selectedStudent.type][quantity].discount,
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.lastName} ${selectedStudent.firstName}`,
        course: selectedStudent.type === "elementary" ? selectedCourse : undefined,
      },
    ]);
  };
  // カート削除
  const removeFromCart = (id) => {
    setCartItems(cartItems.filter(item => item.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <CommonHeader showBackButton backTo="/dashboard" title="チケット購入" />
      <main className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">チケット購入</h2>
        <Card className="p-4 md:p-6 mb-8">
          {/* 生徒選択 */}
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-semibold mb-3">生徒選択</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {dummyStudents.map((student) => (
                <div
                  key={student.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedStudent.id === student.id ? 'border-primary bg-primary bg-opacity-5' : 'border-gray-200 hover:border-primary hover:bg-gray-50'}`}
                  onClick={() => handleSelectStudent(student)}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm md:text-base font-medium">{student.lastName} {student.firstName}</div>
                  </div>
                  <div className="text-xs md:text-sm text-gray-600 mt-1">{student.grade} ({student.school})</div>
                </div>
              ))}
            </div>
          </div>
          {/* コース選択（小学生のみ） */}
          {selectedStudent.type === "elementary" && (
            <div className="mb-6">
              <h3 className="text-base md:text-lg font-semibold mb-3">コース選択</h3>
              <div className="flex gap-2">
                <Button variant={selectedCourse === "通常コース" ? "default" : "outline"} onClick={() => setSelectedCourse("通常コース")}>通常コース</Button>
                <Button variant={selectedCourse === "受験コース" ? "default" : "outline"} onClick={() => setSelectedCourse("受験コース")}>受験コース</Button>
              </div>
            </div>
          )}
          {/* チケット選択 */}
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-semibold mb-3">チケット選択</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {Object.entries(ticketPrices[selectedStudent.type] as Record<string, {price:number, discount:string}>).map(([quantity, details]) => (
                <div key={quantity} className="border rounded-lg p-4 flex flex-col items-center">
                  <Ticket className="h-8 w-8 text-green-600 mb-2" />
                  <div className="text-lg font-bold mb-1">{quantity}枚</div>
                  <div className="text-gray-700 text-base font-semibold mb-1">{details.price.toLocaleString()}円</div>
                  <div className="text-xs text-gray-500 mb-2">{details.discount}</div>
                  <Button size="sm" onClick={() => addToCart(Number(quantity))}>カートに追加</Button>
                </div>
              ))}
            </div>
          </div>
          {/* カート */}
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-semibold mb-3">カート</h3>
            {cartItems.length === 0 ? (
              <div className="text-gray-400 text-sm">カートに商品がありません</div>
            ) : (
              <div className="space-y-2">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between border rounded px-3 py-2">
                    <div>
                      <div className="font-semibold">{item.studentName} {item.quantity}枚{item.course ? `（${item.course}）` : ''}</div>
                      <div className="text-xs text-gray-500">{item.price.toLocaleString()}円 ({item.discount})</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)}>削除</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 決済ボタン */}
          <div className="flex justify-end">
            <Button onClick={() => setShowModal(true)} disabled={cartItems.length === 0}>購入手続きへ</Button>
          </div>
        </Card>
        {/* 決済モーダル */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
              <h4 className="text-lg font-bold mb-4">購入確認</h4>
              <div className="mb-4">この内容で購入しますか？</div>
              <ul className="mb-4 list-disc list-inside text-sm">
                {cartItems.map(item => (
                  <li key={item.id}>{item.studentName} {item.quantity}枚{item.course ? `（${item.course}）` : ''} - {item.price.toLocaleString()}円</li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>キャンセル</Button>
                <Button onClick={() => setShowModal(false)}>購入（ダミー）</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
