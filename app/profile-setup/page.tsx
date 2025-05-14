"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, GraduationCap, ArrowRight } from "lucide-react";

export default function UserTypeSelection() {
  const router = useRouter();
  
  // 保護者登録ページへ移動
  const goToParentProfile = () => {
    router.push('/profile-setup/parent');
  };
  
  // 講師登録ページへ移動
  const goToTutorProfile = () => {
    router.push('/profile-setup/tutor');
  };

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Feducation</h1>
        <p className="text-center text-gray-600 mb-12">家庭教師授業予約システム</p>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">ユーザー種別の選択</CardTitle>
            <CardDescription>
              サービスをご利用いただく際の種別を選択してください。
              ご選択いただいた種別に応じた登録フォームにご案内します。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 pt-4">
            <Card className="border-2 hover:border-primary hover:shadow-md transition-all cursor-pointer" onClick={goToParentProfile}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  保護者として登録
                </CardTitle>
                <CardDescription>
                  生徒の親または保護者としてサービスを利用します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  保護者アカウントでは以下のことができます：
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>生徒の登録と管理</li>
                  <li>授業のスケジュール予約</li>
                  <li>授業チケットの購入</li>
                  <li>授業レポートの閲覧</li>
                </ul>
                <Button className="w-full mt-6 flex items-center justify-center" onClick={goToParentProfile}>
                  <span>登録へ進む</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-2 hover:border-primary hover:shadow-md transition-all cursor-pointer" onClick={goToTutorProfile}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  講師として登録
                </CardTitle>
                <CardDescription>
                  家庭教師として生徒に授業を提供します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  講師アカウントでは以下のことができます：
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>指導可能な科目の選択</li>
                  <li>授業スケジュールの管理</li>
                  <li>授業レポートの作成</li>
                  <li>指導可能時間の設定</li>
                </ul>
                <Button className="w-full mt-6 flex items-center justify-center" onClick={goToTutorProfile}>
                  <span>登録へ進む</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
        
        <p className="text-center text-sm text-gray-500">
          既に登録済みの方は <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/')}>ホームページ</Button> からログインしてください。
        </p>
      </div>
    </div>
  );
}
