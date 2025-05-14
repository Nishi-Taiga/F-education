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
import { PlusCircle, Trash2 } from "lucide-react";

export default function ParentProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    emergencyContact: "",
    notes: "",
    students: [
      { name: "", grade: "", school: "", subjects: "" }
    ]
  });

  const handleStudentChange = (index: number, field: string, value: string) => {
    const updatedStudents = [...formData.students];
    updatedStudents[index] = {
      ...updatedStudents[index],
      [field]: value
    };
    setFormData({ ...formData, students: updatedStudents });
  };

  const addStudent = () => {
    setFormData({
      ...formData,
      students: [...formData.students, { name: "", grade: "", school: "", subjects: "" }]
    });
  };

  const removeStudent = (index: number) => {
    if (formData.students.length > 1) {
      const updatedStudents = formData.students.filter((_, i) => i !== index);
      setFormData({ ...formData, students: updatedStudents });
    } else {
      toast({
        title: "エラー",
        description: "少なくとも1人の生徒情報が必要です",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // ユーザーセッションを取得
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("ユーザー認証情報が見つかりません");
      }

      // 保護者プロフィールを保存
      const { error: profileError, data: profileData } = await supabase
        .from('parent_profiles')
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            emergency_contact: formData.emergencyContact,
            notes: formData.notes
          }
        ])
        .select();

      if (profileError) throw profileError;

      // 生徒情報を保存
      const studentPromises = formData.students.map(student => {
        return supabase
          .from('students')
          .insert([
            {
              parent_id: profileData[0].id,
              name: student.name,
              grade: student.grade,
              school: student.school,
              subjects_of_interest: student.subjects
            }
          ]);
      });

      const studentResults = await Promise.all(studentPromises);
      
      // 生徒データのエラーチェック
      for (const result of studentResults) {
        if (result.error) throw result.error;
      }

      // 成功通知
      toast({
        title: "プロフィール設定完了",
        description: "保護者プロフィールが正常に設定されました",
      });

      // ダッシュボードへリダイレクト
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
            <CardTitle className="text-2xl">保護者プロフィール設定</CardTitle>
            <CardDescription>
              保護者としてのプロフィール情報を入力してください。
              生徒の情報も合わせて登録します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">保護者情報</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">お名前</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="田中 花子"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">電話番号</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="090-1234-5678"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">住所</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="東京都渋谷区渋谷　1-1-1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">緊急連絡先</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="携帯30-1234-5678（父・田中太郎）"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">備考・特記事項</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="講師への特別なリクエストや考慮点があればご記入ください"
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">生徒情報</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStudent}
                    className="flex items-center"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    生徒を追加
                  </Button>
                </div>

                {formData.students.map((student, index) => (
                  <Card key={index} className="relative p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 text-gray-500 hover:text-red-500"
                      onClick={() => removeStudent(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <h4 className="font-medium mb-3">生徒 {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`student-name-${index}`}>生徒名</Label>
                        <Input
                          id={`student-name-${index}`}
                          value={student.name}
                          onChange={(e) => handleStudentChange(index, 'name', e.target.value)}
                          placeholder="田中 太郎"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-grade-${index}`}>学年</Label>
                        <Input
                          id={`student-grade-${index}`}
                          value={student.grade}
                          onChange={(e) => handleStudentChange(index, 'grade', e.target.value)}
                          placeholder="中学2年"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-school-${index}`}>学校名</Label>
                        <Input
                          id={`student-school-${index}`}
                          value={student.school}
                          onChange={(e) => handleStudentChange(index, 'school', e.target.value)}
                          placeholder="渋谷中学校"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-subjects-${index}`}>希望科目</Label>
                        <Input
                          id={`student-subjects-${index}`}
                          value={student.subjects}
                          onChange={(e) => handleStudentChange(index, 'subjects', e.target.value)}
                          placeholder="数学、英語"
                          required
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={isLoading}
                >
                  {isLoading ? "保存中..." : "プロフィールを保存"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
