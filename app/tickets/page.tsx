"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { CommonHeader } from "@/components/common-header";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Replit版のticketPricesを流用
const ticketPrices: Record<string, Record<number, { price: number; discount: string }>> = {
  elementary: {
    4: { price: 17600, discount: "4回セット" },
    8: { price: 34200, discount: "8回セット" },
    12: { price: 48600, discount: "12回セット" }
  },
  elementary_exam: {
    4: { price: 19600, discount: "4回セット" },
    8: { price: 38000, discount: "8回セット" },
    12: { price: 54000, discount: "12回セット" }
  },
  junior_high: {
    4: { price: 19600, discount: "4回セット" },
    8: { price: 38000, discount: "8回セット" },
    12: { price: 54000, discount: "12回セット" }
  },
  high_school: {
    4: { price: 21600, discount: "4回セット" },
    8: { price: 41800, discount: "8回セット" },
    12: { price: 59400, discount: "12回セット" }
  }
};

function getStudentType(grade) {
  if (grade.includes("小学")) return "elementary";
  if (grade.includes("中学")) return "junior_high";
  if (grade.includes("高校")) return "high_school";
  return "elementary";
}

export default function TicketPurchasePage() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState("通常コース");
  const [cartItems, setCartItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [parentId, setParentId] = useState(null);
  const router = useRouter();

  // 生徒・チケット残数をSupabaseから取得
  useEffect(() => {
    const fetchStudents = async () => {
      // 認証情報からparent_profile取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: parent, error: parentError } = await supabase
        .from('parent_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      if (parentError || !parent) return;
      setParentId(parent.id);
      // 生徒取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_profile')
        .select('*')
        .eq('parent_id', parent.id);
      if (studentsError || !studentsData) return;
      // 各生徒のチケット残数取得
      const studentsWithTickets = await Promise.all(studentsData.map(async student => {
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('student_tickets')
          .select('quantity')
          .eq('student_id', student.id);
        return {
          ...student,
          type: getStudentType(student.grade),
          ticketCount: ticketsError || !ticketsData ? 0 : ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0)
        };
      }));
      setStudents(studentsWithTickets);
      // デフォルト選択
      if (studentsWithTickets.length > 0) setSelectedStudent(studentsWithTickets[0]);
    };
    fetchStudents();
  }, []);

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
    let priceKey = selectedStudent.type;
    if (selectedStudent.type === "elementary" && selectedCourse === "受験コース") {
      priceKey = "elementary_exam";
    }
    setCartItems([
      ...cartItems,
      {
        id: Date.now(),
        quantity,
        price: ticketPrices[priceKey as keyof typeof ticketPrices][quantity as keyof typeof ticketPrices[typeof priceKey]].price,
        discount: ticketPrices[priceKey as keyof typeof ticketPrices][quantity as keyof typeof ticketPrices[typeof priceKey]].discount,
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.last_name} ${selectedStudent.first_name}`,
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
              {students.map((student) => (
                <div
                  key={student.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all 
                    ${selectedStudent && selectedStudent.id === student.id ? 'border-blue-500 bg-blue-50 shadow' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}
                  onClick={() => handleSelectStudent(student)}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm md:text-base font-medium">{student.last_name} {student.first_name}</div>
                    <div className="text-gray-600 text-xs font-medium">残り {student.ticketCount} 枚</div>
                  </div>
                  <div className="text-xs md:text-sm text-gray-600 mt-1">{student.grade} ({student.school})</div>
                </div>
              ))}
            </div>
          </div>
          {/* コース選択（小学生のみ） */}
          {selectedStudent && selectedStudent.type === "elementary" && (
            <div className="mb-6">
              <h3 className="text-base md:text-lg font-semibold mb-3">コース選択</h3>
              <div className="flex gap-2">
                <Button variant={selectedCourse === "通常コース" ? "default" : "outline"} 
                  className={selectedCourse === "通常コース" ? "bg-blue-500 text-white border-blue-500" : ""}
                  onClick={() => setSelectedCourse("通常コース")}>通常コース</Button>
                <Button variant={selectedCourse === "受験コース" ? "default" : "outline"} 
                  className={selectedCourse === "受験コース" ? "bg-blue-500 text-white border-blue-500" : ""}
                  onClick={() => setSelectedCourse("受験コース")}>受験コース</Button>
              </div>
            </div>
          )}
          {/* チケット選択 */}
          {selectedStudent && (
            <div className="mb-6">
              <h3 className="text-base md:text-lg font-semibold mb-3">チケット選択</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {(() => {
                  let priceKey = selectedStudent.type;
                  if (selectedStudent.type === "elementary" && selectedCourse === "受験コース") {
                    priceKey = "elementary_exam";
                  }
                  return Object.entries(ticketPrices[priceKey]).map(([quantity, details]) => (
                    <div key={quantity}
                      className={`border rounded-lg p-4 flex flex-col items-center transition-all cursor-pointer 
                        ${cartItems.some(item => item.quantity === Number(quantity) && item.studentId === selectedStudent.id && (item.course === selectedCourse || selectedStudent.type !== 'elementary')) 
                          ? 'border-blue-500 bg-blue-50 shadow' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}
                      onClick={() => addToCart(Number(quantity))}
                    >
                      <Ticket className="h-8 w-8 text-green-600 mb-2" />
                      <div className="text-lg font-bold mb-1">{quantity}枚</div>
                      <div className="text-gray-700 text-base font-semibold mb-1">{(details as {price:number,discount:string}).price.toLocaleString()}円</div>
                      <div className="text-xs text-gray-500 mb-2">{(details as {price:number,discount:string}).discount}</div>
                      <Button size="sm" onClick={e => { e.stopPropagation(); addToCart(Number(quantity)); }}>
                        カートに追加
                      </Button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
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
                <Button 
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={isPurchasing}
                  onClick={async () => {
                    setIsPurchasing(true);
                    try {
                      // 複数生徒・複数チケット対応
                      for (const item of cartItems) {
                        const { error: insertError } = await supabase.from('student_tickets').insert({
                          student_id: item.studentId,
                          parent_id: parentId,
                          quantity: item.quantity,
                        });
                        if (insertError) throw insertError;
                      }

                      setShowModal(false);
                      setCartItems([]);
                      router.push("/dashboard");
                    } catch (e) {
                      // エラー詳細をコンソールとアラートに出力
                      console.error("購入処理エラー:", e);
                      if (e && e.message) {
                        alert("購入処理に失敗しました: " + e.message);
                      } else if (e && e.error) {
                        alert("購入処理に失敗しました: " + JSON.stringify(e.error));
                      } else {
                        alert("購入処理に失敗しました: " + JSON.stringify(e));
                      }
                    } finally {
                      setIsPurchasing(false);
                    }
                  }}
                >
                  {isPurchasing ? "購入中..." : "購入"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
