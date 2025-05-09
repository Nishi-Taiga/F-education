import { Button } from "@/components/ui/button";

interface TicketCardProps {
  title: string;
  price: number;
  description: string;
  discount?: string;
  onAddToCart: () => void;
}

export function TicketCard({ title, price, description, discount, onAddToCart }: TicketCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xl font-bold">{title}</span>
        <span className="text-primary font-bold">¥{price.toLocaleString()}</span>
      </div>
      
      {discount && (
        <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded inline-block mb-3">
          {discount}
        </div>
      )}
      
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <Button 
        variant="outline" 
        className="w-full border-primary text-primary hover:bg-primary hover:text-white transition duration-200"
        onClick={onAddToCart}
      >
        カートに追加
      </Button>
    </div>
  );
}
