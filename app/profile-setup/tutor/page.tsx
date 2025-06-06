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
      
      // 直接データベースに挿入
      try {
        console.log("直接データベースに挿入を試みます...");
        
        // データを準備 - idフィールドを含めず、自動采番に任せる
        const profileData = {
          // 認証ユーザーIDをuser_idフィールドに設定
          user_id: user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          last_name_furigana: formData.lastNameFurigana,
          first_name_furigana: formData.firstNameFurigana,
          university: formData.university,
          birth_date: formData.birthDate,
          subjects: subjects,
          email: user.email,  // Emailを明示的に保存
          profile_completed: true,
          is_active: true
        };
        
        // 挿入操作の実行
        const { data: insertData, error: insertError } = await supabase
          .from('tutor_profile')
          .insert(profileData)
          .select();
          
        if (insertError) {
          console.error("挿入エラー:", insertError);
          
          // 既に登録されている場合は更新を試みる
          if (insertError.code === '23505') { // 重複キーエラー
            console.log("既存レコードが存在するため更新を試みます");
            
            const { data: updateData, error: updateError } = await supabase
              .from('tutor_profile')
              .update({
                first_name: formData.firstName,
                last_name: formData.lastName,
                last_name_furigana: formData.lastNameFurigana,
                first_name_furigana: formData.firstNameFurigana,
                university: formData.university,
                birth_date: formData.birthDate,
                subjects: subjects,
                email: user.email,  // 更新時もEmailを明示的に含める
                profile_completed: true,
                is_active: true
              })
              .eq('user_id', user.id)
              .select();
              
            if (updateError) {
              console.error("更新エラー:", updateError);
              throw new Error(`更新中にエラーが発生しました: ${updateError.message}`);
            }
            
            console.log("更新成功:", updateData);
            toast({
              title: "プロフィール更新完了",
              description: "講師プロフィールが正常に更新されました",
            });
            
            router.push('/dashboard');
            return;
          }
          
          // テーブルが存在しない場合
          if (insertError.code === '42P01') { // relation "テーブル名" does not exist
            throw new Error("テーブルが存在しません。\n\n管理者に連絡してください。");
          }
          
          throw new Error(`プロフィールの保存中にエラーが発生しました: ${insertError.message}`);
        }
        
        console.log("挿入成功:", insertData);
        
        // 成功後に検証クエリを実行
        console.log("プロフィール保存を検証しています...");
        const { data: verifyProfile, error: verifyError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
          
        if (verifyError || !verifyProfile) {
          console.error("プロフィール保存の検証に失敗:", verifyError);
          // エラーはスローせず、プロフィールが見つからなくても続行
          console.log("代替手段: user_idでプロフィールを検索します");
          
          const { data: verifyByIdProfile, error: verifyByIdError } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (verifyByIdProfile) {
            console.log("user_idによるプロフィール検証成功:", verifyByIdProfile);
          } else {
            console.error("user_idによるプロフィール検証失敗:", verifyByIdError);
          }
        } else {
          console.log("プロフィール保存の検証成功:", verifyProfile);
        }
        
        toast({
          title: "プロフィール設定完了",
          description: "講師プロフィールが正常に設定されました",
        });
        
        router.push('/dashboard');
      } catch (dbError: any) {
        console.error("直接データベース操作失敗:", dbError);
        throw dbError;
      }
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