import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange, DayPickerSingleProps, DayPickerRangeProps } from "react-day-picker"
import { ja } from "date-fns/locale";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
}

export function DatePicker({
  className,
  date,
  setDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "yyyy/MM/dd")
            ) : (
              <span>日付を選択</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              setDate(selectedDate);
              setIsOpen(false);
            }}
            locale={ja}
          />
          <div className="p-2 bg-white">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setDate(undefined);
                setIsOpen(false);
              }}
            >
              クリア
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 