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
        console.warn("Warning: Error accessing users table:", userUpdateError);
        // エラーをスローせずに続行
      }

      console.log("Saving student profiles...");
      
      // 生徒情報を保存または更新
      for (const student of students) {
        // student_profile テーブルの構造に合わせて保存
        const { data: existingStudent, error: studentCheckError } = await supabase
          .from('student_profile')
          .select('*')
          .eq('parent_id', parentData.id) // 親IDで生徒を紐付け
          .eq('last_name', student.lastName) // 姓名で既存生徒を検索 (簡易的なマッチング)
          .eq('first_name', student.firstName)
          .maybeSingle();

        console.log("Existing student check for", student.lastName, student.firstName, ":", { existingStudent, studentCheckError });

        if (existingStudent) {
          // 既存生徒を更新
           const { data: studentUpdateData, error: studentUpdateError } = await supabase
            .from('student_profile')
            .update({
              last_name: student.lastName,
              first_name: student.firstName,
              last_name_furigana: student.lastNameFurigana,
              first_name_furigana: student.firstNameFurigana,
              gender: student.gender,
              school: student.school,
              grade: student.grade,
              birth_date: student.birthDate,
              parent_id: parentData.id // 親IDを紐付け
            })
            .eq('id', existingStudent.id)
            .select();

          if (studentUpdateError) {
            console.error("Error updating student profile:", studentUpdateError);
            throw studentUpdateError;
          }
          console.log("Student profile updated:", studentUpdateData);

        } else {
          // 新規生徒を作成
          const { data: studentInsertData, error: studentInsertError } = await supabase
            .from('student_profile')
            .insert([{
              last_name: student.lastName,
              first_name: student.firstName,
              last_name_furigana: student.lastNameFurigana,
              first_name_furigana: student.firstNameFurigana,
              gender: student.gender,
              school: student.school,
              grade: student.grade,
              birth_date: student.birthDate,
              parent_id: parentData.id // 親IDを紐付け
            }])
            .select();
            
          if (studentInsertError) {
            console.error("Error inserting student profile:", studentInsertError);
            throw studentInsertError;
          }
          console.log("Student profile inserted:", studentInsertData);

          // 新規生徒には初期チケット0枚を付与（parent_profile作成時に0枚設定済みなので不要かも）
          // const { error: ticketInsertError } = await supabase
          //   .from('student_tickets')
          //   .insert({ student_id: studentInsertData[0].id, quantity: 0 });

          // if (ticketInsertError) {
          //   console.warn("Warning: Could not insert initial ticket for new student:", ticketInsertError);
          // }
        }
      }

      toast({
        title: "登録完了",
        description: "保護者プロフィールと生徒情報が登録されました",
      });

      // 登録完了後、ダッシュボードにリダイレクト
      router.push("/dashboard");

    } catch (error: any) {
      console.error("Registration failed:", error);
      toast({
        title: "登録失敗",
        description: `プロフィールの登録に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6">保護者プロフィール設定</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">保護者情報</CardTitle>
            <CardDescription>保護者様の情報をご入力ください。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentName">氏名</Label>
                  <Input
                    id="parentName"
                    type="text"
                    placeholder="山田 太郎"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09012345678" // 例
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="postalCode">郵便番号</Label>
                    <div className="flex gap-2">
                        <Input
                            id="postalCode"
                            type="text"
                            placeholder="100-0001" // 例
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                            required
                            maxLength={8}
                        />
                         <Button 
                            type="button" 
                            onClick={searchAddressByPostalCode} 
                            disabled={isSearchingAddress || formData.postalCode.length < 7}
                            className="flex items-center"
                         >
                            {isSearchingAddress ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="mr-2 h-4 w-4" />
                            )}
                            検索
                         </Button>
                    </div>
                 </div>
                <div>
                  <Label htmlFor="prefecture">都道府県</Label>
                  <Input
                    id="prefecture"
                    type="text"
                    placeholder="東京都"
                    value={formData.prefecture}
                    onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="city">市区町村以降</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="千代田区千代田"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

               <div>
                <Label htmlFor="address">番地・建物名</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="1-1-1"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              {/* 生徒情報セクション */}
              <h2 className="text-xl font-semibold mt-8 mb-4">生徒情報</h2>
              {formData.students.map((student, index) => (
                <Card key={index} className="mb-4 border-gray-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">生徒 {index + 1}</CardTitle>
                    {formData.students.length > 1 && (
                      <Button variant="destructive" size="sm" onClick={() => removeStudent(index)}>
                        <Trash2 className="mr-1 h-4 w-4" /> 削除
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`lastName-${index}`}>姓</Label>
                        <Input
                          id={`lastName-${index}`}
                          type="text"
                          placeholder="山田"
                          value={student.lastName}
                          onChange={(e) => handleStudentChange(index, 'lastName', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`firstName-${index}`}>名</Label>
                        <Input
                          id={`firstName-${index}`}
                          type="text"
                          placeholder="太郎"
                          value={student.firstName}
                          onChange={(e) => handleStudentChange(index, 'firstName', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`lastNameFurigana-${index}`}>姓（ふりがな）</Label>
                        <Input
                          id={`lastNameFurigana-${index}`}
                          type="text"
                          placeholder="やまだ"
                          value={student.lastNameFurigana}
                          onChange={(e) => handleStudentChange(index, 'lastNameFurigana', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`firstNameFurigana-${index}`}>名（ふりがな）</Label>
                        <Input
                          id={`firstNameFurigana-${index}`}
                          type="text"
                          placeholder="たろう"
                          value={student.firstNameFurigana}
                          onChange={(e) => handleStudentChange(index, 'firstNameFurigana', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`gender-${index}`}>性別</Label>
                         <select
                            id={`gender-${index}`}
                            value={student.gender}
                            onChange={(e) => handleStudentChange(index, 'gender', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            required
                          >
                            <option value="">選択してください</option>
                            <option value="male">男性</option>
                            <option value="female">女性</option>
                            <option value="other">その他</option>
                          </select>
                      </div>
                       <div>
                        <Label htmlFor={`birthDate-${index}`}>生年月日</Label>
                         <Input
                           id={`birthDate-${index}`}
                           type="date"
                           value={student.birthDate}
                           onChange={(e) => handleStudentChange(index, 'birthDate', e.target.value)}
                           required
                         />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`school-${index}`}>学校名</Label>
                        <Input
                          id={`school-${index}`}
                          type="text"
                          placeholder="〇〇小学校"
                          value={student.school}
                          onChange={(e) => handleStudentChange(index, 'school', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`grade-${index}`}>学年</Label>
                          <select
                            id={`grade-${index}`}
                            value={student.grade}
                            onChange={(e) => handleStudentChange(index, 'grade', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            required
                          >
                            <option value="">選択してください</option>
                            {gradeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={addStudent} className="w-full flex items-center justify-center">
                <PlusCircle className="mr-2 h-4 w-4" /> 生徒を追加
              </Button>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'プロフィールを保存'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 