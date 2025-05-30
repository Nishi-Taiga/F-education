"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2 } from "lucide-react";
import { CommonHeader } from "@/components/common-header";

// 高校科目のカテゴリー
const highSchoolCategories = {
  "国語": ["現代文", "古典"],
  "数学": ["数学"],
  "理科": ["物理", "化学", "生物", "地学"],
  "社会": ["地理", "日本史", "世界史", "公共"],
  "英語": ["英語"],
  "その他": ["情報"]
};

// 小学生の科目
const elementarySubjects = [
  "国語", "算数", "理科", "社会", "英語"
];

// 中学生の科目
const juniorHighSubjects = [
  "国語", "数学", "理科", "社会", "英語"
];

export default function TutorProfileEdit() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true); // 初期ロード中はローディング
  
  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    lastNameFurigana: "",
    firstNameFurigana: "",
    university: "",
    birthDate: "",
    selectedSubjects: [] as string[],
  });

  useEffect(() => {
    const fetchTutorProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
 
        if (user) {
          const { data: existingTutor, error } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
 
          if (error) {
            console.error("Error fetching tutor profile:", error);
            toast({
              title: "講師プロフィール取得エラー",
              description: `プロフィールの読み込みに失敗しました: ${error.message}`,
              variant: "destructive",
            });
          }
 
          if (existingTutor) {
            setFormData({
              lastName: existingTutor.last_name || "",
              firstName: existingTutor.first_name || "",
              lastNameFurigana: existingTutor.last_name_furigana || "",
              firstNameFurigana: existingTutor.first_name_furigana || "",
              university: existingTutor.university || "",
              birthDate: existingTutor.birth_date || "",
              selectedSubjects: existingTutor.subjects ? existingTutor.subjects.split(',') : [],
            });
          } else {
            // プロフィールが存在しない場合はエラーまたは新規登録を促す（編集画面なので通常は存在する想定）
            console.warn("Tutor profile not found for user:", user.id);
            toast({
              title: "プロフィールが見つかりません",
              description: "講師プロフィール情報が見つかりませんでした。新規登録してください。", // またはエラーメッセージ
              variant: "destructive",
            });
             // 必要に応じてリダイレクトなど
             // router.push('/profile-setup/tutor');
          }
        }
      } catch (error) {
        console.error("Unexpected error fetching tutor profile:", error);
        toast({
          title: "エラー",
          description: `プロフィールの読み込み中に予期せぬエラーが発生しました: ${(error as Error).message}`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
 
    fetchTutorProfile();
  }, []); // 空の依存配列でマウント時に一度だけ実行

  const handleSubjectChange = (subject: string, category?: string) => {
    let fullSubjectName = subject;
    
    // カテゴリーが指定されている場合、フルネームを生成
    if (category) {
      if (category === "小学生") {
        fullSubjectName = `小学${subject}`;
      } else if (category === "中学生") {
        fullSubjectName = `中学${subject}`;
      } else if (category === "高校生") {
        fullSubjectName = `高校${subject}`;
      }
    }
    
    setFormData(prev => {
      const subjects = prev.selectedSubjects.includes(fullSubjectName)
        ? prev.selectedSubjects.filter(s => s !== fullSubjectName)
        : [...prev.selectedSubjects, fullSubjectName];
      return { ...prev, selectedSubjects: subjects };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 入力バリデーション
      const requiredFields = [
        'lastName', 'firstName', 'lastNameFurigana', 'firstNameFurigana',
        'university', 'birthDate'
      ];
      
      for (const field of requiredFields) {
        if (!formData[field as keyof typeof formData]) {
          throw new Error(`${field}は必須項目です`);
        }
      }
      
      if (formData.selectedSubjects.length === 0) {
        throw new Error("少なくとも1つの科目を選択してください");
      }

      // ユーザーセッションを取得
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("ユーザー認証情報が見つかりません");
      }

      console.log("Current user:", user);

      // 科目の配列をカンマ区切りの文字列に変換
      const subjects = formData.selectedSubjects.join(",");
      
      // tutor_profile テーブルを更新
      console.log("Updating tutor profile...");

      const { data, error } = await supabase
        .from('tutor_profile')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          last_name_furigana: formData.lastNameFurigana,
          first_name_furigana: formData.firstNameFurigana,
          university: formData.university,
          birth_date: formData.birthDate,
          subjects: subjects,
          // profile_completed: true, // プロフィール編集画面なので不要
          // is_active: true // アクティブ状態の変更はここで行わない
        })
        .eq('user_id', user.id) // ユーザーIDをキーに更新
        .select();

      if (error) {
        console.error("Error updating tutor profile:", error);
        // テーブルが存在しない場合のエラーハンドリングを残す
        if (error.code === '42P01') { // relation "テーブル名" does not exist
          throw new Error("テーブルが存在しません。\n\n管理者に連絡してください。");
        }
        throw new Error(`プロフィールの保存中にエラーが発生しました: ${error.message}`);
      }

      console.log("Tutor profile updated:", data);

      // usersテーブルのprofile_completedフラグ更新は不要なので削除
      // try {
      //   const { error: userUpdateError } = await supabase
      //     .from('users')
      //     .update({ profile_completed: true })
      //     .eq('auth_user_id', user.id);
 
      //   if (userUpdateError) {
      //     console.warn("Warning: Could not update user profile_completed flag:", userUpdateError);
      //   }
      // } catch (userUpdateError) {
      //   console.warn("Warning: Error accessing users table:", userUpdateError);
      // }

      toast({
        title: "保存完了", // メッセージを更新完了に変更
        description: "講師プロフィールが正常に保存されました",
      });

      // 保存完了後、ダッシュボードにリダイレクト
      router.push("/dashboard");

    } catch (error: any) {
      console.error("Save failed:", error); // メッセージを保存失敗に変更
      toast({
        title: "保存失敗", // メッセージを保存失敗に変更
        description: error.message || "プロフィールの保存中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-container">
      <CommonHeader title="プロフィール設定" showBackButton={true} backTo="/dashboard" />
      <div className="container mx-auto py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">講師プロフィール設定</CardTitle>
              <CardDescription>
                講師としての情報を入力してください。これらの情報は生徒とその保護者に公開されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本情報 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">基本情報</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lastName">姓</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="山田"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firstName">名</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="太郎"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lastNameFurigana">姓（ふりがな）</Label>
                      <Input
                        id="lastNameFurigana"
                        type="text"
                        placeholder="やまだ"
                        value={formData.lastNameFurigana}
                        onChange={(e) => setFormData({ ...formData, lastNameFurigana: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firstNameFurigana">名（ふりがな）</Label>
                      <Input
                        id="firstNameFurigana"
                        type="text"
                        placeholder="たろう"
                        value={formData.firstNameFurigana}
                        onChange={(e) => setFormData({ ...formData, firstNameFurigana: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="university">最終学歴（大学名）</Label>
                    <Input
                      id="university"
                      type="text"
                      placeholder="〇〇大学"
                      value={formData.university}
                      onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">生年月日</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                {/* 指導科目 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">指導可能科目</h3>
                  <p className="text-sm text-gray-600">指導可能な学年と科目を全て選択してください。</p>

                  {/* 小学生 */}
                  <div>
                    <h4 className="text-base font-medium mb-2">小学生</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {elementarySubjects.map(subject => (
                        <div key={subject} className="flex items-center">
                          <Checkbox
                            id={`elem-${subject}`}
                            checked={formData.selectedSubjects.includes(`小学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, '小学生')}
                          />
                          <Label htmlFor={`elem-${subject}`} className="ml-2 text-sm font-normal">
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 中学生 */}
                  <div>
                    <h4 className="text-base font-medium mb-2">中学生</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {juniorHighSubjects.map(subject => (
                        <div key={subject} className="flex items-center">
                          <Checkbox
                            id={`jh-${subject}`}
                            checked={formData.selectedSubjects.includes(`中学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, '中学生')}
                          />
                          <Label htmlFor={`jh-${subject}`} className="ml-2 text-sm font-normal">
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 高校生 */}
                  <div>
                    <h4 className="text-base font-medium mb-2">高校生</h4>
                    {Object.entries(highSchoolCategories).map(([category, subjects]) => (
                      <div key={category} className="mb-3">
                        <p className="text-sm font-medium mb-1">{category}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {subjects.map(subject => (
                            <div key={subject} className="flex items-center">
                              <Checkbox
                                id={`hs-${subject}`}
                                checked={formData.selectedSubjects.includes(`高校${subject}`)}
                                onCheckedChange={() => handleSubjectChange(subject, '高校生')}
                              />
                              <Label htmlFor={`hs-${subject}`} className="ml-2 text-sm font-normal">
                                {subject}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> プロフィールを保存</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 