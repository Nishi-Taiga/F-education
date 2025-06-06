"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Calendar, Loader2, User, BookOpen, GraduationCap, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CommonHeader } from "@/components/common-header";

// Replit版から移植した型定義
type Student = {
  id: number;
  first_name: string;
  last_name: string;
  grade: string;
  ticketCount?: number;
  user_id?: string;
  parent_id?: number;
};

type Booking = {
  id: number;
  date: string;
  timeSlot: string;
  student_id?: number;
  tutorId: number;
  status: string;
  subject?: string;
};

type BookingSelection = {
  date: string;
  formattedDate: string;
  timeSlot: string;
  student_id?: number;
  studentName?: string;
  subject: string;
  tutorId: number;
  tutorShiftId: number;
  tutorName: string;
  parent_id?: number;
};

type SchoolLevel = "elementary" | "junior_high" | "high_school";

const timeSlots = [
  "16:00 - 17:30",
  "18:00 - 19:30", 
  "20:00 - 21:30"
];

const subjectsBySchoolLevel = {
  elementary: ["国語", "算数", "理科", "社会", "英語"],
  junior_high: ["国語", "数学", "理科", "社会", "英語"],
  high_school: ["現代文", "古文", "数学Ⅰ", "数学Ⅱ", "数学Ⅲ", "数学A", "数学B", "物理", "化学", "生物", "日本史", "世界史", "地理", "英語"]
};

const getSchoolLevelFromGrade = (grade: string): SchoolLevel => {
  if (grade.includes("小")) {
    return "elementary";
  } else if (grade.includes("中")) {
    return "junior_high";
  } else {
    return "high_school";
  }
};

