"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";

export default function TicketPurchasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<string>("credit_card");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // 料金設定
  const pricePerTicket = 3000; // 1枚あたり3000円
  const discounts = {
    5: 0, // 5枚: 割引なし
    10: 0.05, // 10枚: 5%割引
    20: 0.1, // 20枚: 10%割引
  };

  // ユーザー情報の取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          router.push('/');
          return;
        }
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        setUserId(userData.id);
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, toast]);

  // 数量変更処理
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  // 定義済み数量選択
  const handlePresetQuantity = (value: number) => {
    setQuantity(value);
  };

  // 支払い方法変更
  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value);
  };

  // 割引率を計算
  const getDiscountRate = (qty: number): number => {
    if (qty >= 20) return 0.1;
    if (qty >= 10) return 0.05;
    return 0;
  };

  // 合計金額を計算
  const calculateTotal = (): number => {
    const discountRate = getDiscountRate(quantity);
    const subtotal = quantity * pricePerTicket;
    const discount = subtotal * discountRate;
    return subtotal - discount;
  };

  // 購入処理を開始
  const handlePurchase = () => {
    if (!userId) return;
    setShowPaymentModal(true);
  };

  // 支払い処理
  const processPayment = async () => {
    if (!userId) return;
    
    try {
      setProcessingPayment(true);
      
      // ここに実際の決済処理が入る
      // 実装例のため、3秒後に成功する模擬処理
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 決済成功後、チケットをデータベースに追加
      const { error } = await supabase
        .from('student_tickets')
        .insert([{
          studentId: userId,
          quantity: quantity,
          description: `${quantity}枚チケット購入`,
        }]);
        
      if (error) {
        throw error;
      }
      
      // 支払い取引記録を追加
      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .insert([{
          userId: userId,
          amount: calculateTotal(),
          currency: 'JPY',
          status: 'completed',
          provider: paymentMethod,
          providerTransactionId: `mock-${Date.now()}`,
          ticketsPurchased: quantity,
        }]);
        
      if (transactionError) {
        console.error("取引記録エラー:", transactionError);
      }
      
      setPaymentSuccess(true);
      toast({
        title: "購入完了",
        description: `${quantity}枚のチケットを購入しました。`,
      });
    } catch (error: any) {
      console.error("購入エラー:", error);
      toast({
        title: "購入エラー",
        description: error.message || "チケットの購入に失敗しました",
        variant: "destructive",
      });
      setShowPaymentModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  // 購入完了後の処理
  const handlePaymentComplete = () => {
    setShowPaymentModal(false);
    setPaymentSuccess(false);
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8 max-w-3xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">チケット購入</h1>
        <Button onClick={() => router.push('/dashboard')} variant="outline">戻る</Button>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>チケット購入</CardTitle>
          <CardDescription>
            授業を予約するにはチケットが必要です。チケットをまとめて購入すると割引があります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="quantity" className="text-base">購入枚数</Label>
            <div className="flex items-center space-x-4 mt-2 mb-4">
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={handleQuantityChange}
                className="w-24"
              />
              <span className="text-gray-500">枚</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={quantity === 5 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetQuantity(5)}
              >
                5枚
              </Button>
              <Button
                variant={quantity === 10 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetQuantity(10)}
              >
                10枚 (5%OFF)
              </Button>
              <Button
                variant={quantity === 20 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetQuantity(20)}
              >
                20枚 (10%OFF)
              </Button>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <Label className="text-base">支払い方法</Label>
            <RadioGroup 
              value={paymentMethod} 
              onValueChange={handlePaymentMethodChange}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit_card" id="credit_card" />
                <Label htmlFor="credit_card" className="cursor-pointer">
                  クレジットカード
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                <Label htmlFor="bank_transfer" className="cursor-pointer">
                  銀行振込
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="convenience_store" id="convenience_store" />
                <Label htmlFor="convenience_store" className="cursor-pointer">
                  コンビニ決済
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter className="flex-col">
          <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center border-t pt-4 pb-4">
            <div>
              <p className="text-sm text-gray-500">
                {quantity}枚 × {pricePerTicket.toLocaleString()}円
                {getDiscountRate(quantity) > 0 && (
                  <span className="ml-2">
                    ({(getDiscountRate(quantity) * 100).toFixed(0)}%割引)
                  </span>
                )}
              </p>
              <p className="text-xl font-bold mt-1">
                合計: {calculateTotal().toLocaleString()}円
              </p>
            </div>
            <Button 
              onClick={handlePurchase}
              className="mt-4 md:mt-0"
              disabled={quantity <= 0}
            >
              購入手続きへ
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            ※ご購入いただいたチケットは、購入後1年間有効です。
          </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>チケットについて</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">チケットの使い方</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>1回の授業につき1枚のチケットが必要です</li>
              <li>チケットは生徒ごとに管理されます</li>
              <li>予約時に自動的にチケットが使用されます</li>
              <li>特別な授業では複数枚必要な場合があります</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">キャンセルポリシー</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>授業開始24時間前までのキャンセル: チケット全額返却</li>
              <li>授業開始24時間以内のキャンセル: チケット返却なし</li>
              <li>講師側の都合によるキャンセル: チケット全額返却</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">有効期限</h3>
            <p>チケットは購入日から1年間有効です。有効期限が切れたチケットは使用できなくなりますのでご注意ください。</p>
          </div>
        </CardContent>
      </Card>
      
      {/* 支払いモーダル */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            {paymentSuccess ? (
              <div className="text-center">
                <div className="mb-4 text-green-600">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-16 w-16 mx-auto" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">購入完了</h3>
                <p className="mb-6">
                  {quantity}枚のチケットを購入しました。授業の予約にご利用ください。
                </p>
                <Button 
                  className="w-full" 
                  onClick={handlePaymentComplete}
                >
                  ダッシュボードに戻る
                </Button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-4">支払い手続き</h3>
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-md">
                    <p className="font-medium">購入内容</p>
                    <p>チケット {quantity}枚</p>
                    <p className="text-lg font-semibold mt-2">
                      合計: {calculateTotal().toLocaleString()}円
                    </p>
                  </div>
                  
                  {paymentMethod === "credit_card" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="card_number">カード番号</Label>
                        <Input 
                          id="card_number" 
                          placeholder="1234 5678 9012 3456" 
                          disabled={processingPayment}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiry">有効期限</Label>
                          <Input 
                            id="expiry" 
                            placeholder="MM/YY" 
                            disabled={processingPayment}
                          />
                        </div>
                        <div>
                          <Label htmlFor="cvc">CVC</Label>
                          <Input 
                            id="cvc" 
                            placeholder="123" 
                            disabled={processingPayment}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="card_name">カード名義</Label>
                        <Input 
                          id="card_name" 
                          placeholder="TARO YAMADA" 
                          disabled={processingPayment}
                        />
                      </div>
                    </div>
                  )}
                  
                  {paymentMethod === "bank_transfer" && (
                    <div className="space-y-2">
                      <p className="font-medium">振込先情報</p>
                      <p>銀行名: F-教育銀行</p>
                      <p>支店名: 渋谷支店（123）</p>
                      <p>口座種別: 普通</p>
                      <p>口座番号: 1234567</p>
                      <p>口座名義: エフエデュケーション</p>
                      <p className="text-sm text-gray-500 mt-2">
                        ※お振込み後、確認までに1営業日ほどかかる場合があります。
                      </p>
                    </div>
                  )}
                  
                  {paymentMethod === "convenience_store" && (
                    <div className="space-y-2">
                      <p>コンビニ決済を選択すると、支払い用の番号が発行されます。</p>
                      <p className="text-sm text-gray-500">
                        ※お支払い後、確認までに数時間かかる場合があります。
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={processingPayment}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={processPayment}
                    disabled={processingPayment}
                  >
                    {processingPayment ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        処理中...
                      </span>
                    ) : (
                      "支払いを確定"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
