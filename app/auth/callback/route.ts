import { NextRequest, NextResponse } from "next/server";

// 静的エクスポート用に簡略化したバージョン
export async function GET(request: NextRequest) {
  // メンテナンスモードではダッシュボードにリダイレクト
  return NextResponse.redirect("/dashboard");
}

// 静的ファイルを生成するためのオプション指定
export const dynamic = 'force-static';