// Replit版のCalendarViewを簡易再現
function CalendarView({
  bookings,
  onSelectDate,
  interactive = true,
  showLegend = false
}: {
  bookings: Booking[];
  onSelectDate?: (date: string) => void;
  interactive?: boolean;
  showLegend?: boolean;
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // 前月の日付で埋める
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // 現在の月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getDateAvailability = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const bookedSlots = bookings.filter(b => b.date === dateStr);
    return {
      hasAvailable: bookedSlots.length < timeSlots.length,
      isFullyBooked: bookedSlots.length === timeSlots.length
    };
  };

  const isPastDate = (date: Date) => {
    return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
        >
          ←
        </Button>
        <h3 className="text-lg font-medium">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </h3>
        <Button
          variant="outline"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
        >
          →
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {["日", "月", "火", "水", "木", "金", "土"].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 p-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="p-2"></div>;
          }

          const dateStr = format(day, "yyyy-MM-dd");
          const { hasAvailable, isFullyBooked } = getDateAvailability(day);
          const isPast = isPastDate(day);
          const isSunday = day.getDay() === 0;

          return (
            <button
              key={index}
              className={`p-2 text-sm border rounded transition-colors min-h-[40px] ${
                isPast || isSunday
                  ? "text-gray-300 cursor-not-allowed bg-gray-50"
                  : isFullyBooked
                  ? "bg-red-100 border-red-200 text-red-700 cursor-not-allowed"
                  : hasAvailable && !isPast && !isSunday
                  ? "bg-green-100 border-green-200 text-green-700 hover:bg-green-200 cursor-pointer"
                  : "hover:bg-gray-100 border-gray-200 cursor-pointer"
              }`}
              disabled={isPast || isSunday || isFullyBooked || !interactive}
              onClick={() => interactive && onSelectDate && !isPast && !isSunday && !isFullyBooked && onSelectDate(dateStr)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 予約確認モーダル（簡易版）
function BookingConfirmationModal({
  isOpen,
  bookings,
  onCancel,
  onConfirm,
  isProcessing
}: {
  isOpen: boolean;
  bookings: BookingSelection[];
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">予約確認</h3>
        <p className="mb-4 text-gray-600">以下の内容で予約を確定しますか？</p>

        <div className="space-y-3 mb-6">
          {bookings.map((booking, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-md">
              <div className="font-medium">{booking.formattedDate}</div>
              <div className="text-sm text-gray-600">{booking.timeSlot}</div>
              <div className="text-sm text-gray-600">{booking.subject}</div>
              <div className="text-sm text-gray-600">{booking.tutorName}</div>
              {booking.studentName && (
                <div className="text-sm text-primary">{booking.studentName}</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isProcessing}
          >
            キャンセル
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              "予約確定"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [isLoadingTutors, setIsLoadingTutors] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [parentProfile, setParentProfile] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<BookingSelection[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [studentSchoolLevel, setStudentSchoolLevel] = useState<SchoolLevel | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [availableTutors, setAvailableTutors] = useState<any[]>([]);

  const timeSlotSectionRef = useRef<HTMLDivElement>(null);

  // 科目選択時の共通処理
  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
    // 日付が既に選択されている場合はスクロール
    if (selectedDate) {
      setTimeout(() => {
        timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // ユーザー情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/');
          return;
        }

        setUser(session.user);
        console.log("Logged in user role from session:", session.user.role); // Log original session role
        console.log("Session user ID:", session.user.id); // セッションユーザーIDをログに出力

        let determinedUserRole: 'student' | 'parent' | 'authenticated' = 'authenticated';
        let currentParentProfile = null;
        let currentStudents: Student[] = [];
        let currentSelectedStudentId: number | null = null;
        let currentStudentSchoolLevel: SchoolLevel | null = null;

        // 最初に学生プロフィールを試行
        const { data: studentProfileData, error: studentProfileError } = await supabase
          .from('student_profile')
          .select('*, parent_id') // Ensure parent_id is selected
          .eq('user_id', session.user.id)
          .maybeSingle();

        console.log("Student profile query result:", { data: studentProfileData, error: studentProfileError }); // 学生プロフィール取得結果をログに出力

        if (!studentProfileError && studentProfileData) {
          determinedUserRole = 'student';
          // 生徒のチケット数を取得
          const { data: ticketsData } = await supabase
            .from('student_tickets')
            .select('quantity')
            .eq('student_id', studentProfileData.id);

          const ticketCount = ticketsData ? ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0) : 0;
          const studentWithTickets: Student = {
              ...studentProfileData as Student,
              ticketCount: ticketCount
          };
          currentStudents.push(studentWithTickets);
          currentSelectedStudentId = studentWithTickets.id;
          currentStudentSchoolLevel = getSchoolLevelFromGrade(studentWithTickets.grade);
          console.log("生徒としてログインし、自身の生徒情報を設定しました:", studentWithTickets);

        } else if (studentProfileError) {
          console.warn("生徒プロフィール取得エラー（存在しない場合あり）:", studentProfileError.message);
        }

        // 学生プロフィールが見つからなかった場合、保護者プロフィールを試行
        if (determinedUserRole !== 'student') {
          const { data: parentProfileData, error: parentProfileError } = await supabase
            .from('parent_profile')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          console.log("Parent profile query result:", { data: parentProfileData, error: parentProfileError }); // 保護者プロフィール取得結果をログに出力

          if (!parentProfileError && parentProfileData) {
            determinedUserRole = 'parent';
            currentParentProfile = parentProfileData;
            console.log("保護者としてログインし、保護者情報を設定しました:", parentProfileData);
          } else if (parentProfileError) {
            console.warn("保護者プロフィール取得エラー（存在しない場合あり）:", parentProfileError.message);
          }
        }
        
        // Update all relevant states after determination
        setParentProfile(currentParentProfile);
        setStudents(currentStudents);
        setSelectedStudentId(currentSelectedStudentId);
        setStudentSchoolLevel(currentStudentSchoolLevel);

        console.log("Logged in user role determined for app logic:", determinedUserRole);

      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // 生徒情報を取得 (保護者アカウントのみ)
  useEffect(() => {
    const fetchStudentsForParent = async () => {
      // parentProfile が設定されていれば、それが保護者であることを意味する
      // また、parentProfile.id が確定していることを確認
      if (!parentProfile || parentProfile.id === undefined) {
        console.log("parentProfileがないため、生徒情報取得をスキップします。");
        return;
      }
      setIsLoadingStudents(true);
      try {
        const { data: studentsData, error: studentsError } = await supabase
          .from('student_profile')
          .select('*, parent_id') // parent_id を選択
          .eq('parent_id', parentProfile.id); // 保護者IDでフィルタリング

        if (!studentsError && studentsData) {
          const studentsWithTickets = await Promise.all(studentsData.map(async student => {
            const { data: ticketsData } = await supabase
              .from('student_tickets')
              .select('quantity')
              .eq('student_id', student.id);
            return {
              ...student,
              ticketCount: ticketsData ? ticketsData.reduce((sum, ticket) => sum + ticket.quantity, 0) : 0
            };
          }));
          setStudents(studentsWithTickets);
        } else if (studentsError) {
          console.error("生徒情報取得エラー:", studentsError);
        }
      } catch (error) {
        console.error("生徒情報取得エラー:", error);
      } finally {
        setIsLoadingStudents(false);
      }
    };
    // parentProfile が有効な場合にのみ実行
    if (parentProfile) {
      fetchStudentsForParent();
    }
  }, [parentProfile]); // Depend on parentProfile

  // 生徒選択時の処理（保護者アカウント）
  useEffect(() => {
    // user.role の代わりに parentProfile の有無で保護者かどうかを判断
    if (!parentProfile) return; // 保護者でない場合はスキップ

    if (selectedStudentId && students.length > 0) {
      const selectedStudent = students.find(student => student.id === selectedStudentId);
      if (selectedStudent) {
        const schoolLevel = getSchoolLevelFromGrade(selectedStudent.grade);
        setStudentSchoolLevel(schoolLevel);
      } else {
        setStudentSchoolLevel(null);
      }
    }
  }, [selectedStudentId, students, parentProfile]); // Add parentProfile to dependency array

  // 既存予約を取得
  useEffect(() => {
    const fetchBookings = async () => {
      setIsLoadingBookings(true);
      try {
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');

        if (!bookingsError && bookingsData) {
          setExistingBookings(bookingsData);
        }
      } catch (error) {
        console.error("予約情報取得エラー:", error);
      } finally {
        setIsLoadingBookings(false);
      }
    };

    fetchBookings();
  }, []);

  // 利用可能な講師を取得
  useEffect(() => {
    const fetchAvailableTutors = async () => {
      if (!selectedSubject || !selectedDate || !selectedTimeSlot || !studentSchoolLevel) {
        setAvailableTutors([]);
        return;
      }

      setIsLoadingTutors(true);
      try {
        // time_slotの値（例: 16:00-17:30）に合わせてスペースを除去
        const normalizedTimeSlot = selectedTimeSlot.replace(/\s/g, "");
        const { data: shiftsData, error: shiftsError } = await supabase
          .from('tutor_shifts')
          .select(`
            *,
            tutor_profile (id, first_name, last_name, subjects)
          `)
          .eq('date', selectedDate)
          .eq('time_slot', normalizedTimeSlot)
          .eq('is_available', true);

        if (shiftsError) {
          console.error("講師取得エラー:", shiftsError);
          setAvailableTutors([]);
          return;
        }

        // 科目でフィルタリング
        const filteredTutors = (shiftsData || []).filter(shift => {
          if (!shift.tutor_profile?.subjects) return true;
          return shift.tutor_profile.subjects.includes(selectedSubject);
        }).map(shift => ({
          tutorId: shift.tutor_profile.id,
          shiftId: shift.id,
          name: `${shift.tutor_profile.last_name} ${shift.tutor_profile.first_name}`,
          subject: selectedSubject,
          specialization: shift.tutor_profile.subjects
        }));

        setAvailableTutors(filteredTutors);
      } catch (error) {
        console.error("講師取得エラー:", error);
        setAvailableTutors([]);
      } finally {
        setIsLoadingTutors(false);
      }
    };

    fetchAvailableTutors();
  }, [selectedSubject, selectedDate, selectedTimeSlot, studentSchoolLevel]);

  const handleDateSelection = (date: string) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);

    // 生徒と科目が選択されていれば時間選択セクションまでスクロール
    if (selectedStudentId && selectedSubject) {
      setTimeout(() => {
        timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
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
  const handleTutorSelection = (tutorId?: number, shiftId?: number) => {
    if (!selectedStudentId || !selectedSubject || !selectedDate || !selectedTimeSlot || !tutorId || !shiftId) {
      toast({
        title: "予約情報が不足しています",
        description: "生徒、科目、日時、講師をすべて選択してください",
        variant: "destructive"
      });
      return;
    }

    // 選択済みの講師情報を取得
    const tutor = availableTutors?.find((t: any) => t.tutorId === tutorId && t.shiftId === shiftId);
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
    let studentParentId: number | undefined = undefined;

    if (selectedStudentId && students) {
      const student = students.find((s: Student) => s.id === selectedStudentId);
      if (student) {
        studentName = `${student.last_name} ${student.first_name}`;
        studentParentId = student.parent_id;
      }
    }

    console.log("handleTutorSelection: studentParentId before adding to bookings:", studentParentId);

    const dateObj = parse(selectedDate, "yyyy-MM-dd", new Date());
    const formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });

    // 予約を追加
    setSelectedBookings([...selectedBookings, {
      date: selectedDate,
      formattedDate,
      timeSlot: selectedTimeSlot,
      student_id: selectedStudentId,
      studentName,
      subject: selectedSubject,
      tutorId,
      tutorShiftId: shiftId,
      tutorName: tutor.name,
      parent_id: studentParentId,
    }]);

    // 選択をリセット
    setSelectedTutorId(null);
    setSelectedShiftId(null);
    setSelectedTimeSlot(null);

    console.log("Inline Tutor Select: parent_id added to bookings:", studentParentId);
  };

  const completeBooking = async () => {
    if (selectedBookings.length === 0) return;

    try {
      setIsLoading(true);

      // Create an array of booking data to send to the mutation
      for (const booking of selectedBookings) {
        // 予約に使用する parent_id を取得
        const bookingParentId = booking.parent_id;

        console.log("completeBooking: bookingParentId for current booking:", bookingParentId);

        if (bookingParentId === null || bookingParentId === undefined) {
          console.error("親IDが取得できませんでした。");
          throw new Error("予約に必要な親情報が不足しています。");
        }

        const { error: bookingError } = await supabase
          .from('bookings')
          .insert([
            {
              date: booking.date,
              time_slot: booking.timeSlot, // 'timeSlot' から 'time_slot' に修正済み
              student_id: booking.student_id,
              subject: booking.subject,
              tutor_id: booking.tutorId, // 'tutorId' から 'tutor_id' に修正済み
              parent_id: bookingParentId, // parent_id を追加
              tutor_shift_id: booking.tutorShiftId, // tutor_shift_id を追加
              status: 'confirmed'
            }
          ]);

        if (bookingError) {
          throw bookingError;
        }

        // シフトを予約済みに更新
        const { error: shiftError } = await supabase
          .from('tutor_shifts')
          .update({ is_available: false }) // isBooked: true から is_available: false に修正
          .eq('id', booking.tutorShiftId);

        if (shiftError) {
          console.error("シフト更新エラー:", shiftError);
        }
      }

      // --- チケット消費処理 --- START
      if (selectedBookings.length > 0 && selectedBookings[0].student_id) {
        const studentId = selectedBookings[0].student_id;

        // 現在のチケット数を取得
        const { data: currentTicketsData, error: fetchTicketsError } = await supabase
          .from('student_tickets')
          .select('quantity')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(1);

        let currentTicketCount = 0;
        if (!fetchTicketsError && currentTicketsData && currentTicketsData.length > 0) {
          currentTicketCount = currentTicketsData[0].quantity;
        }

        // 新しいチケット数を計算
        const lessonsBookedCount = selectedBookings.length;
        const newTicketCount = Math.max(0, currentTicketCount - lessonsBookedCount);

        // チケット消費を行う生徒の parent_id を取得（selectedBookings から取得）
        const studentParentIdForTicket = selectedBookings[0].parent_id; // selectedBookingsから直接取得

        // student_tickets テーブルに新しいレコードを挿入
        if (studentParentIdForTicket !== undefined && studentParentIdForTicket !== null) {
          const { error: insertTicketError } = await supabase
            .from('student_tickets')
            .insert([
              {
                student_id: studentId,
                quantity: -lessonsBookedCount, // 消費したチケット数（負の値）を挿入
                parent_id: studentParentIdForTicket // parent_id を追加
                // created_at はDB側で自動生成されることを期待
              }
            ]);

          if (insertTicketError) {
            console.error("チケット消費レコード挿入エラー:", insertTicketError);
            // チケット消費に失敗した場合でも予約自体は完了しているため、
            // ユーザーには予約完了を通知しつつ、内部的にエラーをログに残す。
            // 必要に応じてエラーハンドリングやロールバックのロジックを追加検討。
          }
        } else {
           console.error("チケット消費に必要な親IDが取得できませんでした。(BookingSelection)");
           // 親IDがない場合のエラーハンドリング
        }
      }
      // --- チケット消費処理の追加 --- END

      toast({
        title: "予約完了",
        description: "授業の予約が完了しました",
      });

      setSelectedBookings([]);
      setShowConfirmationModal(false);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("予約エラー:", error);
      toast({
        title: "予約エラー",
        description: error.message || "予約の作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a date has any already-booked time slots for the selected student
  const getDateAvailability = (date: string): {hasAvailable: boolean, isFullyBooked: boolean} => {
    if (!existingBookings) return {hasAvailable: true, isFullyBooked: false};

    // 生徒が選択されている場合、その生徒の予約のみをチェック
    if (selectedStudentId) {
      const bookedSlotsForStudentAndDate = existingBookings.filter(
        b => b.date === date && b.student_id === selectedStudentId
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
          b.student_id === selectedStudentId
      );
    }

    // 生徒が選択されていない場合は、すべての予約をチェック（古い動作と互換性を保つ）
    return existingBookings.some(b => b.date === date && b.timeSlot === timeSlot);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <CommonHeader title="授業予約" showBackButton={true} backTo="/dashboard" />

      <main className="flex-1 py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-2">
          {/* Calendar for booking */}
          <div className="lg:col-span-2">
            <Card className="p-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-gray-900">カレンダー</h3>
              </div>

              {/* 生徒選択 (保護者アカウントの場合のみ表示) */}
              {user?.role === 'parent' && (
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
                      <SelectTrigger className="w-full bg-white border-2 shadow-sm">
                        <SelectValue placeholder="生徒を選択してください" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 shadow-lg z-50">
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            <div className="flex justify-between items-center w-full">
                              <span>{student.last_name} {student.first_name}（残り{('ticketCount' in student ? (student as any).ticketCount : 0)}枚）</span>
                            </div>
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
                      onValueChange={handleSubjectChange}
                    >
                      <SelectTrigger className="w-full bg-white border-2 shadow-sm">
                        <SelectValue placeholder="科目を選択してください" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 shadow-lg z-50">
                        {subjectsBySchoolLevel[studentSchoolLevel].map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-600">
                        学年情報が取得できませんでした。中学生用の科目から選択できます。
                      </div>
                      <Select
                        value={selectedSubject || ""}
                        onValueChange={handleSubjectChange}
                      >
                        <SelectTrigger className="w-full bg-white border-2 shadow-sm">
                          <SelectValue placeholder="科目を選択してください" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-2 shadow-lg z-50">
                          {subjectsBySchoolLevel["junior_high"].map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                ) : (
                  // 親アカウントの場合は生徒選択必須
                  !selectedStudentId ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">先に生徒を選択してください</div>
                  ) : studentSchoolLevel ? (
                    <Select
                      value={selectedSubject || ""}
                      onValueChange={handleSubjectChange}
                    >
                      <SelectTrigger className="w-full bg-white border-2 shadow-sm">
                        <SelectValue placeholder="科目を選択してください" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 shadow-lg z-50">
                        {subjectsBySchoolLevel[studentSchoolLevel].map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-600">
                        学年情報が取得できませんでした。中学生用の科目から選択できます。
                      </div>
                      <Select
                        value={selectedSubject || ""}
                        onValueChange={handleSubjectChange}
                      >
                        <SelectTrigger className="w-full bg-white border-2 shadow-sm">
                          <SelectValue placeholder="科目を選択してください" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-2 shadow-lg z-50">
                          {subjectsBySchoolLevel["junior_high"].map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                )}
              </div>

              {isLoadingBookings ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ((user?.role === 'parent' && !selectedStudentId) || !selectedSubject) ? (
                <div className="border rounded-md p-6 text-center bg-gray-50">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">授業の予約には以下の情報が必要です</p>
                  <ul className="text-sm text-gray-600 mb-4 space-y-1">
                    {user?.role === 'parent' && (
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
                  showLegend={false} // 生徒・保護者の予約ページには凡例を表示しない
                />
              )}
            </Card>
          </div>

          {/* Time slots and selected bookings */}
          <div className="lg:col-span-1">
            <Card className="p-3 mb-3">
              <div ref={timeSlotSectionRef}>
                <h3 className="text-base font-medium text-gray-900 mb-3">授業時間を選択</h3>
              </div>

              {((user?.role === 'parent' && !selectedStudentId) || (!selectedSubject)) ? (
                <div className="p-4 border rounded-md bg-gray-50 text-center">
                  <p className="text-gray-600 mb-2">授業時間を選択するには</p>
                  <ul className="text-sm text-gray-600 mb-2 space-y-1">
                    {user?.role === 'parent' && !selectedStudentId && (
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
                                // 講師カードがクリックされたら即座に予約を追加
                                if (!selectedStudentId || !selectedSubject || !selectedDate || !selectedTimeSlot) {
                                  toast({
                                    title: "予約情報が不足しています",
                                    description: "生徒、科目、日時をすべて選択してください",
                                    variant: "destructive"
                                  });
                                  return;
                                }

                                const dateObj = parse(selectedDate, "yyyy-MM-dd", new Date());
                                const formattedDate = format(dateObj, "yyyy年M月d日 (E)", { locale: ja });

                                // 予約を追加
                                setSelectedBookings([...selectedBookings, {
                                  date: selectedDate,
                                  formattedDate,
                                  timeSlot: selectedTimeSlot,
                                  student_id: selectedStudentId,
                                  studentName: students?.find(s => s.id === selectedStudentId)?.last_name + ' ' + students?.find(s => s.id === selectedStudentId)?.first_name, // 生徒名をここで取得
                                  subject: selectedSubject,
                                  tutorId: tutor.tutorId,
                                  tutorShiftId: tutor.shiftId,
                                  tutorName: tutor.name,
                                  parent_id: students?.find(s => s.id === selectedStudentId)?.parent_id, // parent_idを追加
                                }]);

                                console.log("Inline Tutor Select: parent_id added to bookings:", students?.find(s => s.id === selectedStudentId)?.parent_id);

                                // 選択をリセット
                                setSelectedTutorId(null); // これらはもう不要だが、後のために残すか検討
                                setSelectedShiftId(null); // これらはもう不要だが、後のために残すか検討
                                setSelectedTimeSlot(null);
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


                        </div>
                      ) : (
                        <div className="p-4 border rounded-md bg-yellow-50 text-yellow-700 text-sm">
                          <div className="flex items-start">
                            <span className="mr-2">⚠️</span>
                            <div>
                              <p className="font-medium mb-1">予約可能な講師が見つかりません</p>
                              <p>選択した日時・科目に予約可能な講師がいません。別の日時や科目を選択してください。</p>
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

              <div className="flex items-center mt-1 mb-3 p-2 bg-amber-50 text-amber-700 rounded-md text-xs">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>授業開始の24時間前を過ぎると、予約のキャンセルができなくなります。（葬儀等の緊急時はLINEにてご連絡ください）</span>
              </div>

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

              {(() => {
                // チケット数チェック
                let hasEnoughTickets = true;
                let ticketErrorMessage = "";

                // 生徒が選択されていて、その生徒のチケット情報がある場合
                if (selectedStudentId && students) {
                  const selectedStudent = students.find(s => s.id === selectedStudentId);
                  if (selectedStudent && 'ticketCount' in selectedStudent) {
                    const studentTicketCount = (selectedStudent as any).ticketCount;
                    // 生徒のチケットが予約数より少ない場合
                    if (studentTicketCount < selectedBookings.length) {
                      hasEnoughTickets = false;
                      ticketErrorMessage = `${selectedStudent.last_name} ${selectedStudent.first_name}のチケットが不足しています（残り${studentTicketCount}枚、必要${selectedBookings.length}枚）`;
                    }
                  }
                }
                // 生徒が選択されていない場合や生徒のチケット情報がない場合は従来通りユーザー全体のチケット数をチェック
                else if (user && user.ticketCount < selectedBookings.length) {
                  hasEnoughTickets = false;
                  ticketErrorMessage = `チケットが不足しています（残り${user.ticketCount}枚、必要${selectedBookings.length}枚）`;
                }

                if (!hasEnoughTickets) {
                  return (
                    <div>
                      <Button
                        className="w-full mb-2"
                        variant="destructive"
                        disabled={true}
                      >
                        {ticketErrorMessage}
                      </Button>
                      <div className="text-center">
                        <a href="/tickets" className="text-sm text-primary hover:underline">チケットを購入する</a>
                      </div>
                    </div>
                  );
                }

                return (
                  <Button
                    className="w-full"
                    disabled={selectedBookings.length === 0 || isLoading}
                    onClick={confirmBooking}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        処理中...
                      </>
                    ) : (
                      "予約を確認する"
                    )}
                  </Button>
                );
              })()}
            </Card>
          </div>
        </div>
      </main>

      <BookingConfirmationModal
        isOpen={showConfirmationModal}
        bookings={selectedBookings}
        onCancel={() => setShowConfirmationModal(false)}
        onConfirm={completeBooking}
        isProcessing={isLoading}
      />
    </div>
  );
}
