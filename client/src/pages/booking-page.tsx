import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Ticket, Calendar, Loader2, User } from "lucide-react";
import { CalendarView } from "@/components/calendar-view";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { timeSlots, type Booking, type Student } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

type BookingSelection = {
  date: string;
  formattedDate: string;
  timeSlot: string;
  studentId?: number;
  studentName?: string;
};

export default function BookingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<BookingSelection[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // 登録済みの生徒一覧を取得
  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: existingBookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  type BookingData = { 
    date: string;
    timeSlot: string;
    studentId?: number;
  };
  
  const bookingMutation = useMutation({
    mutationFn: async (bookingsData: BookingData[]) => {
      try {
        // Process each booking sequentially
        const results = [];
        for (const bookingData of bookingsData) {
          const res = await apiRequest("POST", "/api/bookings", bookingData);
          
          // Check for error status
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "予約に失敗しました");
          }
          
          // Clone response because once json() is called, we can't call it again
          const clonedRes = res.clone();
          const data = await clonedRes.json();
          results.push(data);
        }
        return results;
      } catch (error) {
        // Handle errors and still navigate back
        const errorMessage = error instanceof Error ? error.message : "予約に失敗しました";
        toast({
          title: "予約エラー",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Close the modal and navigate back even on error
        setShowConfirmationModal(false);
        navigate("/");
        throw error; // Re-throw to trigger onError
      }
    },
    onSuccess: () => {
      toast({
        title: "予約完了",
        description: "授業の予約が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setSelectedBookings([]);
      setShowConfirmationModal(false);
      navigate("/");
    },
    onError: () => {
      // Error already handled in mutationFn
    },
  });

  const handleDateSelection = (date: string) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
  };

  const handleTimeSlotSelection = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    
    if (selectedDate) {
      const dateObj = parse(selectedDate, "yyyy-MM-dd", new Date());
      const formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
      
      // Check if already selected
      const isDuplicate = selectedBookings.some(
        booking => booking.date === selectedDate && booking.timeSlot === timeSlot
      );
      
      if (!isDuplicate) {
        // 生徒情報を取得
        let studentId: number | undefined = undefined;
        let studentName: string | undefined = undefined;
        
        if (selectedStudentId && students) {
          const selectedStudent = students.find(student => student.id === selectedStudentId);
          if (selectedStudent) {
            studentId = selectedStudent.id;
            studentName = `${selectedStudent.lastName} ${selectedStudent.firstName}`;
          }
        }
        
        setSelectedBookings([...selectedBookings, {
          date: selectedDate,
          formattedDate,
          timeSlot,
          studentId,
          studentName
        }]);
      }
    }
  };

  const removeBooking = (index: number) => {
    const newBookings = [...selectedBookings];
    newBookings.splice(index, 1);
    setSelectedBookings(newBookings);
  };

  const confirmBooking = () => {
    setShowConfirmationModal(true);
  };

  const completeBooking = () => {
    if (selectedBookings.length > 0) {
      // Create an array of booking data to send to the mutation
      const bookingsData = selectedBookings.map(booking => ({
        date: booking.date,
        timeSlot: booking.timeSlot,
        studentId: booking.studentId
      }));
      
      // Process all bookings
      bookingMutation.mutate(bookingsData);
    }
  };

  // Check if a date has any already-booked time slots
  const getDateAvailability = (date: string): {hasAvailable: boolean, isFullyBooked: boolean} => {
    if (!existingBookings) return {hasAvailable: true, isFullyBooked: false};
    
    const bookedSlotsForDate = existingBookings.filter(b => b.date === date);
    return {
      hasAvailable: bookedSlotsForDate.length < timeSlots.length,
      isFullyBooked: bookedSlotsForDate.length === timeSlots.length
    };
  };

  // Check if a specific time slot on a date is already booked
  const isTimeSlotBooked = (date: string, timeSlot: string): boolean => {
    if (!existingBookings) return false;
    return existingBookings.some(b => b.date === date && b.timeSlot === timeSlot);
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
            <div className="bg-primary bg-opacity-10 px-3 py-1 rounded-full flex items-center">
              <Ticket className="text-primary h-4 w-4 mr-2" />
              <span className="text-gray-700 font-medium">{user?.ticketCount || 0}</span>
            </div>
            <span className="text-gray-700">{user?.displayName || user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">授業予約</h2>
          <p className="mt-1 text-sm text-gray-600">希望する日時を選択してください</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar for booking */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">カレンダー</h3>
              </div>
              
              {/* 生徒選択 */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">受講する生徒を選択</Label>
                </div>
                {isLoadingStudents ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-gray-500">生徒情報を読み込み中...</span>
                  </div>
                ) : students && students.length > 0 ? (
                  <Select 
                    value={selectedStudentId?.toString() || ""} 
                    onValueChange={(value) => setSelectedStudentId(parseInt(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="生徒を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id.toString()}>
                          {student.lastName} {student.firstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
                    生徒情報が登録されていません。設定ページから生徒情報を登録してください。
                  </div>
                )}
              </div>
              
              {isLoadingBookings ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <CalendarView 
                  bookings={existingBookings || []} 
                  onSelectDate={handleDateSelection}
                  interactive={true}
                />
              )}
            </Card>
          </div>

          {/* Time slots and selected bookings */}
          <div className="lg:col-span-1">
            <Card className="p-4 mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">授業時間を選択</h3>
              
              {selectedDate ? (
                <div id="date-selection" className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">選択した日付</div>
                  <div className="font-medium text-gray-900 mb-4">
                    {format(
                      parse(selectedDate, "yyyy-MM-dd", new Date()),
                      "yyyy年M月d日 (E)",
                      { locale: ja }
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">時間帯を選択</div>
                  <div className="space-y-2">
                    {timeSlots.map((timeSlot) => {
                      const isBooked = isTimeSlotBooked(selectedDate, timeSlot);
                      return (
                        <Button
                          key={timeSlot}
                          variant="outline"
                          className="w-full justify-start h-auto py-3"
                          disabled={isBooked}
                          onClick={() => handleTimeSlotSelection(timeSlot)}
                        >
                          <span className="font-medium">{timeSlot}</span>
                          {isBooked && <span className="ml-2 text-xs text-red-500">(予約済み)</span>}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">カレンダーから日付を選択してください</p>
                </div>
              )}
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">選択済み授業</h3>
              
              <div className="space-y-3 mb-6">
                {selectedBookings.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600">授業が選択されていません</p>
                  </div>
                ) : (
                  selectedBookings.map((booking, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <div>
                        <div className="font-medium">{booking.formattedDate}</div>
                        <div className="text-sm text-gray-600">{booking.timeSlot}</div>
                        {booking.studentName && (
                          <div className="flex items-center mt-1">
                            <User className="h-3 w-3 text-primary mr-1" />
                            <span className="text-xs text-primary">{booking.studentName}</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-gray-500 hover:text-red-500" 
                        onClick={() => removeBooking(index)}
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </Button>
                    </div>
                  ))
                )}
              </div>
              
              {user && user.ticketCount < selectedBookings.length ? (
                <Button 
                  className="w-full" 
                  variant="destructive"
                  disabled={true}
                >
                  チケットが不足しています（{selectedBookings.length}枚必要）
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  disabled={selectedBookings.length === 0 || bookingMutation.isPending}
                  onClick={confirmBooking}
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    "予約を確認する"
                  )}
                </Button>
              )}
            </Card>
          </div>
        </div>
      </main>

      <BookingConfirmationModal
        isOpen={showConfirmationModal}
        bookings={selectedBookings}
        onCancel={() => setShowConfirmationModal(false)}
        onConfirm={completeBooking}
        isProcessing={bookingMutation.isPending}
      />
    </div>
  );
}
