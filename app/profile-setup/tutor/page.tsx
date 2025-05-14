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

export default function TutorProfileSetup() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    specialization: "",
    yearsOfExperience: "",
    hourlyRate: "",
    subjects: [] as string[],
    availability: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
  });

  const subjects = [
    "数学", "英語", "国語", "理科", "社会", "物理", "化学", "生物", "地学", 
    "世界史", "日本史", "地理", "プログラミング", "音楽", "美術", "体育"
  ];

  const handleSubjectChange = (subject: string) => {
    setFormData(prev => {
      const subjects = prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects };
    });
  };

  const handleAvailabilityChange = (day: keyof typeof formData.availability) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: !prev.availability[day]
      }
    }));
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

      // プロフィール情報を保存
      const { error } = await supabase
        .from('tutor_profiles')
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            bio: formData.bio,
            specialization: formData.specialization,
            years_of_experience: parseInt(formData.yearsOfExperience),
            hourly_rate: parseInt(formData.hourlyRate),
            subjects: formData.subjects,
            availability: formData.availability
          }
        ]);

      if (error) throw error;

      // 成功通知
      toast({
        title: "プロフィール設定完了",
        description: "講師プロフィールが正常に設定されました",
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
            <CardTitle className="text-2xl">講師プロフィール設定</CardTitle>
            <CardDescription>
              講師としてのプロフィール情報を入力してください。これらの情報は保護者が講師を選ぶ際に表示されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">氏名</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="田中 太郎"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">自己紹介</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="自己紹介や指導方針などを記入してください"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="specialization">専門分野</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="例: 高校数学・物理"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">指導経験年数</Label>
                  <Select
                    onValueChange={(value) => setFormData({ ...formData, yearsOfExperience: value })}
                    defaultValue={formData.yearsOfExperience}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">1年未満</SelectItem>
                      <SelectItem value="1">1年</SelectItem>
                      <SelectItem value="2">2年</SelectItem>
                      <SelectItem value="3">3年</SelectItem>
                      <SelectItem value="5">5年以上</SelectItem>
                      <SelectItem value="10">10年以上</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">時給（円）</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="例: 3000"
                  min="1000"
                  step="100"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>指導可能科目</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {subjects.map((subject) => (
                    <div key={subject} className="flex items-center space-x-2">
                      <Checkbox
                        id={`subject-${subject}`}
                        checked={formData.subjects.includes(subject)}
                        onCheckedChange={() => handleSubjectChange(subject)}
                      />
                      <Label
                        htmlFor={`subject-${subject}`}
                        className="text-sm font-normal"
                      >
                        {subject}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>指導可能曜日</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(formData.availability).map(([day, checked]) => {
                    const localizedDay = {
                      monday: "月曜日",
                      tuesday: "火曜日",
                      wednesday: "水曜日",
                      thursday: "木曜日",
                      friday: "金曜日",
                      saturday: "土曜日",
                      sunday: "日曜日"
                    }[day as keyof typeof formData.availability];

                    return (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day}`}
                          checked={checked}
                          onCheckedChange={() => handleAvailabilityChange(day as keyof typeof formData.availability)}
                        />
                        <Label
                          htmlFor={`day-${day}`}
                          className="text-sm font-normal"
                        >
                          {localizedDay}
                        </Label>
                      </div>
                    );
                  })}
                </div>
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
