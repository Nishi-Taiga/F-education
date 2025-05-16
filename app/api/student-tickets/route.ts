import { NextRequest, NextResponse } from "next/server";

// 静的ビルドのための簡略化されたバージョン
export async function GET(request: NextRequest) {
  try {
    // メンテナンスモード中は空の配列を返す
    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching student tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // メンテナンスモード中は503を返す
    return NextResponse.json({ message: "Service is under maintenance" }, { status: 503 });
  } catch (error) {
    console.error("Error processing student tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
