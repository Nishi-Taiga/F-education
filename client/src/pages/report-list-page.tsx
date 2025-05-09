import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { BookingCard } from "@/components/booking-card";
import { ReportViewModal } from "@/components/report-view-modal";
import { CommonHeader } from "@/components/common-header";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, Search, Calendar, User, BookOpen, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { Booking, Student, Tutor, LessonReport } from "@shared/schema";
import { format, parseISO, isValid } from "date-fns";
import { ja } from "date-fns/locale";

// 教科一覧
const SUBJECTS = [
  "国語",
  "算数",
  "数学",
  "英語",
  "理科",
  "社会",
  "物理",
  "化学",
  "生物",
  "地学",
  "日本史",
  "世界史",
  "地理",
  "現代社会",
  "倫理",
  "政治経済"
];

export default function ReportListPage() {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  
  // 検索条件の状態（UI表示用）
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [subjectSearch, setSubjectSearch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // 検索条件の適用状態（実際のフィルタリングに使用）
  const [appliedStudentId, setAppliedStudentId] = useState<string>("all");
  const [appliedSubject, setAppliedSubject] = useState<string>("all");
  const [dateSearch, setDateSearch] = useState("");
  
  // 検索ボタン押下時の処理
  const applyFilters = () => {
    // 生徒IDと教科の状態を適用
    setAppliedStudentId(selectedStudentId);
    setAppliedSubject(subjectSearch);
    
    // 日付の処理
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setDateSearch(formattedDate);
    } else {
      setDateSearch('');
    }
    
    // カレンダーが開いていたら閉じる
    if (isCalendarOpen) {
      setIsCalendarOpen(false);
    }
  };
  
  // すべてのフィルターをクリアする
  const clearAllFilters = () => {
    setSelectedStudentId("all");
    setSubjectSearch("all");
    setSelectedDate(undefined);
    setAppliedStudentId("all");
    setAppliedSubject("all");
    setDateSearch('');
    setIsCalendarOpen(false);
  };

  // レポート閲覧ダイアログ用の状態
  const [showReportViewDialog, setShowReportViewDialog] = useState(false);
  const [viewReportBooking, setViewReportBooking] = useState<(Booking & { studentName?: string; tutorName?: string }) | null>(null);

  // 予約データの取得
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: !!user,
  });

  // 生徒データの取得
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!user,
  });
  
  // 講師データの取得
  const { data: tutors = [], isLoading: isLoadingTutors } = useQuery<Tutor[]>({
    queryKey: ["/api/tutors"],
    enabled: !!user,
  });
  
  // レッスンレポートデータの取得
  const { data: lessonReports = [], isLoading: isLoadingReports } = useQuery<LessonReport[]>({
    queryKey: ["/api/lesson-reports"],
    enabled: !!user && Array.isArray(students) && students.length > 0,
    queryFn: async () => {
      // ユーザーに紐づく生徒のレポートを取得
      if (!Array.isArray(students) || students.length === 0) return [];
      
      try {
        // すべての生徒のレポートを取得するためのプロミス配列
        const reportPromises = students.map(async (student) => {
          try {
            const response = await fetch(`/api/lesson-reports/student/${student.id}`);
            if (!response.ok) return [];
            return await response.json();
          } catch (error) {
            console.error(`生徒ID ${student.id} のレポート取得エラー:`, error);
            return [];
          }
        });
        
        // すべてのプロミスを解決して結果を結合
        const allReportsArrays = await Promise.all(reportPromises);
        return allReportsArrays.flat();
      } catch (error) {
        console.error("レッスンレポート取得エラー:", error);
        return [];
      }
    }
  });

  // 生徒名を取得する関数
  const getStudentName = (studentId: number): string => {
    const student = students?.find((s: Student) => s.id === studentId);
    return student ? `${student.lastName} ${student.firstName}` : `生徒ID: ${studentId}`;
  };
  
  // 講師名を取得する関数
  const getTutorName = (tutorId: number): string => {
    const tutor = tutors?.find((t: Tutor) => t.id === tutorId);
    return tutor ? `${tutor.lastName} ${tutor.firstName}` : `講師ID: ${tutorId}`;
  };

  // レポート閲覧ボタンのハンドラ
  const handleViewReportClick = (booking: Booking & { studentName?: string; tutorName?: string }) => {
    setViewReportBooking(booking);
    setShowReportViewDialog(true);
  };

  // レッスンレポートから表示用のデータを作成
  type ReportWithNames = LessonReport & {
    studentName?: string;
    tutorName?: string;
    subject?: string;
  };
  
  const getReportsWithNames = (): ReportWithNames[] => {
    if (!Array.isArray(lessonReports) || lessonReports.length === 0) {
      return [];
    }
    
    // レポートデータに生徒名と講師名を追加
    return lessonReports.map((report: LessonReport) => {
      // レポートに対応する予約を検索して科目情報を取得
      const booking = Array.isArray(bookings) 
        ? bookings.find((b: Booking) => b.id === report.bookingId) 
        : null;
      
      return {
        ...report,
        // 予約から科目情報を取得
        subject: booking?.subject,
        // 生徒名と講師名を追加
        studentName: report.studentId ? getStudentName(report.studentId) : undefined,
        tutorName: report.tutorId ? getTutorName(report.tutorId) : undefined
      };
    }).sort((a, b) => {
      // 日付の降順でソート（最新のレポートが一番上）
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  };
  
  // レポートのフィルタリング関数
  const filterReport = (report: ReportWithNames): boolean => {
    // 1. 生徒IDによるフィルタリング
    // 「すべての生徒」を選択、または生徒IDが一致する場合のみ表示
    const matchStudent = 
      appliedStudentId === "all" || 
      (report.studentId !== null && report.studentId !== undefined && 
       String(report.studentId) === appliedStudentId);
    
    // 2. 教科でフィルタリング
    const matchSubject = 
      appliedSubject === "all" || 
      (report.subject && report.subject === appliedSubject);
    
    // 3. 日付でフィルタリング
    let matchDate = true;
    if (dateSearch) {
      // nullチェックを追加
      if (report.date) {
        const reportDate = parseISO(report.date);
        const filterDate = parseISO(dateSearch);
        matchDate = 
          reportDate.getFullYear() === filterDate.getFullYear() &&
          reportDate.getMonth() === filterDate.getMonth() &&
          reportDate.getDate() === filterDate.getDate();
      } else {
        matchDate = false;
      }
    }
    
    // すべての条件に一致するレポートのみを表示
    return Boolean(matchStudent && matchSubject && matchDate);
  };

  // ページ読み込み時に初期値を設定
  useEffect(() => {
    // 初期値を設定
    setAppliedStudentId(selectedStudentId);
    setAppliedSubject(subjectSearch);
  }, []);

  // カレンダーが表示されている間は外側のクリックを検出する
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // 検索フィルタリングを行う関数
  const filterBooking = (booking: Booking & { studentName?: string; tutorName?: string }): boolean => {
    // 1. 生徒IDによるフィルタリング
    // 「すべての生徒」を選択、または生徒IDが一致する場合のみ表示
    const matchStudent = 
      appliedStudentId === "all" || 
      (booking.studentId !== null && booking.studentId !== undefined && 
       String(booking.studentId) === appliedStudentId);
    
    // フィルタリングのデバッグログ（必要に応じて有効化する）
    // console.log(`フィルタリング: booking.studentId=${booking.studentId}, appliedStudentId=${appliedStudentId}, match=${matchStudent}`);
    
    // 2. 教科でフィルタリング
    const matchSubject = 
      appliedSubject === "all" || 
      booking.subject === appliedSubject;
    
    // 3. 日付でフィルタリング
    let matchDate = true;
    if (dateSearch) {
      const bookingDate = parseISO(booking.date);
      const filterDate = parseISO(dateSearch);
      matchDate = 
        bookingDate.getFullYear() === filterDate.getFullYear() &&
        bookingDate.getMonth() === filterDate.getMonth() &&
        bookingDate.getDate() === filterDate.getDate();
    }
    
    // すべての条件に一致する予約のみを表示
    return Boolean(matchStudent && matchSubject && matchDate);
  };
  
  // レッスンレポートを加工
  const reportsWithNames = getReportsWithNames();
  
  // フィルタリング適用済みのレポートデータ
  const filteredReports = reportsWithNames.filter(filterReport);
  
  // コンソールにレポートデータを表示（デバッグ用）
  console.log("レポートデータ:", reportsWithNames);
  
  // BookingCard用に表示形式に変換する関数
  const convertReportToBooking = (report: ReportWithNames): Booking & { studentName?: string; tutorName?: string } => {
    // 対応する予約データを検索
    const booking = Array.isArray(bookings) 
      ? bookings.find((b: Booking) => b.id === report.bookingId) 
      : null;
    
    // レポートデータと予約データを組み合わせて、BookingCardで表示可能な形式に変換
    return {
      id: report.bookingId,
      createdAt: report.createdAt,
      userId: booking?.userId || 0,
      tutorId: report.tutorId || 0,
      studentId: report.studentId || 0,
      tutorShiftId: booking?.tutorShiftId || 0,
      date: report.date || "",
      timeSlot: report.timeSlot || "",
      subject: report.subject || "",
      status: "confirmed",
      reportStatus: "completed",
      reportContent: `【単元】\n${report.unitContent || ""}\n\n【伝言事項】\n${report.messageContent || ""}\n\n【来週までの目標(課題)】\n${report.goalContent || ""}`,
      studentName: report.studentName,
      tutorName: report.tutorName
    };
  };
  
  // 表示用のデータを予約形式に変換
  const displayBookings = filteredReports.map(convertReportToBooking);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* CommonHeaderを使用 */}
      <CommonHeader showBackButton={true} title="F education" />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">授業レポート一覧</h2>
          <p className="mt-1 text-sm text-gray-600">完了した授業のレポートを確認できます</p>
        </div>
        
        {/* 検索フィールド（生徒名と教科を横に並べて、日付は下に） */}
        <div className="mb-4 space-y-2">
          {/* 生徒名と教科の検索欄を横に並べる */}
          <div className="grid grid-cols-2 gap-2">
            {/* 生徒名ドロップダウン */}
            <div className="relative">
              <Select 
                value={selectedStudentId} 
                onValueChange={(value) => {
                  // 生徒IDを選択状態として記録するだけ（検索ボタンで適用する）
                  setSelectedStudentId(value);
                }}
              >
                <SelectTrigger className="pl-9">
                  <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <SelectValue placeholder="生徒名で検索" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての生徒</SelectItem>
                  {students?.map((student: Student) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.lastName} {student.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 教科ドロップダウン */}
            <div className="relative">
              <Select 
                value={subjectSearch} 
                onValueChange={(value) => {
                  // 教科を選択状態として記録するだけ（検索ボタンで適用する）
                  setSubjectSearch(value);
                }}
              >
                <SelectTrigger className="pl-9">
                  <BookOpen className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <SelectValue placeholder="教科で検索" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての教科</SelectItem>
                  {SUBJECTS.map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 日付検索欄とフィルタボタン */}
          <div className="grid grid-cols-[1fr,auto] gap-2 items-start">
            <div className="relative">
              <Button
                variant="outline"
                className="w-full justify-start pl-9 text-left font-normal"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              >
                <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <span className={selectedDate ? "" : "text-muted-foreground"}>
                  {selectedDate 
                    ? format(selectedDate, 'yyyy年MM月dd日', { locale: ja })
                    : "日付で検索"}
                </span>
              </Button>
            </div>
            
            {/* 検索ボタン */}
            <Button 
              onClick={applyFilters}
              className="min-w-28 h-10"
            >
              <Search className="h-4 w-4 mr-2" />
              検索
            </Button>
            
            {isCalendarOpen && (
              <div ref={calendarRef}>
                <Card className="absolute z-50 mt-1 w-auto">
                  <CardContent className="p-2">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        // カレンダーは閉じない
                      }}
                      initialFocus
                      locale={ja}
                    />
                    <div className="pt-2 border-t mt-2 flex justify-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          // カレンダーをクリアして、適用する
                          setSelectedDate(undefined);
                          setIsCalendarOpen(false);
                        }}
                      >
                        クリア
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
        
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">レポート一覧</h2>
            <div className="text-sm text-gray-500">
              {displayBookings.length}件のレポート
            </div>
          </div>
          
          {isLoadingBookings || isLoadingStudents ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayBookings.length > 0 ? (
            <div className="space-y-3">
              {displayBookings.map((booking: Booking & { studentName?: string; tutorName?: string }) => (
                <div key={booking.id} className="group relative">
                  <BookingCard 
                    booking={booking}
                    onViewReportClick={handleViewReportClick}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">レポートはまだありません</p>
              <p className="text-sm text-gray-400 mt-1">
                授業が完了し、講師がレポートを提出すると、ここに表示されます
              </p>
            </div>
          )}
        </Card>
      </main>
      
      {/* レポート閲覧モーダル */}
      {viewReportBooking && (
        <ReportViewModal
          isOpen={showReportViewDialog}
          booking={viewReportBooking}
          onClose={() => setShowReportViewDialog(false)}
        />
      )}
    </div>
  );
}