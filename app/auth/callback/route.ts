import { NextRequest, NextResponse } from "next/server";

// 静的エクスポート用に簡略化したバージョン
export async function GET(request: NextRequest) {
  // 環境変数からベースURLを取得するか、フォールバックとしてlocalhostを使用
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000";
  // メンテナンスモードでは絶対URLでダッシュボードにリダイレクト
  return NextResponse.redirect(`${baseUrl}/dashboard`);
}

// 静的ファイルを生成するためのオプション指定
export const dynamic = 'force-static';
