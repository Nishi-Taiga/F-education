"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// レポートの型
type Report = {
  // booking テーブルからの情報
  id: number; // Booking ID
  date: string; // YYYY-MM-DD
  time_slot: string; // HH:MM - HH:MM
  subject: string; // 科目
  status: string; // Booking Status (e.g., 'completed', 'pending')
  report_status: string; // Report Status (e.g., 'completed', 'pending')
  student_id: number | null;
  tutor_id: number | null;
  parent_id: number | null; // 保護者IDを追加

  // 関連テーブルからの情報 (joinで取得)
  student_profile: { id: number; last_name: string; first_name: string } | null;
  tutor_profile: { id: number; last_name: string; first_name: string } | null; // 講師名も必要なので追加
  lesson_reports: { // 関連するレポートデータ (もしあれば)
      id: number;
      unit_content: string;
      message_content: string;
      goal_content: string;
      created_at: string;
      updated_at: string;
      // booking_id, tutor_id, student_id はlesson_reportsテーブルにもあるが、bookingから取得したもので十分
  }[] | null; // 1つの予約に複数のレポートは想定しないが、リレーションの型に合わせる
};

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // ユーザー情報とレポート情報を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // ユーザー情報の取得（認証情報はuseAuthフックで取得することを想定）
        // レポートページに直接アクセスした場合などを考慮し、ここでセッションとロールを取得
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error("セッション取得エラー:", sessionError);
          toast({
            title: "エラー",
            description: "認証情報の取得に失敗しました",
            variant: "destructive",
          });
          router.push('/'); // 未ログインの場合はホームに戻す
          return;
        }

        // ユーザーの認証IDを取得
        const authUid = session.user.id;

        // ロールに基づいたプロフィールの取得とレポートデータのフェッチ
        let currentUserId: number | null = null; // parent_id または tutor_id を保持
        let currentUserRole: string | null = null;

        // プロフィールとロールの取得
        const { data: parentProfile, error: parentError } = await supabase
            .from('parent_profile')
            .select('id, user_id, role') // roleカラムも取得
            .eq('user_id', authUid)
            .single();

        const { data: tutorProfile, error: tutorError } = await supabase
            .from('tutor_profile')
            .select('id, user_id') // tutor_profileにはroleカラムはないと仮定
            .eq('user_id', authUid)
            .single();

        if (parentProfile) {
            currentUserId = parentProfile.id;
            currentUserRole = parentProfile.role; // parent_profileからロールを取得
        } else if (tutorProfile) {
             currentUserId = tutorProfile.id;
             currentUserRole = 'tutor'; // tutor_profileの場合はロールを'tutor'と確定
        } else {
            console.error("プロフィールが見つかりません");
             toast({
               title: "エラー",
               description: "ユーザープロフィールが見つかりませんでした",
               variant: "destructive",
             });
            router.push('/'); // プロフィールがない場合はホームに戻す
            return;
        }

         setUserId(currentUserId); // stateにセット
         setUserRole(currentUserRole); // stateにセット


        // レポート情報を取得
        let reportQuery = supabase
          .from('bookings')
          .select(`
            *,
            student_profile (id, last_name, first_name),
            tutor_profile (id, last_name, first_name),
            lesson_reports (id, unit_content, message_content, goal_content, created_at, updated_at)
          `)
          .order('date', { ascending: false })
          .order('time_slot', { ascending: false }); // 新しい順にソート

        if (currentUserRole === 'tutor') {
          // 講師の場合、自分が担当した予約（レポート済み含む）を取得
          reportQuery = reportQuery.eq('tutor_id', currentUserId);
        } else if (currentUserRole === 'parent') {
          // 保護者の場合、自分の生徒の予約（レポート済み含む）を取得
          reportQuery = reportQuery.eq('parent_id', currentUserId);
        } else {
             // 未対応ロールの場合は空の結果を返すかエラーハンドリング
            console.warn("未対応のユーザーロールです", currentUserRole);
            setReports([]);
            setFilteredReports([]);
            setIsLoading(false);
            toast({
              title: "情報",
              description: `このユーザーロール(${currentUserRole})に対応するレポート表示は未実装です。`,
              variant: "default",
            });
            return;
        }

      const { data: reportData, error: reportError } = await reportQuery;

      if (reportError) {
        console.error("レポート取得エラー:", reportError);
        toast({
          title: "エラー",
          description: `レポート情報の取得に失敗しました: ${reportError.message}`,
          variant: "destructive",
        });
        setReports([]);
        setFilteredReports([]);
        return;
      }

      console.log("Fetched report data:", reportData);

      // 取得したデータ（bookingsとネストされたlesson_reports）をそのままreports stateにセット
      // フィルタリングは別途useEffectで行う
      // ただし、Report型に合うように整形が必要かもしれないが、一旦そのまま保持してみる
      // Report型を結合結果の型に近づけるか、ここで整形するか検討
      // 今回は取得したデータをそのまま保持し、フィルタリング・表示時に整形する

      // fetched data matches Report type structure better now after type definition update
      setReports(reportData as Report[]);
      setFilteredReports(reportData as Report[]); // 初期表示は全て

    } catch (error) {
      console.error("データ取得エラー:", error);
      toast({
        title: "エラー",
        description: "データの読み込み中に予期せぬエラーが発生しました",
        variant: "destructive",
      });
      setReports([]);
      setFilteredReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
}, [router, toast]); // 依存配列にtoastとrouterを追加

