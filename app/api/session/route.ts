import { NextResponse } from "next/server";
import { issueToken } from "@/lib/session-token";

export const dynamic = "force-dynamic";

/** 게임 시작 시 호출: 시작 시각이 서명된 토큰 발급 */
export async function POST() {
  return NextResponse.json({ token: issueToken() }, { headers: { "Cache-Control": "no-store" } });
}
