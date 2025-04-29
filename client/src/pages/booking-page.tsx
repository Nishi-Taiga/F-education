import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Ticket, Calendar, Loader2, User, BookOpen, GraduationCap } from "lucide-react";
import { CalendarView } from "@/components/calendar-view";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { timeSlots, type Booking, type Student, subjectsBySchoolLevel, type SchoolLevel, getSchoolLevelFromGrade } from "@shared/schema";
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
  subject: string;
  tutorId: number;
  tutorShiftId: number;
  tutorName: string;
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
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [studentSchoolLevel, setStudentSchoolLevel] = useState<SchoolLevel | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);

  // 登録済みの生徒一覧を取得
  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"]
  });
  
  // 生徒アカウントの場合は初期設定
  useEffect(() => {
    if (user?.role === 'student' && user?.studentId && students && students.length > 0) {
      // 生徒IDを設定
      setSelectedStudentId(user.studentId);
      
      // 生徒情報から学校レベルを取得して設定
      const studentInfo = students.find(s => s.id === user.studentId);
      if (studentInfo) {
        const schoolLevel = getSchoolLevelFromGrade(studentInfo.grade);
        setStudentSchoolLevel(schoolLevel);
      }
    }
  }, [user, students]);

  const { data: existingBookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  // 利用可能な講師を取得
  const { data: availableTutors, isLoading: isLoadingTutors } = useQuery({
    queryKey: ["/api/tutors/available", selectedSubject, selectedDate, selectedTimeSlot],
    queryFn: async () => {
      if (!selectedSubject || !selectedDate || !selectedTimeSlot) return null;
      
      const params = new URLSearchParams({
        subject: selectedSubject,
        date: selectedDate,
        timeSlot: selectedTimeSlot
      });
      
      const res = await apiRequest('GET', `/api/tutors/available?${params}`);
      if (!res.ok) throw new Error('講師情報の取得に失敗しました');
      return await res.json();
    },
    enabled: !!selectedSubject && !!selectedDate && !!selectedTimeSlot,
  });

  type BookingData = { 
    date: string;
    timeSlot: string;
    studentId?: number;
    tutorId: number;
    tutorShiftId: number;
    subject: string;
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
    // 講師と生徒情報はこの時点では選択されていない
    // 講師選択UIが後ほど表示される
  };

  const removeBooking = (index: number) => {
    const newBookings = [...selectedBookings];
    newBookings.splice(index, 1);
    setSelectedBookings(newBookings);
  };

  const confirmBooking = () => {
    setShowConfirmationModal(true);
  };

  // 講師選択した時の処理
  const handleTutorSelection = () => {
    if (!selectedStudentId || !selectedSubject || !selectedDate || !selectedTimeSlot || !selectedTutorId || !selectedShiftId) {
      toast({
        title: "予約情報が不足しています",
        description: "生徒、科目、日時、講師をすべて選択してください",
        variant: "destructive"
      });
      return;
    }
    
    // 選択済みの講師情報を取得
    const tutor = availableTutors?.find((t: any) => t.tutorId === selectedTutorId && t.shiftId === selectedShiftId);
    if (!tutor) {
      toast({
        title: "講師情報が見つかりません",
        description: "別の講師を選択してください",
        variant: "destructive"
      });
      return;
    }
    
    // 生徒情報を取得
    let studentName: string | undefined = undefined;
    if (selectedStudentId && students) {
      const student = students.find((s: Student) => s.id === selectedStudentId);
      if (student) {
        studentName = `${student.lastName} ${student.firstName}`;
      }
    }
    
    const dateObj = parse(selectedDate, "yyyy-MM-dd", new Date());
    const formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });
    
    // 予約を追加
    setSelectedBookings([...selectedBookings, {
      date: selectedDate,
      formattedDate,
      timeSlot: selectedTimeSlot,
      studentId: selectedStudentId,
      studentName,
      subject: selectedSubject,
      tutorId: selectedTutorId,
      tutorShiftId: selectedShiftId,
      tutorName: tutor.name
    }]);
    
    // 選択をリセット
    setSelectedTutorId(null);
    setSelectedShiftId(null);
    setSelectedTimeSlot(null);
  };
  
  const completeBooking = () => {
    if (selectedBookings.length > 0) {
      // Create an array of booking data to send to the mutation
      const bookingsData = selectedBookings.map(booking => ({
        date: booking.date,
        timeSlot: booking.timeSlot,
        studentId: booking.studentId,
        subject: booking.subject,
        tutorId: booking.tutorId,
        tutorShiftId: booking.tutorShiftId
      }));
      
      // Process all bookings
      bookingMutation.mutate(bookingsData);
    }
  };

  // Check if a date has any already-booked time slots for the selected student
  const getDateAvailability = (date: string): {hasAvailable: boolean, isFullyBooked: boolean} => {
    if (!existingBookings) return {hasAvailable: true, isFullyBooked: false};
    
    // 生徒が選択されている場合、その生徒の予約のみをチェック
    if (selectedStudentId) {
      const bookedSlotsForStudentAndDate = existingBookings.filter(
        b => b.date === date && b.studentId === selectedStudentId
      );
      
      return {
        hasAvailable: bookedSlotsForStudentAndDate.length < timeSlots.length,
        isFullyBooked: bookedSlotsForStudentAndDate.length === timeSlots.length
      };
    }
    
    // 生徒が選択されていない場合は、すべての予約をチェック（古い動作と互換性を保つ）
    const bookedSlotsForDate = existingBookings.filter(b => b.date === date);
    return {
      hasAvailable: bookedSlotsForDate.length < timeSlots.length,
      isFullyBooked: bookedSlotsForDate.length === timeSlots.length
    };
  };

  // Check if a specific time slot on a date is already booked for the selected student
  const isTimeSlotBooked = (date: string, timeSlot: string): boolean => {
    if (!existingBookings) return false;
    
    // 生徒が選択されている場合は、その生徒の予約のみをチェック
    if (selectedStudentId) {
      return existingBookings.some(
        b => b.date === date && 
          b.timeSlot === timeSlot && 
          b.studentId === selectedStudentId
      );
    }
    
    // 生徒が選択されていない場合は、すべての予約をチェック（古い動作と互換性を保つ）
    return existingBookings.some(b => b.date === date && b.timeSlot === timeSlot);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-primary">家庭教師サービス</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-primary bg-opacity-10 px-2 py-1 rounded-full flex items-center">
              <Ticket className="text-primary h-4 w-4 mr-1" />
              <span className="text-gray-700 text-sm font-medium">{user?.ticketCount || 0}</span>
            </div>
            <span className="text-gray-700 text-sm">{user?.displayName || user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">授業予約</h2>
          <p className="mt-1 text-sm text-gray-600">希望する日時を選択してください</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar for booking */}
          <div className="lg:col-span-2">
            <Card className="p-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-gray-900">カレンダー</h3>
              </div>
              
              {/* 生徒選択 (保護者アカウントの場合のみ表示) */}
              {user?.role !== 'student' && (
                <div className="mb-4">
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
                      onValueChange={(value) => {
                        const studentId = parseInt(value);
                        setSelectedStudentId(studentId);
                        setSelectedSubject(null);
                        
                        // 生徒の学年から学校レベルを取得
                        const selectedStudent = students.find(student => student.id === studentId);
                        if (selectedStudent) {
                          const schoolLevel = getSchoolLevelFromGrade(selectedStudent.grade);
                          setStudentSchoolLevel(schoolLevel);
                        } else {
                          setStudentSchoolLevel(null);
                        }
                      }}
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
              )}
              
              {/* 科目選択 */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">授業科目を選択</Label>
                </div>
                {user?.role === 'student' ? (
                  // 生徒アカウントの場合は学年から科目選択
                  studentSchoolLevel ? (
                    <Select
                      value={selectedSubject || ""}
                      onValueChange={(value) => setSelectedSubject(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="科目を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsBySchoolLevel[studentSchoolLevel].map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                      生徒の学年情報が取得できませんでした
                    </div>
                  )
                ) : (
                  // 親アカウントの場合は生徒選択必須
                  !selectedStudentId ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                      先に生徒を選択してください
                    </div>
                  ) : studentSchoolLevel ? (
                    <Select
                      value={selectedSubject || ""}
                      onValueChange={(value) => setSelectedSubject(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="科目を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsBySchoolLevel[studentSchoolLevel].map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                      生徒の学年情報が取得できませんでした
                    </div>
                  )
                )}
              </div>
              
              {isLoadingBookings ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ((user?.role !== 'student' && !selectedStudentId) || !selectedSubject) ? (
                <div className="border rounded-md p-6 text-center bg-gray-50">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">授業の予約には以下の情報が必要です</p>
                  <ul className="text-sm text-gray-600 mb-4 space-y-1">
                    {user?.role !== 'student' && (
                      <li className="flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary mr-1.5" />
                        <span>受講する生徒</span>
                      </li>
                    )}
                    <li className="flex items-center justify-center">
                      <BookOpen className="h-3.5 w-3.5 text-primary mr-1.5" />
                      <span>授業科目</span>
                    </li>
                  </ul>
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
            <Card className="p-3 mb-3">
              <h3 className="text-base font-medium text-gray-900 mb-3">授業時間を選択</h3>
              
              {((user?.role !== 'student' && !selectedStudentId) || (!user?.role && !selectedStudentId) || !selectedSubject) ? (
                <div className="p-4 border rounded-md bg-gray-50 text-center">
                  <p className="text-gray-600 mb-2">授業時間を選択するには</p>
                  <ul className="text-sm text-gray-600 mb-2 space-y-1">
                    {user?.role !== 'student' && !selectedStudentId && (
                      <li className="flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                        <span className="text-amber-700">生徒を選択してください</span>
                      </li>
                    )}
                    {!selectedSubject && (
                      <li className="flex items-center justify-center">
                        <BookOpen className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                        <span className="text-amber-700">科目を選択してください</span>
                      </li>
                    )}
                  </ul>
                </div>
              ) : selectedDate ? (
                <div id="date-selection" className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">選択した日付</div>
                  <div className="font-medium text-gray-900 mb-4">
                    {format(
                      parse(selectedDate, "yyyy-MM-dd", new Date()),
                      "yyyy年M月d日 (E)",
                      { locale: ja }
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">時間帯を選択</div>
                  </div>
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
                  
                  {/* 講師選択 */}
                  {selectedTimeSlot && selectedDate && selectedSubject && (
                    <div className="mt-6">
                      <div className="flex items-center space-x-2 mb-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">講師を選択</Label>
                      </div>
                      
                      {isLoadingTutors ? (
                        <div className="flex items-center space-x-2 p-4">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-gray-500">講師情報を読み込み中...</span>
                        </div>
                      ) : availableTutors && availableTutors.length > 0 ? (
                        <div className="space-y-3">
                          {availableTutors.map((tutor: any) => (
                            <div 
                              key={`${tutor.tutorId}-${tutor.shiftId}`}
                              className={`p-3 border rounded-md cursor-pointer transition-colors 
                                ${selectedTutorId === tutor.tutorId && selectedShiftId === tutor.shiftId 
                                  ? 'bg-primary/10 border-primary' 
                                  : 'bg-white hover:bg-gray-50'}`}
                              onClick={() => {
                                setSelectedTutorId(tutor.tutorId);
                                setSelectedShiftId(tutor.shiftId);
                              }}
                            >
                              <div className="font-medium text-gray-900">{tutor.name}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                <div className="flex items-center">
                                  <BookOpen className="h-3.5 w-3.5 text-gray-500 mr-1.5" />
                                  <span>{tutor.subject}</span>
                                </div>
                                <div className="flex items-center mt-1">
                                  <Calendar className="h-3.5 w-3.5 text-gray-500 mr-1.5" />
                                  <span>
                                    {format(parse(selectedDate, "yyyy-MM-dd", new Date()), "MM/dd")} ({selectedTimeSlot})
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <Button
                            className="w-full mt-3"
                            disabled={!selectedTutorId || !selectedShiftId}
                            onClick={handleTutorSelection}
                          >
                            この講師で予約する
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 border rounded-md bg-yellow-50 text-yellow-700 text-sm">
                          <div className="flex items-start">
                            <span className="mr-2">⚠️</span>
                            <div>
                              <p className="font-medium mb-1">利用可能な講師が見つかりません</p>
                              <p>選択した日時・科目に対応可能な講師がいないか、すでに予約で埋まっています。別の日時や科目を選択してください。</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">カレンダーから日付を選択してください</p>
                </div>
              )}
            </Card>
            
            <Card className="p-3">
              <h3 className="text-base font-medium text-gray-900 mb-3">選択済み授業</h3>
              
              <div className="space-y-2 mb-4 card-container">
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
                        {booking.subject && (
                          <div className="flex items-center mt-1">
                            <BookOpen className="h-3 w-3 text-gray-600 mr-1" />
                            <span className="text-xs text-gray-600">{booking.subject}</span>
                          </div>
                        )}
                        {booking.studentName && (
                          <div className="flex items-center mt-1">
                            <User className="h-3 w-3 text-primary mr-1" />
                            <span className="text-xs text-primary">{booking.studentName}</span>
                          </div>
                        )}
                        {booking.tutorName && (
                          <div className="flex items-center mt-1">
                            <GraduationCap className="h-3 w-3 text-blue-600 mr-1" />
                            <span className="text-xs text-blue-600">{booking.tutorName}</span>
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