// フィルタリング処理
useEffect(() => {
  const filterReports = () => {
    let filtered = [...reports];

    // 検索ワードでフィルタリング (生徒名、講師名、科目、レポート内容、日付)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(report =>
          (report.student_profile?.last_name?.toLowerCase().includes(search) || report.student_profile?.first_name?.toLowerCase().includes(search) || 
           report.tutor_profile?.last_name?.toLowerCase().includes(search) || report.tutor_profile?.first_name?.toLowerCase().includes(search) ||
           report.subject?.toLowerCase().includes(search) ||
           // lesson_reportsが配列なので、各レポートの内容を検索
           report.lesson_reports?.some(lr => 
               lr.unit_content?.toLowerCase().includes(search) ||
               lr.message_content?.toLowerCase().includes(search) ||
               lr.goal_content?.toLowerCase().includes(search)
           ) ||
           // 日付検索 (YYYY/MM/DD 形式を想定)
           (report.date && format(new Date(report.date), 'yyyy/MM/dd').includes(search))
          )
      );
    }

    // ステータスでフィルタリング (booking status と report status の両方考慮が必要か？)
    // ここではbookingsテーブルのreport_statusでフィルタリング
    if (selectedStatus !== "all") {
      filtered = filtered.filter(report =>
          report.lesson_reports && report.lesson_reports.length > 0 && getStatusJapanese(report.report_status || 'none') === getStatusJapanese(selectedStatus) // lesson_reportsが存在するもののみ対象とし、日本語ステータスで比較
      );
    } else {
       // 'all' の場合、レポートが紐づいていない（未作成）ものも表示
       // ただし、フィルタリングで「レポートあり」に絞る場合はこのelseは不要
       // 今回の要件は「保護者idに紐づく生徒のレポートをすべて表示」なので、レポートがない予約は対象外とする
       // initial fetch already filters by parent_id or tutor_id
       // フィルタリングの段階ではレポートが紐づいているもののみを扱う方針
       filtered = filtered.filter(report => report.lesson_reports && report.lesson_reports.length > 0); // 明示的にレポートがあるもののみに絞る
    }

    // 期間でフィルタリング (レポート作成日または授業日か？ 授業日dateを使用)
    if (selectedPeriod !== "all") {
      const now = new Date();
      let startDate = new Date();

      // 日付計算
      if (selectedPeriod === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedPeriod === "month") {
        startDate.setMonth(now.getMonth() - 1);
      } else if (selectedPeriod === "quarter") {
        startDate.setMonth(now.getMonth() - 3);
      }
       // 時刻情報をクリアして日付のみで比較
      startDate.setHours(0, 0, 0, 0);

      filtered = filtered.filter(report => {
        if (!report.date) return false; // dateがないデータは除外
        const reportDate = new Date(report.date); // 授業日を基準とする
        reportDate.setHours(0, 0, 0, 0); // 時刻情報をクリア
        return reportDate >= startDate;
      });
    } else {
         // 期間フィルタが'all'の場合も、レポートが紐づいているもののみを表示する方針を維持
         filtered = filtered.filter(report => report.lesson_reports && report.lesson_reports.length > 0);
    }

    // 検索とステータス、期間フィルタリングを組み合わせるため、ここまでのfilteredを元に最終フィルタリング
    // 上記のフィルタリングロジックを統合・整理
    let finalFiltered = [...reports];

    // レポートが紐づいている予約のみを初期フィルタリング対象とする（「すべてのレポート」の定義）
    finalFiltered = finalFiltered.filter(report => report.lesson_reports && report.lesson_reports.length > 0);

    // 検索ワードでフィルタリング
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        finalFiltered = finalFiltered.filter(report =>
             (report.student_profile?.last_name?.toLowerCase().includes(search) || report.student_profile?.first_name?.toLowerCase().includes(search) || 
              report.tutor_profile?.last_name?.toLowerCase().includes(search) || report.tutor_profile?.first_name?.toLowerCase().includes(search) ||
              report.subject?.toLowerCase().includes(search) ||
              report.lesson_reports?.some(lr => 
                  lr.unit_content?.toLowerCase().includes(search) ||
                  lr.message_content?.toLowerCase().includes(search) ||
                  lr.goal_content?.toLowerCase().includes(search)
              ) ||
              (report.date && format(new Date(report.date), 'yyyy/MM/dd').includes(search))
             )
        );
    }

    // ステータスでフィルタリング
    if (selectedStatus !== "all") {
         finalFiltered = finalFiltered.filter(report => getStatusJapanese(report.report_status || 'none') === getStatusJapanese(selectedStatus));
    }

    // 期間でフィルタリング
    if (selectedPeriod !== "all") {
         const now = new Date();
         let startDate = new Date();

         if (selectedPeriod === "week") {
           startDate.setDate(now.getDate() - 7);
         } else if (selectedPeriod === "month") {
           startDate.setMonth(now.getMonth() - 1);
         } else if (selectedPeriod === "quarter") {
           startDate.setMonth(now.getMonth() - 3);
         }
          startDate.setHours(0, 0, 0, 0);

         finalFiltered = finalFiltered.filter(report => {
           if (!report.date) return false;
           const reportDate = new Date(report.date);
           reportDate.setHours(0, 0, 0, 0);
           return reportDate >= startDate;
         });
    }

    setFilteredReports(finalFiltered);
  };

  filterReports();
  // reports, searchTerm, selectedStatus, selectedPeriod, userRole を依存配列に追加
}, [reports, searchTerm, selectedStatus, selectedPeriod, userRole]);

