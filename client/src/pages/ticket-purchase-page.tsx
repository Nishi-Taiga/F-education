import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Ticket, Loader2 } from "lucide-react";
import { TicketCard } from "@/components/ticket-card";
import { Cart } from "@/components/cart";
import { PaymentSuccessModal } from "@/components/payment-success-modal";
import { PaymentModal } from "@/components/PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { Student } from "@shared/schema";

export type CartItem = {
  id: number;
  quantity: number;
  price: number;
  discount: string;
  studentId?: number; // 生徒ID（特定の生徒用のチケットの場合）
  studentName?: string; // 生徒名前（表示用）
};

// 生徒タイプ定義
type StudentType = "elementary" | "elementary_exam" | "junior_high" | "high_school";

// 各タイプと学年の対応
const getStudentType = (grade: string): StudentType => {
  if (grade.includes("小学")) {
    // 受験コースかどうかは別途判定が必要 (今回はUIで選択させる)
    return "elementary";
  } else if (grade.includes("中学")) {
    return "junior_high";
  } else if (grade.includes("高校")) {
    return "high_school";
  }
  // デフォルト
  return "elementary";
};

// チケット価格定義
const ticketPrices = {
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

// 生徒別のチケット情報の型定義
type StudentTicket = {
  studentId: number;
  name: string;
  ticketCount: number;
};

export default function TicketPurchasePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudentType, setSelectedStudentType] = useState<StudentType | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isExamCourse, setIsExamCourse] = useState(false);

  // 生徒一覧を取得
  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });
  
  // 生徒別チケット数を取得
  const { data: studentTickets = [] } = useQuery<StudentTicket[]>({
    queryKey: ["/api/student-tickets"],
  });

  // 生徒が1人しかいない場合は自動選択
  useEffect(() => {
    if (students && students.length === 1) {
      setSelectedStudent(students[0]);
      // 学年から生徒タイプを判定
      let studentType = getStudentType(students[0].grade);
      setSelectedStudentType(studentType);
    }
  }, [students]);

  const purchaseMutation = useMutation({
    mutationFn: async (purchaseData: { items: { studentId: number, quantity: number }[] }) => {
      const res = await apiRequest("POST", "/api/tickets/purchase", purchaseData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student-tickets"] });
      setShowSuccessModal(true);
      setCartItems([]);
    },
  });

  // カートに追加する関数
  const addToCart = (quantity: number) => {
    if (!selectedStudentType || !selectedStudent) return;
    
    // 選択された生徒タイプとチケット枚数に応じた価格を設定
    let studentType = selectedStudentType;
    if (studentType === "elementary" && isExamCourse) {
      studentType = "elementary_exam";
    }
    
    const priceInfo = ticketPrices[studentType][quantity as keyof typeof ticketPrices[typeof studentType]];
    if (!priceInfo) return;
    
    // 生徒情報を含めてカートに追加
    setCartItems([...cartItems, {
      id: Date.now(),
      quantity,
      price: priceInfo.price,
      discount: priceInfo.discount,
      studentId: selectedStudent.id,
      studentName: `${selectedStudent.lastName} ${selectedStudent.firstName}`
    }]);
  };

  const removeFromCart = (id: number) => {
    setCartItems(cartItems.filter(item => item.id !== id));
  };

  // チェックアウト処理（PayPalモーダルを開く）
  const checkout = () => {
    if (cartItems.length === 0) return;
    setShowPaymentModal(true);
  };
  
  // PayPal決済成功時の処理
  const handlePaymentSuccess = (paymentData: any) => {
    // PayPal決済が成功したら、通常のチケット購入処理を実行
    const purchaseItems = cartItems
      .filter(item => item.studentId) // 念のため生徒IDがあるアイテムのみ
      .map(item => ({
        studentId: item.studentId!,
        quantity: item.quantity
      }));
    
    if (purchaseItems.length === 0) return;
    
    // PayPal取引IDをコンソールに出力（開発用）
    console.log("PayPal transaction completed:", paymentData);
    
    // チケット購入APIを呼び出し
    purchaseMutation.mutate({ items: purchaseItems });
    setShowPaymentModal(false);
  };
  
  // PayPal決済エラー時の処理
  const handlePaymentError = (error: any) => {
    console.error("PayPal payment error:", error);
    toast({
      title: "決済エラー",
      description: "支払い処理中にエラーが発生しました。時間をおいて再度お試しください。",
      variant: "destructive",
    });
    setShowPaymentModal(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-1 md:mr-2 h-8 w-8 md:h-10 md:w-10" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h1 className="text-xl md:text-3xl font-bold text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">F education</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">チケット購入</h2>
          <p className="mt-1 text-xs md:text-sm text-gray-600">必要なチケット数を選択して購入してください</p>
        </div>

        <Card className="p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col mb-5 md:mb-6 pb-5 md:pb-6 border-b border-gray-200">
            {/* チケット残数 */}
            {studentTickets.length > 0 && (
              <div className="mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">チケット残数</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {studentTickets.map(ticket => (
                    <div 
                      key={ticket.studentId}
                      className="p-3 md:p-4 border rounded-lg border-gray-200 hover:border-primary hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div className="text-sm md:text-base font-medium">{ticket.name}</div>
                        <div className="text-gray-600 text-xs font-medium">
                          残り {ticket.ticketCount} 枚
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 生徒選択セクション */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">生徒選択</h3>
            
            {isLoadingStudents ? (
              <div className="flex justify-center py-6 md:py-8">
                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
              </div>
            ) : students && students.length > 0 ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                  {students.map((student) => (
                    <div 
                      key={student.id}
                      className={`
                        p-3 md:p-4 border rounded-lg cursor-pointer transition-all
                        ${selectedStudent?.id === student.id 
                          ? 'border-primary bg-primary bg-opacity-5' 
                          : 'border-gray-200 hover:border-primary hover:bg-gray-50'}
                      `}
                      onClick={() => {
                        setSelectedStudent(student);
                        setSelectedStudentType(getStudentType(student.grade));
                        setIsExamCourse(false); // リセット
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="text-sm md:text-base font-medium">{student.lastName} {student.firstName}</div>
                        {'ticketCount' in student && (
                          <div className="text-gray-600 text-xs font-medium">
                            残り {(student as any).ticketCount} 枚
                          </div>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-gray-600 mt-1">{student.grade} ({student.school})</div>
                    </div>
                  ))}
                </div>

                {/* 小学生の場合、受験コースかどうかを選択 */}
                {selectedStudent && selectedStudentType === "elementary" && (
                  <div className="mt-3 md:mt-4 mb-4 md:mb-6">
                    <h4 className="text-xs md:text-sm font-medium mb-1 md:mb-2">コース選択</h4>
                    <div className="flex gap-2 md:gap-4">
                      <Button
                        type="button"
                        variant={!isExamCourse ? "default" : "outline"}
                        onClick={() => setIsExamCourse(false)}
                        className="flex-1 text-xs md:text-sm h-8 md:h-10 px-1 md:px-4"
                      >
                        通常コース
                      </Button>
                      <Button
                        type="button"
                        variant={isExamCourse ? "default" : "outline"}
                        onClick={() => setIsExamCourse(true)}
                        className="flex-1 text-xs md:text-sm h-8 md:h-10 px-1 md:px-4"
                      >
                        中学受験コース
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                生徒が登録されていません。まずは生徒を登録してください。
              </div>
            )}
          </div>

          {selectedStudentType && (
            <>
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">利用可能なチケット</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                {/* チケットの価格と種類は生徒タイプによって変わる */}
                {(() => {
                  // 表示すべきチケット価格テーブルを決定
                  let priceTable = ticketPrices[selectedStudentType];
                  if (selectedStudentType === "elementary" && isExamCourse) {
                    priceTable = ticketPrices.elementary_exam;
                  }
                  
                  // タイプに応じたチケットを表示
                  return Object.entries(priceTable).map(([quantity, details]) => (
                    <TicketCard 
                      key={quantity}
                      title={`${quantity}枚`}
                      price={details.price}
                      description={`${quantity}回分の授業チケット`}
                      discount={details.discount}
                      onAddToCart={() => addToCart(Number(quantity))}
                    />
                  ));
                })()}
              </div>
            </>
          )}

          {/* Cart */}
          <Cart 
            items={cartItems} 
            onRemove={removeFromCart}
            onCheckout={checkout}
            isPending={purchaseMutation.isPending}
          />
        </Card>
      </main>

      {/* PayPalモーダル */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartItems={cartItems}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />
      
      {/* 支払い成功モーダル */}
      <PaymentSuccessModal 
        isOpen={showSuccessModal} 
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/");
        }} 
      />
    </div>
  );
}
