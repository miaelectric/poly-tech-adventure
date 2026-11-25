import { NextRequest, NextResponse } from "next/server";
import { StoreUnavailableError, getTopScores, submitScore } from "@/lib/score_store";
import { isValidGameId, isValidScore, validateNickname } from "@/lib/game_rules";
import { isCharacterId } from "@/lib/characters";

// 랭킹은 항상 최신 데이터
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}
function err(status: number, error: string, message: string) {
  return json({ error, message }, status);
}

/**
 * 응답 코드 (docs/TRD.md §5.3)
 * 201 등록 성공 · 400 입력 오류 · 404 game_id 없음 · 409 이미 제출됨
 * 410 game_id 만료 · 422 플레이 시간 부족 · 500 DB 오류 · 503 저장소 미설정
 */
const REJECT: Record<string, [number, string]> = {
  game_not_found: [404, "게임 세션을 찾을 수 없어요."],
  already_submitted: [409, "이미 기록이 등록된 게임이에요."],
  expired: [410, "게임 세션이 만료됐어요."],
  too_fast: [422, "기록을 확인할 수 없어요."],
};

/** GET /api/scores : 명예의 전당 TOP 20 */
export async function GET() {
  try {
    return json(await getTopScores());
  } catch (e) {
    if (e instanceof StoreUnavailableError) return err(503, "ranking_unavailable", "랭킹 서버가 설정되지 않았어요.");
    console.error(e);
    return err(500, "db_error", "랭킹을 불러오지 못했어요.");
  }
}

/** POST /api/scores : 점수 등록 */
export async function POST(req: NextRequest) {
  // 1. 요청 본문 파싱
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch {
    return err(400, "invalid_json", "잘못된 요청이에요.");
  }

  // 2. 입력 형식 검증 (lib/game_rules.js — 화면과 같은 규칙)
  if (!isValidGameId(body.game_id)) return err(400, "invalid_game_id", "게임 세션 형식이 올바르지 않아요.");
  const nick = validateNickname(body.player_name);
  if (!nick.ok) return err(400, "invalid_player_name", nick.error);
  if (!isCharacterId(body.character_id)) return err(400, "invalid_character", "알 수 없는 캐릭터예요.");
  if (!isValidScore(body.score)) return err(400, "invalid_score", "1 섹터 이상만 기록할 수 있어요.");

  // 3~8. 잠금 → game_id 확인 → 중복 확인 → 플레이 시간 검증 → 저장 → 순위 (lib/score_store.js)
  try {
    const r = await submitScore({
      gameId: body.game_id, playerName: nick.value, characterId: body.character_id, score: body.score,
    });
    if (r.ok) return json({ id: r.id, rank: r.rank }, 201);
    const [status, message] = REJECT[r.reason];
    return err(status, r.reason, message);
  } catch (e) {
    if (e instanceof StoreUnavailableError) return err(503, "ranking_unavailable", "랭킹 서버가 설정되지 않았어요.");
    console.error(e);
    return err(500, "db_error", "기록을 저장하지 못했어요.");
  }
}
