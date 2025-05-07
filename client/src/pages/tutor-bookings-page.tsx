import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookingDetailModal } from "@/components/booking-detail-modal";
import { CalendarView } from "@/components/calendar-view";
import { Calendar } from "@/components/ui/calendar";
import { ReportViewModal } from "@/components/report-view-modal";
import { ReportEditModal } from "@/components/report-edit-modal";

// 予約情報の型定義
// 基本的な予約型
type Booking = {
  id: number;
  userId: number;
  tutorId: number;
  studentId: number | null;
  tutorShiftId?: number;
  date: string;
  timeSlot: string;
  subject: string | null;
  status: string | null;
  reportStatus?: string | null;
  reportContent?: string | null;
  createdAt: string;
  studentName?: string;
  openEditAfterClose?: boolean; // 編集ボタンがクリックされたフラグ
};

// カレンダーコンポーネント用の拡張された予約型
type ExtendedBooking = Omit<Booking, "createdAt"> & {
  createdAt: string | Date;
  studentName?: string;
  openEditAfterClose?: boolean;
  // lesson_reportsテーブルから取得したデータ
  lessonReport?: {
    id: number;
    bookingId: number;
    tutorId: number;
    studentId: number | null;
    unitContent: string;
    messageContent: string | null;
    goalContent: string | null;
    createdAt: Date;
    updatedAt: Date;
    date?: string | null;
    timeSlot?: string | null;
  } | null;
};

// 生徒情報の型
type Student = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  grade: string;
  schoolType: string;
  notes?: string | null;
  createdAt: string;
};

// 講師プロフィールの型
type TutorProfile = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  subjects: string[];
  grades: string[];
  email?: string;
  phone?: string;
  bio?: string;
  createdAt: string;
};

