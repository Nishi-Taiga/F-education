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
  id: number;
  bookingId: number;
  studentId: number;
  tutorId: number;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // 結合データ
  date?: string;
  startTime?: string;
  endTime?: string;
  studentName?: string;
  tutorName?: string;
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
        
        // セッションの確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 未ログインの場合はホームに戻す
          router.push('/');
          return;
        }
        
        // ユーザー情報の取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
          
        if (userError) {
          console.error("ユーザー情報取得エラー:", userError);
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        setUserId(userData.id);
        setUserRole(userData.role);
        
        // レポート情報を取得（生徒/保護者または講師によって異なるクエリ）
        let reportQuery;
        
        if (userData.role === 'tutor') {
          // 講師の場合、自分が作成したレポートを取得
          reportQuery = supabase
            .from('bookings')
            .select(`
              id,
              date,
              startTime,
              endTime,
              studentId,
              tutorId,
              status,
              reportContent:content,
              reportStatus:status,
              students(firstName, lastName),
              tutors(firstName, lastName)
            `)
            .eq('tutorId', userData.id)
            .order('date', { ascending: false });
        } else {
          // 生徒/保護者の場合、自分向けのレポートを取得
          reportQuery = supabase
            .from('bookings')
            .select(`
              id,
              date,
              startTime,
              endTime,
              studentId,
              tutorId,
              status,
              reportContent:content,
              reportStatus:status,
              students(firstName, lastName),
              tutors(firstName, lastName)
            `)
            .eq('studentId', userData.id)
            .order('date', { ascending: false });
        }
        
        const { data: reportData, error: reportError } = await reportQuery;
        
        if (reportError) {
          console.error("レポート取得エラー:", reportError);
          toast({
            title: "エラー",
            description: "レポート情報の取得に失敗しました",
            variant: "destructive",
          });
          return;
        }
        
        // データを整形
        const formattedReports = reportData.map((report: any) => ({
          id: report.id,
          bookingId: report.id,
          studentId: report.studentId,
          tutorId: report.tutorId,
          content: report.reportContent || "",
          status: report.reportStatus || "none",
          createdAt: report.date,
          updatedAt: report.date,
          date: report.date,
          startTime: report.startTime,
          endTime: report.endTime,
          studentName: report.students 
            ? `${report.students.lastName} ${report.students.firstName}`
            : "不明",
          tutorName: report.tutors
            ? `${report.tutors.lastName} ${report.tutors.firstName}`
            : "不明",
        }));
        
        setReports(formattedReports);
        setFilteredReports(formattedReports);
      } catch (error) {
        console.error("データ取得エラー:", error);
        toast({
          title: "エラー",
          description: "データの読み込みに失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [router, toast]);

  // フィルタリング処理
  useEffect(() => {
    const filterReports = () => {
      let filtered = [...reports];
      
      // 検索ワードでフィルタリング
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filtered = filtered.filter(report => 
          report.studentName?.toLowerCase().includes(search) ||
          report.tutorName?.toLowerCase().includes(search) ||
          report.content.toLowerCase().includes(search)
        );
      }
      
      // ステータスでフィルタリング
      if (selectedStatus !== "all") {
        filtered = filtered.filter(report => report.status === selectedStatus);
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
        
        filtered = filtered.filter(report => {
          const reportDate = new Date(report.createdAt);
          return reportDate >= startDate;
        });
      }
      
      setFilteredReports(filtered);
    };
    
    filterReports();
  }, [reports, searchTerm, selectedStatus, selectedPeriod]);

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

  // ステータスに応じたバッジ色を取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // ステータスの日本語表示
  const getStatusJapanese = (status: string) => {
    switch (status) {
      case "completed":
        return "完了";
      case "draft":
        return "下書き";
      case "pending":
        return "作成中";
      case "none":
        return "未作成";
      default:
        return status;
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
                            {report.startTime && report.endTime ? 
                              `${report.startTime} - ${report.endTime}` : "-"}
                          </TableCell>
                          <TableCell>
                            {userRole === 'tutor' ? report.studentName : report.tutorName}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(report.status)}`}>
                              {getStatusJapanese(report.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewReport(report)}
                              disabled={report.status === "none"}
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
                              {report.startTime && report.endTime ? 
                                `${report.startTime} - ${report.endTime}` : "-"}
                            </CardDescription>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(report.status)}`}>
                            {getStatusJapanese(report.status)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-500">
                            {userRole === 'tutor' ? '生徒' : '講師'}
                          </p>
                          <p>
                            {userRole === 'tutor' ? report.studentName : report.tutorName}
                          </p>
                        </div>
                        
                        {report.content && report.status !== "none" && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-500">内容</p>
                            <p className="text-sm line-clamp-2">{report.content}</p>
                          </div>
                        )}
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => handleViewReport(report)}
                          disabled={report.status === "none"}
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
                <p className="text-sm font-medium text-gray-500">日付</p>
                <p>
                  {selectedReport.date && 
                    format(new Date(selectedReport.date), 'yyyy年MM月dd日 (EEE)', { locale: ja })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">時間</p>
                <p>
                  {selectedReport.startTime && selectedReport.endTime ? 
                    `${selectedReport.startTime} - ${selectedReport.endTime}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">生徒</p>
                <p>{selectedReport.studentName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">講師</p>
                <p>{selectedReport.tutorName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">ステータス</p>
                <p>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedReport.status)}`}>
                    {getStatusJapanese(selectedReport.status)}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-medium mb-2">レポート内容</h4>
                {selectedReport.content ? (
                  <div className="bg-gray-50 p-4 rounded-md whitespace-pre-line">
                    {selectedReport.content}
                  </div>
                ) : (
                  <p className="text-gray-500">レポート内容がありません</p>
                )}
              </div>
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
