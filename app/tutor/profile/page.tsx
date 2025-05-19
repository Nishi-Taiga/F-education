"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2, User, GraduationCap, Building, Book } from "lucide-react";

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

export default function TutorProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    id: 0,
    userId: "",
    lastName: "",
    firstName: "",
    lastNameFurigana: "",
    firstNameFurigana: "",
    university: "",
    bio: "",
    birthDate: "",
    selectedSubjects: [] as string[],
    email: "",
  });

  // 講師プロフィール情報を取得
  useEffect(() => {
    const fetchTutorProfile = async () => {
      setIsLoading(true);
      
      try {
        // セッションチェック
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No active session found");
          router.push('/auth');
          return;
        }
        
        // 講師プロファイルを取得
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profile')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (tutorError) {
          console.error("Error fetching tutor profile by email:", tutorError);
          
          // メールで検索できない場合はIDで再試行
          const { data: tutorDataById, error: tutorErrorById } = await supabase
            .from('tutor_profile')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (tutorErrorById) {
            console.error("Error fetching tutor profile by ID:", tutorErrorById);
            toast({
              title: "エラー",
              description: "講師情報の取得に失敗しました",
              variant: "destructive",
            });
            router.push('/dashboard');
            return;
          } else if (tutorDataById) {
            console.log("Found tutor profile by ID:", tutorDataById);
            updateFormWithTutorData(tutorDataById, session.user.email);
          } else {
            toast({
              title: "講師プロフィールが見つかりません",
              description: "講師プロフィールの設定が必要です",
              variant: "destructive",
            });
            router.push('/profile-setup');
            return;
          }
        } else if (tutorData) {
          console.log("Found tutor profile:", tutorData);
          updateFormWithTutorData(tutorData, session.user.email);
        } else {
          toast({
            title: "講師プロフィールが見つかりません",
            description: "講師プロフィールの設定が必要です",
            variant: "destructive",
          });
          router.push('/profile-setup');
          return;
        }
      } catch (error: any) {
        console.error("Error in fetchTutorProfile:", error);
        toast({
          title: "エラー",
          description: error.message || "講師情報の取得中にエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTutorProfile();
  }, [router, toast]);

  // 講師データをフォームにセット
  const updateFormWithTutorData = (tutorData: any, email: string) => {
    const subjects = tutorData.subjects ? tutorData.subjects.split(',') : [];
    
    setFormData({
      id: tutorData.id,
      userId: tutorData.user_id,
      lastName: tutorData.last_name || "",
      firstName: tutorData.first_name || "",
      lastNameFurigana: tutorData.last_name_furigana || "",
      firstNameFurigana: tutorData.first_name_furigana || "",
      university: tutorData.university || "",
      bio: tutorData.bio || "",
      birthDate: tutorData.birth_date || "",
      selectedSubjects: subjects,
      email: email,
    });
  };

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
    setIsSaving(true);

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

      // 科目の配列をカンマ区切りの文字列に変換
      const subjects = formData.selectedSubjects.join(",");
      
      // データベースの更新
      const { error: updateError } = await supabase
        .from('tutor_profile')
        .update({
          last_name: formData.lastName,
          first_name: formData.firstName,
          last_name_furigana: formData.lastNameFurigana,
          first_name_furigana: formData.firstNameFurigana,
          university: formData.university,
          birth_date: formData.birthDate,
          bio: formData.bio,
          subjects: subjects,
          email: formData.email,
          profile_completed: true,
        })
        .eq('id', formData.id);
        
      if (updateError) {
        throw new Error(`プロフィールの更新中にエラーが発生しました: ${updateError.message}`);
      }
      
      toast({
        title: "プロフィール更新完了",
        description: "講師プロフィールが正常に更新されました",
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      console.error("プロフィール更新エラー:", error);
      toast({
        title: "エラー",
        description: error.message || "プロフィールの更新中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* ヘッダー部分 */}
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">プロフィール編集</h1>
          <p className="text-lg text-muted-foreground mt-1">
            講師プロフィール情報を更新する
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">読み込み中...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <User className="mr-2 h-5 w-5 text-blue-600" />
                基本情報
              </CardTitle>
              <CardDescription>
                プロフィールの基本情報を設定します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="university">大学名</Label>
                  <div className="flex">
                    <Building className="h-4 w-4 text-gray-500 mr-2 mt-2.5" />
                    <Input
                      id="university"
                      value={formData.university}
                      onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                      placeholder="例：東京大学"
                      className="flex-1"
                      required
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">現在通っている、または卒業した大学名を入力してください</p>
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
              
              <div className="space-y-2">
                <Label htmlFor="bio">自己紹介</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="生徒や保護者に向けて自己紹介を書いてください"
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <Book className="mr-2 h-5 w-5 text-green-600" />
                指導可能な科目
              </CardTitle>
              <CardDescription>
                指導可能な科目を選択してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 小学生の科目 */}
                  <div className="space-y-2">
                    <Label className="font-medium">小学生</Label>
                    <div className="space-y-1.5 bg-white p-3 rounded-md border">
                      {elementarySubjects.map(subject => (
                        <div key={`小学${subject}`} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`elem-${subject}`}
                            checked={formData.selectedSubjects.includes(`小学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, "小学生")}
                          />
                          <Label
                            htmlFor={`elem-${subject}`}
                            className="text-sm font-normal cursor-pointer"
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
                    <div className="space-y-1.5 bg-white p-3 rounded-md border">
                      {juniorHighSubjects.map(subject => (
                        <div key={`中学${subject}`} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`jhs-${subject}`}
                            checked={formData.selectedSubjects.includes(`中学${subject}`)}
                            onCheckedChange={() => handleSubjectChange(subject, "中学生")}
                          />
                          <Label
                            htmlFor={`jhs-${subject}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 高校生の科目（カテゴリー分け） */}
                  <div className="space-y-2">
                    <Label className="font-medium">高校生</Label>
                    <div className="bg-white p-3 rounded-md border space-y-3">
                      {Object.entries(highSchoolCategories).map(([category, subjects]) => (
                        <div key={category} className="">
                          <Label className="text-sm font-medium text-gray-700">{category}</Label>
                          <div className="mt-1 space-y-1.5">
                            {subjects.map(subject => {
                              const fullSubjectName = `高校${subject}`;
                              return (
                                <div key={fullSubjectName} className="flex items-center space-x-2 py-1">
                                  <Checkbox
                                    id={`hs-${subject}`}
                                    checked={formData.selectedSubjects.includes(fullSubjectName)}
                                    onCheckedChange={() => handleSubjectChange(subject, "高校生")}
                                  />
                                  <Label
                                    htmlFor={`hs-${subject}`}
                                    className="text-sm font-normal cursor-pointer"
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
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    <span>変更を保存</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}