// レポート詳細を表示
const handleViewReport = (report: Report) => {
  setSelectedReport(report);
  setShowReportModal(true);
};

// レポートモーダルを閉じる
const handleCloseReportModal = () => {
  setShowReportModal(false);
  setSelectedReport(null);
};

// ステータスに応じたバッジ色を取得 (report_statusを使用)
const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "draft": // draft status is not currently used in this flow, but kept for completeness
      return "bg-yellow-100 text-yellow-800";
    case "pending": // pending status means report is not completed yet, maybe shown as '未作成'
      return "bg-blue-100 text-blue-800"; // Or a different color for '未作成'
    default: // covers null, undefined, or other unexpected values
      return "bg-gray-100 text-gray-800"; // Representing '未作成'
  }
};

// ステータスの日本語表示 (report_statusを使用)
const getStatusJapanese = (status: string) => {
  switch (status) {
    case "completed":
      return "完了"; // レポート作成済み
    case "draft":
      return "下書き";
    case "pending":
      return "作成中"; // このフローではレポートが紐づいていないものはリストアップされない想定だが、念のため
    default:
      return "未作成"; // report_statusがnullなどの場合
  }
};

if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="loader">読み込み中...</div>
    </div>
  );
}

return (
  <div className="container mx-auto p-4 md:py-8">
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-2xl md:text-3xl font-bold">レポート一覧</h1>
      <Button onClick={() => router.push('/dashboard')} variant="outline">戻る</Button>
    </div>
    
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>レポート検索・フィルタ</CardTitle>
        <CardDescription>条件を指定してレポートを絞り込みできます</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input
              placeholder="レポート内容、名前で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="ステータスで絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのステータス</SelectItem>
                <SelectItem value="completed">完了</SelectItem>
                <SelectItem value="draft">下書き</SelectItem>
                <SelectItem value="pending">作成中</SelectItem>
                <SelectItem value="none">未作成</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="期間で絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての期間</SelectItem>
                <SelectItem value="week">過去1週間</SelectItem>
                <SelectItem value="month">過去1ヶ月</SelectItem>
                <SelectItem value="quarter">過去3ヶ月</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader>
        <CardTitle>レポート一覧</CardTitle>
        <CardDescription>
          {filteredReports.length > 0 
            ? `${filteredReports.length}件のレポートがあります` 
            : "該当するレポートがありません"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="table">テーブル表示</TabsTrigger>
            <TabsTrigger value="cards">カード表示</TabsTrigger>
          </TabsList>
          
          <TabsContent value="table">
            {filteredReports.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日付</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead>科目</TableHead>
                      <TableHead>{userRole === 'tutor' ? '生徒' : '講師'}</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          {report.date && format(new Date(report.date), 'yyyy/MM/dd')}
                        </TableCell>
                        <TableCell>
                          {report.time_slot ? report.time_slot : "-"}
                        </TableCell>
                        <TableCell>{report.subject || "-"}</TableCell>
                        <TableCell>
                          {userRole === 'tutor' ? 
                           (report.student_profile ? `${report.student_profile.last_name} ${report.student_profile.first_name}` : "不明") 
                           : 
                           (report.tutor_profile ? `${report.tutor_profile.last_name} ${report.tutor_profile.first_name}` : "不明")}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(report.report_status || 'none')}`}>
                            {getStatusJapanese(report.report_status || 'none')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReport(report)}
                            disabled={!(report.lesson_reports && report.lesson_reports.length > 0)}
                          >
                            詳細
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                該当するレポートがありません
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="cards">
            {filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map((report) => (
                  <Card key={report.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">
                            {report.date && format(new Date(report.date), 'yyyy/MM/dd')}
                          </CardTitle>
                          <CardDescription>
                            {report.time_slot ? report.time_slot : "-"}
                          </CardDescription>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(report.report_status || 'none')}`}>
                          {getStatusJapanese(report.report_status || 'none')}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500">科目</p>
                        <p>{report.subject || "-"}</p>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500">
                          {userRole === 'tutor' ? '生徒' : '講師'}
                        </p>
                        <p>
                          {userRole === 'tutor' ? 
                           (report.student_profile ? `${report.student_profile.last_name} ${report.student_profile.first_name}` : "不明") 
                           : 
                           (report.tutor_profile ? `${report.tutor_profile.last_name} ${report.tutor_profile.first_name}` : "不明")}
                        </p>
                      </div>

                      {report.lesson_reports && report.lesson_reports.length > 0 ? (
                         <div className="mb-4">
                           <p className="text-sm font-medium text-gray-500">レポート内容</p>
                           <div className="text-sm line-clamp-2 whitespace-pre-line">{report.lesson_reports[0].unit_content || report.lesson_reports[0].message_content || report.lesson_reports[0].goal_content || "-"}</div>
                         </div>
                      ) : (
                           <p className="text-gray-500">レポート内容がありません</p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => handleViewReport(report)}
                        disabled={!(report.lesson_reports && report.lesson_reports.length > 0)}
                      >
                        詳細を見る
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                該当するレポートがありません
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    
    {/* レポート詳細モーダル */}
    {showReportModal && selectedReport && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold">レポート詳細</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleCloseReportModal}
            >
              ✕
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-500">生徒</p>
              <p>{selectedReport.student_profile ? `${selectedReport.student_profile.last_name} ${selectedReport.student_profile.first_name}` : "不明"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">日付</p>
              <p>
                {selectedReport.date && 
                  format(new Date(selectedReport.date), 'yyyy年MM月dd日 (EEE)', { locale: ja })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">科目</p>
              <p>{selectedReport.subject || "-"}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {selectedReport.lesson_reports && selectedReport.lesson_reports.length > 0 && selectedReport.report_status !== "none" ? (
               <>
                   <div>
                       <h4 className="text-base font-medium mb-2">単元</h4>
                       <div className="bg-gray-50 p-4 rounded-md whitespace-pre-line">
                           {selectedReport.lesson_reports[0].unit_content || "-"}
                       </div>
                   </div>
                    <div>
                       <h4 className="text-base font-medium mb-2">伝言事項</h4>
                       <div className="bg-gray-50 p-4 rounded-md whitespace-pre-line">
                           {selectedReport.lesson_reports[0].message_content || "-"}
                       </div>
                   </div>
                    <div>
                       <h4 className="text-base font-medium mb-2">来週までの課題</h4>
                       <div className="bg-gray-50 p-4 rounded-md whitespace-pre-line">
                           {selectedReport.lesson_reports[0].goal_content || "-"}
                       </div>
                   </div>
               </>
            ) : (
               <p className="text-gray-500">レポート内容がありません</p>
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button onClick={handleCloseReportModal}>閉じる</Button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
