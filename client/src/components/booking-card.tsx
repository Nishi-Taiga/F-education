import { type Booking } from "@shared/schema";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { BookOpen } from "lucide-react";

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  // Parse the date from string (YYYY-MM-DD) to a Date object
  const dateObj = parse(booking.date, "yyyy-MM-dd", new Date());
  
  // Format the date with Japanese locale
  const formattedDate = format(dateObj, "M月d日 (E)", { locale: ja });

  return (
    <div className="flex items-center p-2 bg-gray-50 rounded-md">
      <div className="w-10 h-10 flex-shrink-0 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mr-3">
        <BookOpen className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-grow">
        <div className="text-sm font-medium">{formattedDate}</div>
        <div className="text-xs text-gray-600">{booking.timeSlot}</div>
      </div>
    </div>
  );
}
