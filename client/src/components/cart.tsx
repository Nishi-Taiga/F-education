import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import type { CartItem } from "@/pages/ticket-purchase-page";

interface CartProps {
  items: CartItem[];
  onRemove: (id: number) => void;
  onCheckout: () => void;
  isPending: boolean;
}

export function Cart({ items, onRemove, onCheckout, isPending }: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">カート</h3>
      <div className="space-y-2 mb-4">
        {items.length === 0 ? (
          <p className="text-gray-500 italic">カートは空です</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
              <div>
                <span className="font-medium">チケット {item.quantity}枚{item.discount}</span>
                {item.studentName && (
                  <div className="text-xs text-gray-500">
                    {item.studentName}用
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <span className="mr-4">¥{item.price.toLocaleString()}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                  onClick={() => onRemove(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between mb-2">
          <span className="font-medium">小計</span>
          <span>¥{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span className="font-medium">合計</span>
          <span className="font-bold text-lg">¥{subtotal.toLocaleString()}</span>
        </div>
        <Button 
          className="w-full py-3"
          disabled={items.length === 0 || isPending}
          onClick={onCheckout}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              処理中...
            </>
          ) : (
            "購入手続きへ進む"
          )}
        </Button>
      </div>
    </div>
  );
}
