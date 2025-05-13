import { NextRequest, NextResponse } from "next/server";

// 静的ビルドのための簡略化されたバージョン
export async function GET(request: NextRequest) {
  try {
    // メンテナンスモード中はnullを返す
    return NextResponse.json(null);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // メンテナンスモード中は503を返す
    return NextResponse.json({ message: "Service is under maintenance" }, { status: 503 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
