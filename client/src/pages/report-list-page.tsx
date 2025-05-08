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
import type { Booking, Student } from "@shared/schema";
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
    setAppliedStudentId(selectedStudentId);
    setAppliedSubject(subjectSearch);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setDateSearch(formattedDate);
    } else {
      setDateSearch('');
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
  const [viewReportBooking, setViewReportBooking] = useState<(Booking & { studentName?: string }) | null>(null);

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

  // 生徒名を取得する関数
  const getStudentName = (studentId: number): string => {
    const student = students?.find((s: Student) => s.id === studentId);
    return student ? `${student.lastName} ${student.firstName}` : `生徒ID: ${studentId}`;
  };

  // レポート閲覧ボタンのハンドラ
  const handleViewReportClick = (booking: Booking & { studentName?: string }) => {
    setViewReportBooking(booking);
    setShowReportViewDialog(true);
  };

  // レポートがある予約のみをフィルタリング
  const reportedBookings = Array.isArray(bookings) 
    ? bookings
        .filter((booking: Booking) => booking.reportStatus === 'completed')
        .map((booking: Booking) => ({
          ...booking,
          studentName: booking.studentId ? getStudentName(booking.studentId) : undefined
        }))
        .sort((a: Booking & { studentName?: string }, b: Booking & { studentName?: string }) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()) // 日付の降順でソート
    : [];

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
  const filterBooking = (booking: Booking & { studentName?: string }): boolean => {
    // 1. 生徒IDでフィルタリング
    const matchStudentId = 
      appliedStudentId === "all" || 
      (booking.studentId !== null && booking.studentId.toString() === appliedStudentId);
    
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
    return matchStudentId && matchSubject && matchDate;
  };
  
  // フィルタリング適用済みのデータ
  const filteredBookings = reportedBookings.filter(filterBooking);

  // テスト用のデータ（フィルタリングに対応）
  const getTestReportedBookings = (): (Booking & { studentName?: string })[] => {
    const data = [
      {
        id: 9001,
        createdAt: new Date(),
        userId: user ? user.id : 0,
        tutorId: 1,
        studentId: 4,
        tutorShiftId: 1,
        date: "2025-04-15",
        timeSlot: "16:00-17:30",
        subject: "数学",
        status: "confirmed" as const,
        reportStatus: "completed" as const,
        reportContent: "中学1年の方程式\n授業中は集中して取り組めていました。解説を聞いて理解しようとする姿勢が素晴らしいです。\n次回までに教科書p.45-46の問題を解いてきてください。",
        studentName: "テスト 太郎"
      },
      {
        id: 9002,
        createdAt: new Date(),
        userId: user ? user.id : 0,
        tutorId: 1,
        studentId: 4,
        tutorShiftId: 1,
        date: "2025-04-01",
        timeSlot: "16:00-17:30",
        subject: "英語",
        status: "confirmed" as const,
        reportStatus: "completed" as const,
        reportContent: "中学1年の不定詞\n文法の理解が進んでいます。演習問題では8割以上正解できていました。\n次回までに教科書p.32の例文を音読練習してきてください。",
        studentName: "テスト 太郎"
      }
    ];
    
    // 同じフィルタリング関数をテストデータにも適用
    return data.filter(filterBooking);
  };

  // 最終的に表示するデータ
  // 実際のデータがある場合はフィルター結果を、無い場合はフィルタリング適用済みのテストデータを表示
  const hasRealData = reportedBookings.length > 0;
  const testFilteredBookings = getTestReportedBookings();
  const displayBookings = hasRealData ? filteredBookings : testFilteredBookings;

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
                  // 生徒IDが選択されたらすぐにフィルタリングに反映
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
                  // 教科が選択されたらすぐにフィルタリングに反映
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
            
            {/* 検索ボタンとクリアボタン */}
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                onClick={clearAllFilters}
                className="h-10"
              >
                <X className="h-4 w-4 mr-2" />
                クリア
              </Button>
              <Button 
                onClick={applyFilters}
                className="min-w-28 h-10"
              >
                <Search className="h-4 w-4 mr-2" />
                検索
              </Button>
            </div>
            
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
                    <div className="pt-2 border-t mt-2 flex justify-between">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          // カレンダーをクリアするだけで、実際のフィルタには反映しない
                          setSelectedDate(undefined);
                        }}
                      >
                        クリア
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (selectedDate) {
                            // 選択された日付に合わせて検索フィルターを適用
                            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
                            setDateSearch(formattedDate);
                          }
                          setIsCalendarOpen(false);
                        }}
                      >
                        検索
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
              {displayBookings.map((booking: Booking & { studentName?: string }) => (
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