export default function TutorBookingsPage() {
  const navigate = useLocation()[1];
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // UIの状態管理
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedBooking, setSelectedBooking] = useState<ExtendedBooking | null>(
    null,
  );
  const [reportEditBooking, setReportEditBooking] = useState<ExtendedBooking | null>(
    null,
  );
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [showReportViewModal, setShowReportViewModal] = useState(false);
  const [showReportEditModal, setShowReportEditModal] = useState(false);
  const [tempEditReportCallback, setTempEditReportCallback] = useState<
    (() => void) | null
  >(null);
  const [hideReportedLessons, setHideReportedLessons] = useState(false);
  
  // レポート情報のキャッシュ管理
  const [reportCache, setReportCache] = useState<Record<string, any>>({});
  const [loadedReportIds, setLoadedReportIds] = useState<Set<number>>(new Set());

  // 講師プロフィール情報を取得
  const { data: tutorProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/tutor/profile"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor profile");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor profile:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!user && user.role === "tutor",
  });

  // 生徒情報の取得
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/students");
        if (!response.ok) {
          throw new Error("Failed to fetch students");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching students:", error);
        throw error;
      }
    },
    retry: false,
  });

  // 生徒IDから生徒名を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;

    const student = students.find((s: Student) => s.id === studentId);
    if (!student) return undefined;
    return `${student.lastName} ${student.firstName}`;
  };

  // 予約情報の取得
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["/api/tutor/bookings"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/tutor/bookings");
        if (!response.ok) {
          throw new Error("Failed to fetch tutor bookings");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching tutor bookings:", error);
        throw error;
      }
    },
    retry: false,
    enabled: !!tutorProfile,
  });

  // レッスンレポート情報を一括取得（講師IDに紐づくレポート）
  const { data: lessonReports } = useQuery({
    queryKey: ["/api/lesson-reports/tutor", tutorProfile?.id],
    queryFn: async () => {
      try {
        if (!tutorProfile?.id) {
          return [];
        }
        const response = await fetch(`/api/lesson-reports/tutor/${tutorProfile.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch lesson reports");
        }
        
        const reports = await response.json();
        
        // レポートをbookingIdでインデックス化してキャッシュに保存
        const reportsByBookingId: Record<number, any> = {};
        reports.forEach((report: any) => {
          reportsByBookingId[report.bookingId] = report;
        });
        
        // キャッシュに一括保存
        setReportCache(reportsByBookingId);
        
        return reports;
      } catch (error) {
        console.error("Error fetching lesson reports:", error);
        return [];
      }
    },
    retry: false,
    enabled: !!tutorProfile?.id,
  });

  // 講師でない場合はリダイレクト
  useEffect(() => {
    if (user && user.role !== "tutor") {
      navigate("/");
    }
  }, [user, navigate]);

  // コンポーネント間で共有する編集関数
  const openReportEditModalFn = useCallback((booking: any) => {
    console.log("編集関数が呼び出されました", booking);

    if (!booking) {
      console.error("レポート編集対象の予約データがありません");
      return;
    }

    // 必要なデータを準備
    const reportEditData: ExtendedBooking = {
      id: booking.id,
      userId: booking.userId,
      tutorId: booking.tutorId,
      studentId: booking.studentId,
      tutorShiftId: booking.tutorShiftId || 0,
      date: booking.date,
      timeSlot: booking.timeSlot,
      subject: booking.subject || "",
      status: booking.status || "",
      reportStatus: booking.reportStatus || null,
      reportContent: booking.reportContent || "",
      createdAt:
        typeof booking.createdAt === "object"
          ? booking.createdAt.toISOString()
          : booking.createdAt,
      studentName: booking.studentName || getStudentName(booking.studentId),
      // lessonReportがある場合はそれも含める
      lessonReport: booking.lessonReport || null
    };

    // レポート表示モーダルを確実に閉じる
    setShowReportViewModal(false);

    // モーダルを設定して表示
    setReportEditBooking(reportEditData);

    // 最も確実な方法: UIリフレッシュを待ってから実行（React の状態更新後）
    setTimeout(() => {
      console.log("編集モーダルを表示します", reportEditData);
      setShowReportEditModal(true);
    }, 300); // タイミングを伸ばして確実に実行されるようにする
  }, []);

  // グローバルオブジェクトに関数を設定（コンポーネント間での共有用）
  useEffect(() => {
    // 標準的なグローバル関数
    (window as any).openReportEditModal = openReportEditModalFn;

    // 直接モーダル状態を操作するための関数
    (window as any).setReportEditData = (booking: ExtendedBooking) => {
      console.log("window.setReportEditData が呼び出されました:", booking);
      setReportEditBooking(booking);
      setTimeout(() => {
        setShowReportEditModal(true);
        console.log("編集モーダルの表示フラグをtrueに設定しました");
      }, 50);
    };

    // カスタムイベントリスナーの設定（代替手段として）
    const handleOpenReportEditEvent = (event: CustomEvent) => {
      console.log("カスタムイベント openReportEdit を受信:", event.detail);
      if (event.detail && event.detail.booking) {
        // カスタムイベントからのデータで直接編集モーダルを表示
        const booking = event.detail.booking;
        console.log("イベントから受信したデータで編集モーダルを表示します", booking);
        
        // 編集用データを設定
        setReportEditBooking(booking);
        
        // 編集モーダルを表示（非同期処理が完了してから）
        setTimeout(() => {
          setShowReportEditModal(true);
          console.log("編集モーダル表示完了！");
        }, 50);
      }
    };

    // イベントリスナーを追加（TypeScriptの型エラーを回避するためにanyを使用）
    window.addEventListener('openReportEdit', handleOpenReportEditEvent as any);

    // クリーンアップ
    return () => {
      delete (window as any).openReportEditModal;
      delete (window as any).setReportEditData;
      window.removeEventListener('openReportEdit', handleOpenReportEditEvent as any);
    };
  }, [openReportEditModalFn]);
  
  // グローバル変数を監視するためのコードを追加
  useEffect(() => {
    // 100ms毎にグローバル変数をチェック
    const intervalId = setInterval(() => {
      try {
        if ((window as any).REPORT_EDIT_MODAL_SHOULD_OPEN) {
          console.log("グローバル変数が変更されました - レポート編集モーダルを開きます");
          if ((window as any).REPORT_EDIT_DATA) {
            const data = (window as any).REPORT_EDIT_DATA;
            console.log("グローバル変数のデータを使用します", data);
            // 編集用データを設定
            setReportEditBooking(data);
            
            // 少し遅延を入れてから編集モーダルを表示
            setTimeout(() => {
              setShowReportEditModal(true);
              console.log("レポート編集モーダルを表示しました");
            }, 100);
          } else {
            // データがない場合は選択中の予約を使用
            console.log("グローバル変数のデータがないため、選択中の予約を使用します", selectedBooking);
            if (selectedBooking) {
              setReportEditBooking(selectedBooking);
              setTimeout(() => {
                setShowReportEditModal(true);
                console.log("レポート編集モーダルを表示しました（選択中の予約を使用）");
              }, 100);
            }
          }
          
          // 使い終わったらリセット
          (window as any).REPORT_EDIT_MODAL_SHOULD_OPEN = false;
          (window as any).REPORT_EDIT_DATA = null;
        }
      } catch (e) {
        console.error("グローバル変数チェック中にエラーが発生しました:", e);
      }
    }, 100);
    
    return () => clearInterval(intervalId);
  }, [selectedBooking]);

  // 生徒IDから生徒名を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;

    const student = students.find((s: Student) => s.id === studentId);
    if (!student) return undefined;
    return `${student.lastName} ${student.firstName}`;
  };
  
  // コンポーネントマウント時にすべての予約のレポート情報を一括取得
  useEffect(() => {
    if (bookings && bookings.length > 0) {
      console.log("すべての予約のレポート情報を事前に一括取得します");
      
      // 過去の予約IDのリストを作成
      const pastBookingIds = bookings
        .filter((booking: Booking) => {
          const bookingDate = parseISO(booking.date);
          return isBefore(bookingDate, new Date()) && !isToday(bookingDate);
        })
        .map((booking: Booking) => booking.id);
      
      // すべてのレポート情報を一括取得
      Promise.all(
        pastBookingIds.map((id: number) => 
          fetch(`/api/lesson-reports/booking/${id}`)
            .then(response => {
              if (response.status === 404) return { bookingId: id, report: null };
              if (response.ok) return response.json().then((report: any) => ({ bookingId: id, report }));
              throw new Error(`予約ID ${id} のレポート情報取得に失敗`);
            })
            .catch(error => {
              console.error(`予約ID ${id} のレポート取得エラー:`, error);
              return { bookingId: id, report: null };
            })
        )
      ).then(results => {
        // キャッシュに情報を保存
        const newCache = { ...reportCache };
        const loadedIds = new Set(loadedReportIds);
        
        results.forEach(({ bookingId, report }) => {
          newCache[bookingId] = report;
          loadedIds.add(bookingId);
        });
        
        console.log(`${results.length}件のレポート情報をキャッシュに保存しました`);
        setReportCache(newCache);
        setLoadedReportIds(loadedIds);
      });
    }
  }, [bookings, reportCache, loadedReportIds]); // 依存配列を適切に設定
  
  // レポートを取得する関数（同期版 - すぐに結果を返す）
  const getReportForBooking = (bookingId: number): any => {
    // キャッシュにあればそれを返す
    if (reportCache[bookingId] !== undefined || loadedReportIds.has(bookingId)) {
      return reportCache[bookingId];
    }
    
    // キャッシュにない場合は即時取得を開始
    console.log(`予約ID ${bookingId} のレポート情報をオンデマンドで取得します`);
    fetch(`/api/lesson-reports/booking/${bookingId}`)
      .then(response => {
        if (response.status === 404) return null;
        if (response.ok) return response.json();
        throw new Error(`レポート情報の取得に失敗しました (${response.status})`);
      })
      .then(report => {
        if (report) {
          console.log(`予約ID ${bookingId} のレポート情報を取得しました:`, report);
        } else {
          console.log(`予約ID ${bookingId} にはレポートがありません`);
        }
        
        // キャッシュに情報を保存
        setReportCache(prev => ({
          ...prev,
          [bookingId]: report
        }));
        
        // ロード済みIDに追加
        setLoadedReportIds(prev => new Set(prev).add(bookingId));
      })
      .catch(error => {
        console.error(`予約ID ${bookingId} のレポート取得エラー:`, error);
        // エラー時もロード済みとしてマーク
        setLoadedReportIds(prev => new Set(prev).add(bookingId));
      });
    
    // レポートがまだ取得されていないため null を返す
    return null;
  };
  
  // 非同期版 - Promise を返す
  const fetchReportForBooking = async (bookingId: number): Promise<any> => {
    // キャッシュにあればそれを返す
    if (reportCache[bookingId] !== undefined) {
      return reportCache[bookingId];
    }
    
    try {
      const response = await fetch(`/api/lesson-reports/booking/${bookingId}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`レポート情報の取得に失敗しました (${response.status})`);
      
      const report = await response.json();
      
      // キャッシュに情報を保存
      setReportCache(prev => ({
        ...prev,
        [bookingId]: report
      }));
      
      // ロード済みIDに追加
      setLoadedReportIds(prev => new Set(prev).add(bookingId));
      
      return report;
    } catch (error) {
      console.error(`予約ID ${bookingId} のレポート取得エラー:`, error);
      return null;
    }
  };

  // 予約カードコンポーネント - コンポーネントを内部で定義し直して必要な状態と関数にアクセスできるようにする
  function BookingCard({
    booking,
    isPast = false,
  }: {
    booking: Booking;
    isPast?: boolean;
  }) {
    const bookingDate = parseISO(booking.date);
    const formattedDate = format(bookingDate, "yyyy年M月d日(E)", {
      locale: ja,
    });

    // レポート情報を取得 - lessonReportsテーブルを参照
    const report = getReportForBooking(booking.id);
    // レポート作成状況のチェック - lesson_reportsテーブルから確認
    const hasReport = !!report;

    return (
      <div
        className={`p-4 border rounded-lg ${isPast ? "bg-muted/50" : ""} hover:bg-gray-50 cursor-pointer`}
        onClick={async () => {
          // レポート作成済みか確認
          if (hasReport) {
            console.log(
              "レポート作成済みの予約がクリックされました - 詳細取得してからレポート表示",
            );

            try {
              // 予約の詳細情報を取得（生徒情報や前回のレポートも含む）
              const response = await fetch(`/api/bookings/${booking.id}`);
              if (response.ok) {
                const bookingDetails = await response.json();

                // 詳細データを設定
                const enhancedBookingDetails = {
                  ...bookingDetails,
                  studentName:
                    bookingDetails.studentName ||
                    getStudentName(bookingDetails.studentId),
                  tutorName:
                    tutorProfile?.lastName + " " + tutorProfile?.firstName,
                };

                // 選択された予約とレポート編集用データを設定
                setSelectedBooking(enhancedBookingDetails);
                setReportEditBooking(enhancedBookingDetails);

                // 詳細情報を表示
                console.log("詳細データ取得成功:", enhancedBookingDetails);

                // 生徒詳細情報があれば設定
                if (bookingDetails.studentDetails) {
                  setStudentDetails(bookingDetails.studentDetails);
                }

                // 直接コールバック関数を変数に保存して、デバッグ目的で状態を確認
                const editReportCallback = function () {
                  console.log(
                    "BookingCard内でのレポート編集コールバック実行",
                    enhancedBookingDetails,
                  );
                  setShowReportViewModal(false);
                  setReportEditBooking(enhancedBookingDetails);
                  setShowReportEditModal(true);
                };

                // 編集フラグとコールバックをセット
                setTempEditReportCallback(editReportCallback);

                // レポート詳細モーダルを表示
                setShowReportViewModal(true);
              } else {
                // 詳細が取得できない場合は、基本情報のみで表示
                console.log("詳細情報取得失敗 - 基本情報のみ表示");
                setSelectedBooking(booking);
                setReportEditBooking({ ...booking });
                setShowReportViewModal(true);
              }
            } catch (error) {
              console.error("予約詳細取得エラー:", error);
              // エラー時も基本情報で表示
              setSelectedBooking(booking);
              setReportEditBooking({ ...booking });
              setShowReportViewModal(true);
            }
          } else {
            // 通常の処理
            handleBookingClick(booking);
          }
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-lg">{formattedDate}</h3>
            <p className="text-md">{booking.timeSlot}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={
                booking.status === "cancelled" ? "destructive" : "default"
              }
            >
              {booking.status === "cancelled" ? "キャンセル" : "確定"}
            </Badge>

            {/* レポート状態バッジを追加 */}
            {hasReport ? (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                レポート済
              </Badge>
            ) : isPast ? (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200"
              >
                レポート未作成
              </Badge>
            ) : null}
          </div>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">科目</p>
            <p>{booking.subject || "未設定"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">生徒</p>
            <p>{getStudentName(booking.studentId) || "未設定"}</p>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            予約ID: {booking.id}
          </div>

          {/* 過去の授業の場合はレポート編集/作成ボタンを表示 */}
          {isPast && (
            <Button
              size="sm"
              variant={hasReport ? "outline" : "default"}
              className={
                hasReport
                  ? "border-amber-500 text-amber-600 hover:bg-amber-50"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
              onClick={(e) => {
                // イベントの伝播を止めてカード自体のクリックイベントが発火しないようにする
                e.stopPropagation();

                console.log(
                  "レポート作成/編集ボタンがクリックされました",
                  booking,
                );

                // まず予約情報の詳細を取得
                fetch(`/api/bookings/${booking.id}`)
                  .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('予約詳細の取得に失敗しました');
                  })
                  .then(bookingDetails => {
                    console.log("レポート編集用の予約詳細を取得しました", bookingDetails);
                    
                    // 次にlessonReportsテーブルからレポート情報を取得
                    return fetch(`/api/lesson-reports/booking/${booking.id}`)
                      .then(response => {
                        // 404の場合はnullを返す（レポートが存在しない）
                        if (response.status === 404) return { bookingDetails, lessonReport: null };
                        if (response.ok) return response.json().then(lessonReport => ({ bookingDetails, lessonReport }));
                        throw new Error('レポート情報の取得に失敗しました');
                      });
                  })
                  .then(({ bookingDetails, lessonReport }) => {
                    console.log("レポート情報:", lessonReport);
                    
                    // レポート編集用のデータを設定
                    const enhancedBooking = {
                      ...booking,
                      id: booking.id,
                      userId: booking.userId,
                      tutorId: booking.tutorId,
                      studentId: booking.studentId,
                      tutorShiftId: booking.tutorShiftId || 0,
                      date: booking.date,
                      timeSlot: booking.timeSlot,
                      subject: booking.subject || "",
                      status: booking.status || null,
                      createdAt: booking.createdAt,
                      reportStatus: booking.reportStatus || null,
                      reportContent: booking.reportContent || "",
                      studentName: getStudentName(booking.studentId),
                      // 新たにlessonReportデータを追加
                      lessonReport: lessonReport
                    };
                    
                    setReportEditBooking(enhancedBooking);
                    
                    // 編集モーダルを表示
                    setTimeout(() => {
                      setShowReportEditModal(true);
                    }, 50);
                  })
                  .catch(error => {
                    console.error("レポート編集データの取得エラー:", error);
                    // エラー時は基本情報だけで編集モーダルを表示
                    const basicBooking = {
                      ...booking,
                      studentName: getStudentName(booking.studentId),
                    };
                    setReportEditBooking(basicBooking);
                    setTimeout(() => {
                      setShowReportEditModal(true);
                    }, 50);
                  });
              }}
            >
              {hasReport ? "レポート編集" : "レポート作成"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 今日以降の予約
  const upcomingBookings =
    bookings?.filter((booking: Booking) => {
      const bookingDate = parseISO(booking.date);
      return !isBefore(bookingDate, new Date()) || isToday(bookingDate);
    }) || [];

  // 過去の予約 - レポート状態を考慮したフィルタリング
  const pastBookings =
    bookings?.filter((booking: Booking) => {
      const bookingDate = parseISO(booking.date);
      const isPastBooking = isBefore(bookingDate, new Date()) && !isToday(bookingDate);
      
      if (!isPastBooking) return false;
      
      // レポート済みかどうかをチェック
      const report = getReportForBooking(booking.id);
      
      // レポート未作成の予約のみを表示する場合
      if (hideReportedLessons && report) {
        return false; // レポート済みの予約は表示しない
      }
      
      return true;
    }) || [];

  // 選択した日付の予約
  const selectedDateStr = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : "";
  const bookingsOnSelectedDate =
    bookings?.filter((booking: Booking) => booking.date === selectedDateStr) ||
    [];

  // カレンダーに予約のある日付をハイライト表示するための関数
  const getBookingDates = () => {
    if (!bookings) return [];

    // 予約のある日付のみを抽出
    const dates = bookings.map((booking: Booking) => booking.date);
    // 重複を除去（配列を使用）
    const uniqueDates = Array.from(new Set(dates));
    // Date型に変換
    return uniqueDates.map((date) => parseISO(date as string));
  };

  // レポート編集モーダルを表示するハンドラー - 完全に再実装（最終解決策）
  const handleOpenReportEditModal = () => {
    console.log(
      "レポート編集モーダルを開きます（グローバル関数）",
      selectedBooking,
    );

    if (!selectedBooking) {
      console.error("レポート編集対象の予約が選択されていません");
      return;
    }

    // 編集用の予約データを個別に保持する
    setReportEditBooking({
      ...selectedBooking,
      id: selectedBooking.id,
      userId: selectedBooking.userId,
      tutorId: selectedBooking.tutorId,
      studentId: selectedBooking.studentId,
      tutorShiftId: selectedBooking.tutorShiftId || 0,
      date: selectedBooking.date,
      timeSlot: selectedBooking.timeSlot,
      subject: selectedBooking.subject || "",
      status: selectedBooking.status || null,
      createdAt: selectedBooking.createdAt,
      reportStatus: selectedBooking.reportStatus || null,
      reportContent: selectedBooking.reportContent || "",
    });

    // 詳細モーダルを閉じる
    setShowBookingDetailModal(false);

    // 同期的に実行しても非同期的に実行されるため、レンダリングサイクルの後に実行されるようにする
    setTimeout(() => {
      // レポート編集モーダルを表示
      setShowReportEditModal(true);
      console.log("編集モーダルを表示しました - データ:", reportEditBooking);
    }, 50); // タイミングを短くする
  };

  const bookingDates = getBookingDates();
  
  // 既にレッスンレポート情報の取得はuseQuery内でcacheに保存されているので削除

  // 予約カードがクリックされたときの処理
  const handleBookingClick = async (booking: ExtendedBooking) => {
    try {
      console.log("予約クリック:", booking);

      // 予約の詳細情報を取得 (生徒情報や前回のレポートも含む)
      const response = await fetch(`/api/bookings/${booking.id}`);
      if (response.ok) {
        const bookingDetails = await response.json();

        // デバッグ出力を追加
        console.log("詳細情報取得成功:", bookingDetails);

        // 生徒情報があればログ出力
        if (bookingDetails.studentDetails) {
          console.log("生徒詳細情報:", bookingDetails.studentDetails);
        }

        // 前回のレポート情報があればログ出力
        if (bookingDetails.previousReport) {
          console.log("前回のレポート:", bookingDetails.previousReport);
        }

        // 編集ボタン表示のためにselectedBookingに完全な情報を設定
        // 必要なフィールドが全て含まれるように明示的に指定
        const enhancedBookingDetails = {
          ...bookingDetails,
          id: bookingDetails.id,
          userId: bookingDetails.userId,
          tutorId: bookingDetails.tutorId,
          studentId: bookingDetails.studentId,
          tutorShiftId: bookingDetails.tutorShiftId || 0,
          date: bookingDetails.date,
          timeSlot: bookingDetails.timeSlot,
          subject: bookingDetails.subject,
          status: bookingDetails.status || null,
          createdAt: bookingDetails.createdAt,
          reportStatus: bookingDetails.reportStatus || null,
          reportContent: bookingDetails.reportContent || "",
          studentName:
            bookingDetails.studentName ||
            getStudentName(bookingDetails.studentId),
        };

        // 完全な予約情報をコンソールに出力（デバッグ用）
        console.log("完全な予約情報:", enhancedBookingDetails);

        // 選択された予約を設定
        setSelectedBooking(enhancedBookingDetails);

        // レポート編集用の予約データも設定（カレンダービューからの直接編集のため）
        setReportEditBooking({
          ...enhancedBookingDetails,
        });

        // 生徒詳細情報を設定
        setStudentDetails(bookingDetails.studentDetails || null);
      } else {
        // 詳細が取得できない場合は、元の予約情報を使用
        setSelectedBooking(booking);

        // レポート編集用のデータも同様に設定
        // createdAtが日付型の場合は文字列に変換する
        const reportEditData: ExtendedBooking = {
          ...booking,
          reportStatus: booking.reportStatus || null,
          reportContent: booking.reportContent || "",
          tutorShiftId: booking.tutorShiftId || 0,
          status: booking.status || null,
          // 型の不一致を避けるため明示的に文字列型を使用
          createdAt:
            typeof booking.createdAt === "object"
              ? booking.createdAt.toISOString()
              : booking.createdAt,
        };
        setReportEditBooking(reportEditData);

        // 生徒情報を個別に取得
        if (booking.studentId) {
          try {
            const studentResponse = await fetch(
              `/api/students/${booking.studentId}`,
            );
            if (studentResponse.ok) {
              const studentDetails = await studentResponse.json();
              setStudentDetails(studentDetails);
            } else {
              setStudentDetails(null);
            }
          } catch (error) {
            console.error("生徒情報の取得に失敗しました", error);
            setStudentDetails(null);
          }
        } else {
          setStudentDetails(null);
        }
      }
    } catch (error) {
      console.error("予約詳細の取得に失敗しました", error);
      setSelectedBooking(booking);
      setStudentDetails(null);

      // エラー時もレポート編集用データを設定しておく
      // createdAtが日付型の場合は文字列に変換する
      const errorReportEditData: ExtendedBooking = {
        ...booking,
        reportStatus: booking.reportStatus || null,
        reportContent: booking.reportContent || "",
        tutorShiftId: booking.tutorShiftId || 0,
        status: booking.status || null,
        // 型の不一致を避けるため明示的に文字列型を使用
        createdAt:
          typeof booking.createdAt === "object"
            ? booking.createdAt.toISOString()
            : booking.createdAt,
      };
      setReportEditBooking(errorReportEditData);
    }

    // 予約詳細情報の基本的な処理（共通）

    // レポート情報を取得 - lessonReportsテーブルを参照
    const report = getReportForBooking(booking.id);
    // レポート作成状況のチェック - lesson_reportsテーブルから確認
    const isCompletedWithReport = !!report;

    // レポートが作成済みなら直接レポート詳細モーダルを表示
    if (isCompletedWithReport) {
      console.log(
        "レポート作成済みのため、直接レポート詳細モーダルを表示します",
      );
      setShowReportViewModal(true);
    } else {
      // 通常の予約詳細モーダルを表示
      setShowBookingDetailModal(true);
    }
  };

  // 読み込み中の表示
  if (isLoadingProfile || isLoadingBookings || isLoadingStudents) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // 生徒名を含む予約データを作成
  const bookingsWithStudentNames =
    bookings?.map((booking: Booking) => ({
      ...booking,
      studentName: getStudentName(booking.studentId),
    })) || [];

  return (
    <div className="container py-4 md:py-8">
      <header className="bg-white mb-6">
        <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">予約管理</h1>
      </header>

      {/* デバッグ用説明 */}
      <div className="mb-6 p-3 md:p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h2 className="text-base md:text-lg font-semibold mb-2">レポート編集機能について</h2>
        <p className="mb-2 text-sm md:text-base">
          授業レポートの編集/作成が以下の方法で利用できます：
        </p>
        <ul className="list-disc pl-5 mb-3 text-sm md:text-base">
          <li>
            カレンダーでレポート作成済みの授業をクリックすると、レポート詳細モーダルが開きます
          </li>
          <li>
            レポート詳細モーダルに「レポートを編集」ボタンが常に表示されます
          </li>
          <li>ボタンをクリックすると、レポート編集モーダルが開きます</li>
          <li>
            過去の授業カードには「レポート編集」または「レポート作成」ボタンも表示されます
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* カレンダービュー（タブレット・デスクトップ・モバイル対応） */}
        <Card>
          <CardHeader>
            <CardTitle>予約カレンダー</CardTitle>
            <CardDescription>
              予約をクリックすると詳細が表示されます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarView
              key={`calendar-bookings-${bookingsWithStudentNames.length}`} // 強制再描画のためのkey
              showLegend={true} // 講師用は凡例を表示
              interactive={true} // インタラクティブにする
              onBookingClick={(booking) => {
                console.log("カレンダーから予約がクリックされました:", booking);
                // レポート情報を取得 - lessonReportsテーブルを参照
                const report = getReportForBooking(booking.id);
                // レポート作成状況のチェック - lesson_reportsテーブルから確認
                const hasReport = !!report;

                if (hasReport) {
                  console.log(
                    "レポート作成済みの予約 - 直接授業レポート表示モーダルを開きます",
                  );
                  // API呼び出しで詳細情報を取得
                  fetch(`/api/bookings/${booking.id}`)
                    .then((response) => {
                      if (response.ok) return response.json();
                      throw new Error("予約詳細の取得に失敗しました");
                    })
                    .then((bookingDetails) => {
                      // 予約・生徒情報をセット
                      const enhancedBookingDetails = {
                        ...bookingDetails,
                        studentName:
                          bookingDetails.studentName ||
                          getStudentName(bookingDetails.studentId),
                      };
                      setSelectedBooking(enhancedBookingDetails);

                      // レッスンレポート情報を取得
                      return fetch(`/api/lesson-reports/booking/${booking.id}`)
                        .then((response) => {
                          if (!response.ok) throw new Error("レポート情報の取得に失敗しました");
                          return response.json();
                        })
                        .then((lessonReport) => {
                          // レポート編集用データにレポート情報も含める
                          const reportEditData: ExtendedBooking = {
                            ...enhancedBookingDetails,
                            lessonReport,
                          };
                          setReportEditBooking(reportEditData);
                          setShowReportViewModal(true);
                        });
                    })
                    .catch((error) => {
                      console.error("予約・レポート詳細取得エラー:", error);
                      // エラー時は基本情報だけで表示
                      setSelectedBooking(booking);
                      setReportEditBooking({
                        ...booking,
                        studentName: getStudentName(booking.studentId),
                      });
                      setShowReportViewModal(true);
                    });
                } else {
                  console.log("通常の予約詳細を表示します");
                  // 通常の予約詳細取得処理
                  handleBookingClick(booking);
                }
              }}
              bookings={bookingsWithStudentNames}
              tutorId={tutorProfile?.id}
            />
          </CardContent>
        </Card>

        {/* 今日/今後の予約と過去の予約（タブビュー） */}
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">今後の予約</TabsTrigger>
            <TabsTrigger value="past">過去の予約</TabsTrigger>
            <TabsTrigger value="date">日付で検索</TabsTrigger>
          </TabsList>

          {/* 今後の予約リスト */}
          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>今後の予約</CardTitle>
                <CardDescription>今日以降の予約一覧</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingBookings.length === 0 ? (
                    <p className="text-muted-foreground col-span-full">
                      今後の予約はありません
                    </p>
                  ) : (
                    upcomingBookings.map((booking: Booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 過去の予約リスト */}
          <TabsContent value="past">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>過去の予約</CardTitle>
                  <CardDescription>
                    過去の予約一覧（レポート作成/編集可能）
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hideReported"
                    checked={hideReportedLessons}
                    onChange={(e) => setHideReportedLessons(e.target.checked)}
                    className="mr-1"
                  />
                  <label htmlFor="hideReported" className="text-sm">
                    レポート作成済みを非表示
                  </label>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastBookings.length === 0 ? (
                    <p className="text-muted-foreground col-span-full">
                      過去の予約はありません
                    </p>
                  ) : (
                    pastBookings.map((booking: Booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        isPast={true}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 日付で検索 */}
          <TabsContent value="date">
            <Card>
              <CardHeader>
                <CardTitle>日付で検索</CardTitle>
                <CardDescription>
                  カレンダーから日付を選び、その日の予約を表示します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* カレンダー選択部分 */}
                  <div>
                    <h3 className="text-lg font-medium mb-4">日付を選択</h3>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border"
                      disabled={
                        // 予約がある日付のみ選択可能にする
                        {
                          before: new Date(2020, 0, 1), // 2020年以前は選択不可
                          after: new Date(2030, 11, 31), // 2030年以降は選択不可
                          dates: bookingDates, // 予約がある日付のみ選択可能
                          outside: true, // 当月以外は選択不可
                        }
                      }
                    />
                  </div>

                  {/* 選択された日付の予約一覧 */}
                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      {selectedDate
                        ? format(selectedDate, "yyyy年M月d日", { locale: ja }) +
                          "の予約"
                        : "日付を選択してください"}
                    </h3>
                    <div className="space-y-4">
                      {!selectedDate ? (
                        <p className="text-muted-foreground">
                          左のカレンダーから日付を選択してください
                        </p>
                      ) : bookingsOnSelectedDate.length === 0 ? (
                        <p className="text-muted-foreground">
                          選択された日付の予約はありません
                        </p>
                      ) : (
                        bookingsOnSelectedDate.map((booking) => {
                          const isPast = isBefore(
                            parseISO(booking.date),
                            new Date(),
                          );
                          return (
                            <BookingCard
                              key={booking.id}
                              booking={booking}
                              isPast={isPast}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 予約詳細モーダル */}
      <BookingDetailModal
        isOpen={showBookingDetailModal}
        onClose={() => setShowBookingDetailModal(false)}
        booking={selectedBooking}
        studentDetails={studentDetails}
        onEditReport={handleOpenReportEditModal}
      />

      {/* レポート表示モーダル */}
      <ReportViewModal
        isOpen={showReportViewModal}
        onClose={() => setShowReportViewModal(false)}
        booking={selectedBooking}
        studentDetails={studentDetails}
        onEditReport={tempEditReportCallback || handleOpenReportEditModal}
      />

      {/* レポート編集モーダル */}
      <ReportEditModal
        isOpen={showReportEditModal}
        onClose={() => {
          // モーダルを閉じる際にはレポート更新状況をクエリクライアントに通知する
          setShowReportEditModal(false);
          
          // レポート情報をキャッシュから削除して最新の情報を取得するようにする
          if (reportEditBooking?.id) {
            const bookingId = reportEditBooking.id;
            // キャッシュからレポート情報を削除
            setReportCache(prev => {
              const newCache = { ...prev };
              delete newCache[bookingId];
              return newCache;
            });
            // ロード済みIDからも削除
            setLoadedReportIds(prev => {
              const newIds = new Set(prev);
              newIds.delete(bookingId);
              return newIds;
            });
            
            // 通知: レポートのキャッシュをクリアしました
            console.log(`予約ID ${bookingId} のレポートキャッシュをクリアしました`);
            
            // クエリの無効化も行ってデータを更新する
            queryClient.invalidateQueries({
              queryKey: ["/api/lesson-reports/tutor", tutorProfile?.id],
            });
            queryClient.invalidateQueries({
              queryKey: ["/api/tutor/bookings"],
            });
          }
        }}
        booking={reportEditBooking}
        onSuccess={() => {
          // レポート更新時は関連するクエリを全て無効化して最新データを取得
          queryClient.invalidateQueries({
            queryKey: ["/api/lesson-reports/tutor", tutorProfile?.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/tutor/bookings"],
          });
          
          // モーダルを閉じる
          setShowReportEditModal(false);
          
          // 特定の条件でレポート表示モーダルまたは詳細モーダルを表示
          if (reportEditBooking?.openEditAfterClose) {
            console.log(
              "レポート編集後に詳細表示モーダルを開きます",
              reportEditBooking,
            );
            setTimeout(() => {
              setShowReportViewModal(true);
            }, 100);
          }
        }}
      />
    </div>
  );
}