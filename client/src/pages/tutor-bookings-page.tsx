import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

export default function TutorBookingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedBooking, setSelectedBooking] = useState<
    ExtendedBooking | undefined
  >();
  const [showBookingDetailModal, setShowBookingDetailModal] = useState(false);
  const [showReportViewModal, setShowReportViewModal] = useState(false);
  const [showReportEditModal, setShowReportEditModal] = useState(false);
  const [reportEditBooking, setReportEditBooking] =
    useState<ExtendedBooking | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  
  // ページタイトルを設定し、URLパラメータを確認
  useEffect(() => {
    document.title = "講師予約管理";
    
    // URLからクエリパラメータを取得
    const params = new URLSearchParams(window.location.search);
    const editReportId = params.get('editReport');
    
    if (editReportId) {
      console.log("URLパラメータからレポート編集指示を検出:", editReportId);
      
      // セッションストレージからデータを取得
      try {
        const storedData = sessionStorage.getItem('EDIT_REPORT_DATA');
        if (storedData) {
          const reportData = JSON.parse(storedData);
          console.log("セッションストレージからレポートデータを取得:", reportData);
          
          // 編集モーダル用のデータを設定
          setReportEditBooking(reportData);
          
          // モーダルを表示
          setTimeout(() => {
            setShowReportEditModal(true);
            console.log("レポート編集モーダルを表示しました（URLパラメータ経由）");
            
            // URLからパラメータを削除（履歴を汚さないため）
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // セッションストレージをクリア
            sessionStorage.removeItem('EDIT_REPORT_DATA');
          }, 500);
        } else {
          console.log("セッションストレージにレポートデータがありません - APIで取得を試みます");
          
          // IDから予約データを取得して編集モーダルを開く
          fetch(`/api/bookings/${editReportId}`)
            .then(response => response.json())
            .then(bookingData => {
              console.log("APIから予約データを取得:", bookingData);
              
              // 編集モーダル用のデータを設定
              setReportEditBooking(bookingData);
              
              // モーダルを表示
              setTimeout(() => {
                setShowReportEditModal(true);
                console.log("レポート編集モーダルを表示しました（API取得データ）");
                
                // URLからパラメータを削除
                window.history.replaceState({}, document.title, window.location.pathname);
              }, 500);
            })
            .catch(error => {
              console.error("予約データの取得に失敗:", error);
              // URLからパラメータを削除
              window.history.replaceState({}, document.title, window.location.pathname);
            });
        }
      } catch (error) {
        console.error("セッションストレージからのデータ取得に失敗:", error);
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);
  const [tempEditReportCallback, setTempEditReportCallback] = useState<
    (() => void) | null
  >(null);
  // レポート情報をキャッシュする
  const [reportCache, setReportCache] = useState<{[key: number]: any}>({});
  
  // 生徒IDから生徒名を取得する関数
  const getStudentName = (studentId: number | null): string | undefined => {
    if (!studentId || !students) return undefined;
    const student = students.find((s: any) => s.id === studentId);
    if (!student) return undefined;
    return `${student.lastName} ${student.firstName}`;
  };
  
  // レポートを取得する関数（キャッシュを利用）
  const getReportForBooking = (bookingId: number): any => {
    // キャッシュにあればそれを返す
    if (reportCache[bookingId]) {
      return reportCache[bookingId];
    }
    
    // レッスンレポートの取得をリクエスト
    fetch(`/api/lesson-reports/booking/${bookingId}`)
      .then(response => {
        if (response.status === 404) return null;
        if (response.ok) return response.json();
        throw new Error('レポート情報の取得に失敗しました');
      })
      .then(report => {
        if (report) {
          // キャッシュに保存
          setReportCache(prev => ({
            ...prev,
            [bookingId]: report
          }));
        }
        return report;
      })
      .catch(error => {
        console.error("レポート取得エラー:", error);
        return null;
      });
    
    // 非同期処理の結果を待たずに現時点でのキャッシュ状態を返す
    return reportCache[bookingId] || null;
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
                      studentName: getStudentName(booking.studentId)
                    };
                    
                    setReportEditBooking(basicBooking);
                    setShowReportEditModal(true);
                  });

                // 編集モーダルを表示
                setTimeout(() => {
                  setShowReportEditModal(true);
                }, 50);
              }}
            >
              {hasReport ? "レポート編集" : "レポート作成"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // こちらの関数は使用していないので削除（handleOpenReportEditModalを使用）

  // 講師プロフィールの取得
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
        const reportsByBookingId = {};
        reports.forEach(report => {
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
  }, [getStudentName]);

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
  }, []);
  
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

  // 今日以降の予約
  const upcomingBookings =
    bookings?.filter((booking: Booking) => {
      const bookingDate = parseISO(booking.date);
      return !isBefore(bookingDate, new Date()) || isToday(bookingDate);
    }) || [];

  // 過去の予約
  const pastBookings =
    bookings?.filter((booking: Booking) => {
      const bookingDate = parseISO(booking.date);
      return isBefore(bookingDate, new Date()) && !isToday(bookingDate);
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
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">予約管理</h1>

      {/* デバッグ用説明 */}
      <div className="mb-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">レポート編集機能について</h2>
        <p className="mb-2">
          授業レポートの編集/作成が以下の方法で利用できます：
        </p>
        <ul className="list-disc pl-5 mb-4">
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
                      throw new Error("Failed to fetch booking details");
                    })
                    .then((bookingDetails) => {
                      // 詳細情報を設定
                      const enhancedBooking = {
                        ...bookingDetails,
                        studentName:
                          bookingDetails.studentName ||
                          getStudentName(bookingDetails.studentId),
                        tutorName:
                          tutorProfile?.lastName +
                          " " +
                          tutorProfile?.firstName,
                      };

                      // 生徒詳細情報があれば設定
                      if (bookingDetails.studentDetails) {
                        setStudentDetails(bookingDetails.studentDetails);
                      }

                      // 状態を更新して授業レポートモーダルを表示
                      setSelectedBooking(enhancedBooking);
                      
                      // 明示的に編集関数を定義
                      const openReportEditFn = function() {
                        console.log("レポートビューからの編集処理 - 新実装");
                        setShowReportViewModal(false);
                        
                        // 少し遅延を入れてから編集モーダルを開く
                        setTimeout(() => {
                          setReportEditBooking(enhancedBooking);
                          setShowReportEditModal(true);
                          console.log("レポート編集モーダルを開きました");
                        }, 200);
                      };
                      
                      // 新しい表示方法を使用
                      setTempEditReportCallback(() => openReportEditFn);
                      setShowReportViewModal(true);
                    })
                    .catch((error) => {
                      console.error("詳細情報取得エラー:", error);
                      // エラー発生時は通常のハンドラにフォールバック
                      handleBookingClick(booking);
                    });
                } else {
                  // 通常のハンドラを実行
                  handleBookingClick(booking);
                }
              }} // 直接インラインで実装
              bookings={bookingsWithStudentNames}
            />
          </CardContent>
        </Card>

        {/* 授業予約リスト */}
        <Card>
          <CardHeader>
            <CardTitle>授業予約一覧</CardTitle>
            <CardDescription>授業の予約状況を確認できます</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming">
                  今後の予約 ({upcomingBookings.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  過去の予約 ({pastBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming">
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    現在予約はありません
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {upcomingBookings.map((booking: Booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="past">
                {pastBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    過去の予約はありません
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {pastBookings.map((booking: Booking) => (
                      <BookingCard key={booking.id} booking={booking} isPast />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* 予約詳細モーダル */}
      {selectedBooking && (
        <BookingDetailModal
          isOpen={showBookingDetailModal}
          booking={{
            id: selectedBooking.id,
            userId: selectedBooking.userId,
            tutorId: selectedBooking.tutorId,
            studentId: selectedBooking.studentId,
            tutorShiftId: selectedBooking.tutorShiftId || 0,
            date: selectedBooking.date,
            timeSlot: selectedBooking.timeSlot,
            subject: selectedBooking.subject,
            status: selectedBooking.status,
            reportStatus: selectedBooking.reportStatus || null,
            reportContent: selectedBooking.reportContent || null,
            createdAt: selectedBooking.createdAt,
            studentName:
              selectedBooking.studentName ||
              getStudentName(selectedBooking.studentId),
            openEditAfterClose: selectedBooking.openEditAfterClose,
          }}
          studentDetails={studentDetails}
          onClose={() => {
            setShowBookingDetailModal(false);

            // 詳細モーダルが閉じられたときに、編集ボタンがクリックされたのであれば
            // 少し遅延してからレポート編集モーダルを開く
            if (selectedBooking && selectedBooking.openEditAfterClose) {
              console.log("フラグによるレポート編集処理を実行します");
              // レポート編集用のデータを準備 - 明示的に全プロパティを設定
              const reportEditData: ExtendedBooking = {
                id: selectedBooking.id,
                userId: selectedBooking.userId,
                tutorId: selectedBooking.tutorId,
                studentId: selectedBooking.studentId,
                tutorShiftId: selectedBooking.tutorShiftId || 0,
                date: selectedBooking.date,
                timeSlot: selectedBooking.timeSlot,
                subject: selectedBooking.subject,
                status: selectedBooking.status,
                reportStatus: selectedBooking.reportStatus || null,
                reportContent: selectedBooking.reportContent || "",
                // 型の不一致を避けるため明示的に文字列型を使用
                createdAt:
                  typeof selectedBooking.createdAt === "object"
                    ? selectedBooking.createdAt.toISOString()
                    : selectedBooking.createdAt,
                studentName:
                  selectedBooking.studentName ||
                  getStudentName(selectedBooking.studentId),
              };

              // 明示的にフラグをリセット
              selectedBooking.openEditAfterClose = false;

              // データを設定して編集モーダルを開く
              setTimeout(() => {
                setReportEditBooking(reportEditData);
                setShowReportEditModal(true);
                console.log(
                  "詳細モーダル閉じた後、レポート編集モーダルを表示",
                  reportEditData,
                );
              }, 300);
            }
          }}
          onEditReport={() => {
            // 直接コールバック方式
            console.log("onEditReport コールバックが呼び出されました");

            if (!selectedBooking) return;

            // レポート編集用のデータを準備 - 明示的に全プロパティを設定
            const reportEditData: ExtendedBooking = {
              id: selectedBooking.id,
              userId: selectedBooking.userId,
              tutorId: selectedBooking.tutorId,
              studentId: selectedBooking.studentId,
              tutorShiftId: selectedBooking.tutorShiftId || 0,
              date: selectedBooking.date,
              timeSlot: selectedBooking.timeSlot,
              subject: selectedBooking.subject,
              status: selectedBooking.status,
              reportStatus: selectedBooking.reportStatus || null,
              reportContent: selectedBooking.reportContent || "",
              // 型の不一致を避けるため明示的に文字列型を使用
              createdAt:
                typeof selectedBooking.createdAt === "object"
                  ? selectedBooking.createdAt.toISOString()
                  : selectedBooking.createdAt,
              studentName:
                selectedBooking.studentName ||
                getStudentName(selectedBooking.studentId),
            };

            // データを設定して編集モーダルを開く
            setReportEditBooking(reportEditData);
            setShowReportEditModal(true);
            console.log(
              "レポート編集モーダルを表示（コールバック方式）",
              reportEditData,
            );
          }}
          onViewReport={() => {
            setShowBookingDetailModal(false);
            setShowReportViewModal(true);
          }}
        />
      )}

      {/* レポート表示モーダル */}
      {selectedBooking && (
        <ReportViewModal
          isOpen={showReportViewModal}
          booking={{
            id: selectedBooking.id,
            userId: selectedBooking.userId,
            tutorId: selectedBooking.tutorId,
            studentId: selectedBooking.studentId,
            tutorShiftId: selectedBooking.tutorShiftId || 0,
            date: selectedBooking.date,
            timeSlot: selectedBooking.timeSlot,
            subject: selectedBooking.subject,
            status: selectedBooking.status,
            reportStatus: selectedBooking.reportStatus || null,
            reportContent: selectedBooking.reportContent || null,
            createdAt: selectedBooking.createdAt,
            studentName:
              selectedBooking.studentName ||
              getStudentName(selectedBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName,
            // 重要: レポートデータがあれば追加
            lessonReport: selectedBooking.lessonReport || null,
          }}
          onClose={() => setShowReportViewModal(false)}
          onEdit={() => {
            console.log("レポート表示モーダルから編集ボタンが押されました");
            
            // モーダルをすぐに閉じる
            setShowReportViewModal(false);

            // selectedBookingのデータチェック
            if (!selectedBooking) {
              console.error("選択された予約データがありません");
              return;
            }
            
            // レポート編集モーダルを表示する準備
            console.log("編集モーダルを表示するための処理を開始します");
            
            // reportEditBookingを直接設定
            const reportData = {
              ...selectedBooking,
              lessonReport: selectedBooking.lessonReport || null
            };
            
            // データをセット
            setReportEditBooking(reportData);
            
            // 少し遅延させてからモーダルを表示（React のレンダリングサイクルを考慮）
            setTimeout(() => {
              console.log("直接編集モーダルを表示します");
              setShowReportEditModal(true);
            }, 100);
          }}
        />
      )}

      {/* レポート編集モーダル - 専用の状態変数を使用 */}
      {showReportEditModal && reportEditBooking && (
        <ReportEditModal
          isOpen={showReportEditModal}
          booking={{
            id: reportEditBooking.id,
            userId: reportEditBooking.userId,
            tutorId: reportEditBooking.tutorId,
            studentId: reportEditBooking.studentId,
            tutorShiftId: reportEditBooking.tutorShiftId || 0,
            date: reportEditBooking.date,
            timeSlot: reportEditBooking.timeSlot,
            subject: reportEditBooking.subject,
            status: reportEditBooking.status,
            // 明示的にreportStatusとreportContentを設定
            reportStatus: reportEditBooking.reportStatus || null,
            reportContent: reportEditBooking.reportContent || "",
            createdAt: reportEditBooking.createdAt,
            // 追加情報
            studentName:
              reportEditBooking.studentName ||
              getStudentName(reportEditBooking.studentId),
            tutorName: tutorProfile?.lastName + " " + tutorProfile?.firstName,
            // レッスンレポート情報も渡す
            lessonReport: reportEditBooking.lessonReport || null,
          }}
          onClose={() => {
            setShowReportEditModal(false);
            // 状態をリセット
            setReportEditBooking(null);
          }}
          onSuccess={() => {
            // レポート編集が成功したら予約情報を再取得
            // 自動的にinvalidateQueriesで再取得されるので、ここでは何もしない
          }}
        />
      )}
    </div>
  );
}
