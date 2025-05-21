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
import { PlusCircle, Trash2, Search, Loader2 } from "lucide-react";
import axios from "axios";

export default function ParentProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  
  const [formData, setFormData] = useState({
    parentName: "",
    phone: "",
    postalCode: "",
    prefecture: "",
    city: "",
    address: "",
    students: [
      { 
        lastName: "", 
        firstName: "", 
        lastNameFurigana: "", 
        firstNameFurigana: "", 
        gender: "", 
        school: "", 
        grade: "", 
        birthDate: "" 
      }
    ]
  });

  // 郵便番号から住所を検索する関数
  const searchAddressByPostalCode = async () => {
    if (!formData.postalCode || formData.postalCode.length < 7) {
      toast({
        title: "郵便番号エラー",
        description: "正しい郵便番号を入力してください",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSearchingAddress(true);
      // 郵便番号から「-」を除去
      const cleanPostalCode = formData.postalCode.replace(/-/g, '');
      const response = await axios.get(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanPostalCode}`);
      
      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        // 住所情報をセット
        setFormData({
          ...formData,
          prefecture: result.address1,
          city: result.address2 + result.address3
        });
        
        toast({
          title: "住所が見つかりました",
          description: `${result.address1}${result.address2}${result.address3}`,
        });
      } else {
        toast({
          title: "住所が見つかりませんでした",
          description: "正しい郵便番号を入力してください",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "住所検索に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 学年の選択肢
  const gradeOptions = [
    { value: "小学1年生", label: "小学1年生" },
    { value: "小学2年生", label: "小学2年生" },
    { value: "小学3年生", label: "小学3年生" },
    { value: "小学4年生", label: "小学4年生" },
    { value: "小学5年生", label: "小学5年生" },
    { value: "小学6年生", label: "小学6年生" },
    { value: "中学1年生", label: "中学1年生" },
    { value: "中学2年生", label: "中学2年生" },
    { value: "中学3年生", label: "中学3年生" },
    { value: "高校1年生", label: "高校1年生" },
    { value: "高校2年生", label: "高校2年生" },
    { value: "高校3年生", label: "高校3年生" },
  ];

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
      students: [...formData.students, {
        lastName: "", 
        firstName: "", 
        lastNameFurigana: "", 
        firstNameFurigana: "", 
        gender: "", 
        school: "", 
        grade: "", 
        birthDate: ""
      }]
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
      // 入力バリデーション
      const { parentName, phone, postalCode, prefecture, city, address, students } = formData;
      
      if (!parentName || !phone || !postalCode || !prefecture || !city || !address) {
        throw new Error("保護者情報の必須項目が入力されていません");
      }
      
      // 生徒情報のバリデーション
      for (const student of students) {
        const {
          lastName, firstName, lastNameFurigana, firstNameFurigana,
          gender, school, grade, birthDate
        } = student;
        
        if (!lastName || !firstName || !lastNameFurigana || !firstNameFurigana ||
            !gender || !school || !grade || !birthDate) {
          throw new Error("生徒情報の必須項目が入力されていません");
        }
      }

      // ユーザーセッションを取得
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("ユーザー認証情報が見つかりません");
      }

      console.log("Creating or updating parent profile...");

      // 既存のparent_profileテーブル構造に合わせて保存
      const { data: existingParent, error: checkError } = await supabase
        .from('parent_profile')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      console.log("Existing parent profile check:", { existingParent, checkError });
      
      let parentData;
      
      if (existingParent) {
        // 既存プロファイルを更新
        const { data, error } = await supabase
          .from('parent_profile')
          .update({
            name: parentName,
            phone: phone,
            postal_code: postalCode,
            prefecture: prefecture,
            city: city,
            address: address,
            role: 'parent'
          })
          .eq('id', existingParent.id)
          .select();
          
        if (error) {
          console.error("Error updating parent profile:", error);
          throw error;
        }
        parentData = data[0];
      } else {
        // 新規プロファイルを作成
        const { data, error } = await supabase
          .from('parent_profile')
          .insert([{
            name: parentName,
            email: user.email,
            phone: phone,
            postal_code: postalCode,
            prefecture: prefecture,
            city: city,
            address: address,
            role: 'parent',
            ticket_count: 0
          }])
          .select();
          
        if (error) {
          console.error("Error inserting parent profile:", error);
          throw error;
        }
        parentData = data[0];
      }

      console.log("Parent profile saved:", parentData);

      try {
        // usersテーブルが存在しない場合でも処理を継続するため、try-catchで囲む
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ 
            profile_completed: true,
            role: 'parent'
          })
          .eq('auth_user_id', user.id);

        if (userUpdateError) {
          console.warn("Warning: Could not update user profile_completed flag:", userUpdateError);
          // エラーをスローせずに続行
        }
      } catch (userUpdateError) {
        console.warn("Warning: Could not update user profile_completed flag:", userUpdateError);
        // エラーをスローせずに続行
      }

      let studentSuccess = true;

      try {
        // 生徒情報を保存
        for (const student of students) {
          try {
            const { error: studentError } = await supabase
              .from('students')
              .insert([{
                parent_id: parentData.id,
                last_name: student.lastName,
                first_name: student.firstName,
                last_name_furigana: student.lastNameFurigana,
                first_name_furigana: student.firstNameFurigana,
                gender: student.gender,
                school: student.school,
                grade: student.grade,
                birth_date: student.birthDate
              }]);

            if (studentError) {
              console.error("Error saving student:", studentError);
              studentSuccess = false;
            }
          } catch (error) {
            console.error("Error in student insert:", error);
            studentSuccess = false;
          }
        }
      } catch (studentsError) {
        console.error("Error processing students:", studentsError);
        studentSuccess = false;
      }

      // 成功通知
      toast({
        title: "プロフィール設定完了",
        description: studentSuccess 
          ? "保護者プロフィールが正常に設定されました" 
          : "保護者プロフィールは保存されましたが、生徒情報の保存に失敗しました",
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
              保護者としての情報と生徒情報を入力してください。
              サービスを利用するために必要な情報です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 保護者情報 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">保護者情報</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="parentName">保護者氏名</Label>
                  <Input
                    id="parentName"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="例：山田 太郎"
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
                    placeholder="例：090-1234-5678"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">郵便番号</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="例：123-4567"
                      required
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={searchAddressByPostalCode}
                      disabled={isSearchingAddress || !formData.postalCode || formData.postalCode.length < 7}
                    >
                      {isSearchingAddress ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefecture">都道府県</Label>
                    <Input
                      id="prefecture"
                      value={formData.prefecture}
                      onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                      placeholder="例：東京都"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">市区町村</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="例：渋谷区"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">番地・マンション名等</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="例：1-2-3 ○○マンション101"
                    required
                  />
                </div>
              </div>

              <hr className="my-6" />

              {/* 生徒情報 */}
              <div className="space-y-4">
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`student-lastName-${index}`}>姓</Label>
                        <Input
                          id={`student-lastName-${index}`}
                          value={student.lastName}
                          onChange={(e) => handleStudentChange(index, 'lastName', e.target.value)}
                          placeholder="例：山田"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-firstName-${index}`}>名</Label>
                        <Input
                          id={`student-firstName-${index}`}
                          value={student.firstName}
                          onChange={(e) => handleStudentChange(index, 'firstName', e.target.value)}
                          placeholder="例：太郎"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor={`student-lastNameFurigana-${index}`}>姓（ふりがな）</Label>
                        <Input
                          id={`student-lastNameFurigana-${index}`}
                          value={student.lastNameFurigana}
                          onChange={(e) => handleStudentChange(index, 'lastNameFurigana', e.target.value)}
                          placeholder="例：やまだ"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-firstNameFurigana-${index}`}>名（ふりがな）</Label>
                        <Input
                          id={`student-firstNameFurigana-${index}`}
                          value={student.firstNameFurigana}
                          onChange={(e) => handleStudentChange(index, 'firstNameFurigana', e.target.value)}
                          placeholder="例：たろう"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Label htmlFor={`student-gender-${index}`}>性別</Label>
                      <select
                        id={`student-gender-${index}`}
                        value={student.gender}
                        onChange={(e) => handleStudentChange(index, 'gender', e.target.value)}
                        className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        <option value="">選択してください</option>
                        <option value="男性">男性</option>
                        <option value="女性">女性</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor={`student-school-${index}`}>学校名</Label>
                        <Input
                          id={`student-school-${index}`}
                          value={student.school}
                          onChange={(e) => handleStudentChange(index, 'school', e.target.value)}
                          placeholder="例：○○小学校"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`student-grade-${index}`}>学年</Label>
                        <select
                          id={`student-grade-${index}`}
                          value={student.grade}
                          onChange={(e) => handleStudentChange(index, 'grade', e.target.value)}
                          className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          required
                        >
                          <option value="">選択してください</option>
                          {gradeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Label htmlFor={`student-birthDate-${index}`}>生年月日</Label>
                      <Input
                        id={`student-birthDate-${index}`}
                        type="date"
                        value={student.birthDate}
                        onChange={(e) => handleStudentChange(index, 'birthDate', e.target.value)}
                        required
                      />
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