import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Ticket } from "lucide-react";
import { TicketCard } from "@/components/ticket-card";
import { Cart } from "@/components/cart";
import { PaymentSuccessModal } from "@/components/payment-success-modal";

export type CartItem = {
  id: number;
  quantity: number;
  price: number;
  discount: string;
};

export default function TicketPurchasePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const purchaseMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const res = await apiRequest("POST", "/api/tickets/purchase", { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowSuccessModal(true);
      setCartItems([]);
    },
  });

  const addToCart = (quantity: number) => {
    let price;
    let discount = "";
    
    switch(quantity) {
      case 1:
        price = 3000;
        break;
      case 4:
        price = 11000;
        discount = " (8%割引)";
        break;
      case 8:
        price = 20000;
        discount = " (17%割引)";
        break;
      default:
        price = quantity * 3000;
    }
    
    setCartItems([...cartItems, {
      id: Date.now(),
      quantity,
      price,
      discount
    }]);
  };

  const removeFromCart = (id: number) => {
    setCartItems(cartItems.filter(item => item.id !== id));
  };

  const checkout = () => {
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    purchaseMutation.mutate(totalQuantity);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">家庭教師サービス</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">チケット購入</h2>
          <p className="mt-1 text-sm text-gray-600">必要なチケット数を選択して購入してください</p>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="mr-4 bg-primary bg-opacity-10 p-3 rounded-full">
                <Ticket className="text-primary h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">現在のチケット残数</p>
                <p className="text-2xl font-bold text-gray-900">{user?.ticketCount || 0}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <TicketCard 
              title="1枚"
              price={3000}
              description="1回分の授業チケット"
              onAddToCart={() => addToCart(1)}
            />

            <TicketCard 
              title="4枚"
              price={11000}
              description="4回分の授業チケット"
              discount="8%割引"
              onAddToCart={() => addToCart(4)}
            />

            <TicketCard 
              title="8枚"
              price={20000}
              description="8回分の授業チケット"
              discount="17%割引"
              onAddToCart={() => addToCart(8)}
            />
          </div>

          {/* Cart */}
          <Cart 
            items={cartItems} 
            onRemove={removeFromCart}
            onCheckout={checkout}
            isPending={purchaseMutation.isPending}
          />
        </Card>
      </main>

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
