import { NextResponse } from "next/server";
import { StoreUnavailableError, createGame } from "@/lib/score_store";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** POST /api/games : 게임 시작 시 game_id 발급 */
export async function POST() {
  try {
    const { gameId } = await createGame();
    return NextResponse.json({ game_id: gameId }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailableError) {
      return NextResponse.json({ error: "ranking_unavailable", message: "랭킹 서버가 설정되지 않았어요." }, { status: 503, headers: NO_STORE });
    }
    console.error(e);
    return NextResponse.json({ error: "db_error", message: "게임을 시작하지 못했어요." }, { status: 500, headers: NO_STORE });
  }
}
