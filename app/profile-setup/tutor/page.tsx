"use client";

import { useState } from "react";
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

export default function TutorProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    lastNameFurigana: "",
    firstNameFurigana: "",
    university: "",
    birthDate: "",
    selectedSubjects: [] as string[],
  });

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

  // 整数IDの生成 - これはSQLのシーケンスに相当するものではなく一時的な解決策です
  const generateTempId = async () => {
    // 現在の最大IDを取得
    try {
      const { data, error } = await supabase
        .from('tutor_profiles')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error("Error fetching max ID:", error);
        return 1; // エラーの場合は1を返す
      }
      
      if (data && data.length > 0) {
        return data[0].id + 1; // 最大ID + 1
      } else {
        return 1; // データがない場合は1を返す
      }
    } catch (e) {
      console.error("Exception fetching max ID:", e);
      return 1; // 例外の場合は1を返す
    }
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

      // まず既存のデータを確認
      const { data: existingData, error: checkError } = await supabase
        .from('tutor_profiles')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

      console.log("Existing profile check:", { existingData, checkError });
      
      let saveResult;
      
      if (existingData) {
        // 既存のレコードがあれば更新
        const profileData = {
          // idフィールドは更新時には送信しない
          user_id: user.id,
          last_name: formData.lastName,
          first_name: formData.firstName,
          last_name_furigana: formData.lastNameFurigana,
          first_name_furigana: formData.firstNameFurigana,
          university: formData.university,
          birth_date: formData.birthDate,
          subjects: subjects,
          email: user.email,
          profile_completed: true,
          created_at: new Date().toISOString()
        };
        
        saveResult = await supabase
          .from('tutor_profiles')
          .update(profileData)
          .eq('user_id', user.id)
          .select();
      } else {
        // 新規レコードを挿入する場合は、一時的なIDを生成
        const tempId = await generateTempId();
        
        const profileData = {
          id: tempId, // 明示的にIDを設定
          user_id: user.id,
          last_name: formData.lastName,
          first_name: formData.firstName,
          last_name_furigana: formData.lastNameFurigana,
          first_name_furigana: formData.firstNameFurigana,
          university: formData.university,
          birth_date: formData.birthDate,
          subjects: subjects,
          email: user.email,
          profile_completed: true,
          created_at: new Date().toISOString()
        };
        
        saveResult = await supabase
          .from('tutor_profiles')
          .insert([profileData])
          .select();
      }
      
      console.log("Save to tutor_profiles result:", saveResult);
      
      if (saveResult.error) {
        throw new Error(`データ保存エラー: ${saveResult.error.message}`);
      }

      // 成功通知
      toast({
        title: "プロフィール設定完了",
        description: "講師プロフィールが正常に設定されました",
      });

      // ダッシュボードに遷移 - ダッシュボードページは更新済み
      router.push('/dashboard');
    } catch (error: any) {
      console.error("プロフィール設定エラー:", error);
      toast({
        title: "エラー",
        description: error.message || "プロフィールの設定中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="例：山田"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firstName">名</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="例：太郎"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lastNameFurigana">姓（ふりがな）</Label>
                    <Input
                      id="lastNameFurigana"
                      value={formData.lastNameFurigana}
                      onChange={(e) => setFormData({ ...formData, lastNameFurigana: e.target.value })}
                      placeholder="例：やまだ"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firstNameFurigana">名（ふりがな）</Label>
                    <Input
                      id="firstNameFurigana"
                      value={formData.firstNameFurigana}
                      onChange={(e) => setFormData({ ...formData, firstNameFurigana: e.target.value })}
                      placeholder="例：たろう"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="university">大学名</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    placeholder="例：東京大学"
                    required
                  />
                  <p className="text-sm text-gray-500">現在通っている、または卒業した大学名を入力してください。</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="birthDate">生年月日</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    required
                  />
                  <p className="text-sm text-gray-500">講師は18歳以上の方のみ登録可能です。</p>
                </div>
              </div>
              
              <hr className="my-6" />
              
              {/* 指導科目 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">指導可能な科目</h3>
                <p className="text-sm text-gray-500">指導可能な科目を選択してください。複数選択できます。</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 小学生の科目 */}
                  <div className="space-y-2">
                    <Label className="font-medium">小学生</Label>
                    <div className="space-y-1">
                      {elementarySubjects.map(subject => (
                        <div key={`小学${subject}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`elem-${subject}`}
                            checked={formData.selectedSubjects.includes(`小学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, "小学生")}
                          />
                          <Label
                            htmlFor={`elem-${subject}`}
                            className="text-sm font-normal"
                          >
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 中学生の科目 */}
                  <div className="space-y-2">
                    <Label className="font-medium">中学生</Label>
                    <div className="space-y-1">
                      {juniorHighSubjects.map(subject => (
                        <div key={`中学${subject}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`jhs-${subject}`}
                            checked={formData.selectedSubjects.includes(`中学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, "中学生")}
                          />
                          <Label
                            htmlFor={`jhs-${subject}`}
                            className="text-sm font-normal"
                          >
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 高校生の科目（カテゴリー分け） */}
                  <div className="space-y-4">
                    <Label className="font-medium">高校生</Label>
                    {Object.entries(highSchoolCategories).map(([category, subjects]) => (
                      <div key={category} className="mt-2">
                        <Label className="text-sm font-medium text-gray-700">{category}</Label>
                        <div className="ml-2 mt-1 space-y-1">
                          {subjects.map(subject => {
                            const fullSubjectName = `高校${subject}`;
                            return (
                              <div key={fullSubjectName} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`hs-${subject}`}
                                  checked={formData.selectedSubjects.includes(fullSubjectName)}
                                  onCheckedChange={() => handleSubjectChange(subject, "高校生")}
                                />
                                <Label
                                  htmlFor={`hs-${subject}`}
                                  className="text-sm font-normal"
                                >
                                  {subject}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="pt-6 flex justify-center md:justify-end">
                <Button
                  type="submit"
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md flex items-center justify-center gap-2 shadow-md transition-all hover:shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>プロフィールを保存</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}