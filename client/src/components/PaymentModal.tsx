import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import PayPalButton from "@/components/PayPalButton";
import type { CartItem } from "@/pages/ticket-purchase-page";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onPaymentSuccess: (transactionData?: any) => void;
  onPaymentError: (error: any) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  cartItems,
  onPaymentSuccess,
  onPaymentError
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // カートの合計金額を計算
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
  
  // 商品詳細情報
  const itemDetails = cartItems.map(item => 
    `チケット${item.quantity}枚 (${item.studentName ? `${item.studentName}用` : ''})`
  ).join(', ');
  
  // PayPal支払い成功時の処理
  const handlePaymentSuccess = (data: any) => {
    setIsProcessing(false);
    onPaymentSuccess(data);
  };
  
  // PayPal支払いエラー時の処理
  const handlePaymentError = (error: any) => {
    setIsProcessing(false);
    onPaymentError(error);
    console.error("PayPal payment error:", error);
  };
  
  // PayPal支払いキャンセル時の処理
  const handlePaymentCancel = () => {
    setIsProcessing(false);
    console.log("PayPal payment cancelled");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle className="text-center text-xl font-semibold mb-4">お支払い</DialogTitle>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <div className="font-medium text-gray-700">注文内容</div>
            <div className="text-sm text-gray-600 mt-1">
              {itemDetails}
            </div>
          </div>
          
          <div className="py-2">
            <div className="flex justify-between mb-4">
              <span className="font-medium">合計金額</span>
              <span className="font-bold text-lg">¥{totalAmount.toLocaleString()}</span>
            </div>
            
            {isProcessing ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <PayPalButton
                  amount={totalAmount.toString()}
                  currency="JPY"
                  intent="CAPTURE"
                  description={`F education - チケット購入 (${cartItems.length}件)`}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={handlePaymentCancel}
                />
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onClose}
                >
                  キャンセル
                </Button>
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            安全な決済のために、お支払い情報は直接PayPalに送信され、当サイトでは保存されません。
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}