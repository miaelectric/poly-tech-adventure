import { NextRequest, NextResponse } from "next/server";
import { getDb, hasDatabase } from "@/lib/db";
import { verifyToken } from "@/lib/session-token";
import { isCharacterId } from "@/lib/characters";
import { SESSION_MAX_AGE_MS, maxPlausibleScore, validateNickname } from "@/lib/validation";

// 랭킹은 항상 최신 데이터 (캐시 동작을 명시)
export const dynamic = "force-dynamic";

const TOP_N = 20;
const MEMORY_CAP = 100;

/** poly_tech_scores 행 (docs/TRD.md §2) */
type Score = {
  id: number;
  player_name: string;
  score: number;
  character_id: string;
  created_at: string;
};

// 저장소 모드: db | memory(로컬 개발 전용) | unavailable(운영인데 DB 없음)
type Mode = "db" | "memory" | "unavailable";
function mode(): Mode {
  if (hasDatabase()) return "db";
  return process.env.NODE_ENV === "production" ? "unavailable" : "memory";
}
if (mode() === "unavailable") {
  console.error("[scores] DATABASE_URL이 설정되지 않아 랭킹을 사용할 수 없습니다 (503 반환).");
}

// 메모리 모드: 서버리스 인스턴스 간 공유 안 됨 → 개발용으로만 사용
const g = globalThis as unknown as { __polyTechScores?: Score[]; __polyTechSeq?: number };
const memScores: Score[] = (g.__polyTechScores ??= []);
g.__polyTechSeq = memScores.reduce((m, s) => Math.max(m, s.id), g.__polyTechSeq ?? 0);

/** 점수 내림차순, 동점이면 먼저 달성(created_at, id 오름차순) */
function compare(a: Score, b: Score) {
  return b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id;
}

function err(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const m = mode();
    if (m === "unavailable") return err(503, "ranking_unavailable", "랭킹 서버가 설정되지 않았어요.");
    if (m === "memory") {
      return NextResponse.json([...memScores].sort(compare).slice(0, TOP_N), { headers: { "Cache-Control": "no-store" } });
    }
    const sql = getDb();
    const rows = await sql`
      SELECT id, player_name, score, character_id, created_at
      FROM poly_tech_scores
      ORDER BY score DESC, created_at ASC, id ASC
      LIMIT ${TOP_N}
    `;
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return err(500, "db_error", "랭킹을 불러오지 못했어요.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const m = mode();
    if (m === "unavailable") return err(503, "ranking_unavailable", "랭킹 서버가 설정되지 않았어요.");

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err(400, "invalid_json", "잘못된 요청이에요."); }

    // --- 입력 검증 ---
    const nick = validateNickname(body.player_name);
    if (!nick.ok) return err(400, "invalid_player_name", nick.error);
    const character = body.character_id;
    if (!isCharacterId(character)) return err(400, "invalid_character", "알 수 없는 캐릭터예요.");
    const score = body.score;
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1) {
      return err(400, "invalid_score", "1 섹터 이상만 기록할 수 있어요.");
    }

    // --- 세션 토큰 + 점수 타당성 ---
    const startedAt = verifyToken(body.token);
    if (startedAt === null) return err(403, "invalid_token", "게임 세션이 올바르지 않아요.");
    const elapsed = Date.now() - startedAt;
    if (elapsed < 0 || elapsed > SESSION_MAX_AGE_MS) return err(403, "expired_token", "게임 세션이 만료됐어요.");
    if (score > maxPlausibleScore(elapsed)) return err(422, "implausible_score", "기록을 확인할 수 없어요.");

    if (m === "memory") {
      g.__polyTechSeq = (g.__polyTechSeq ?? 0) + 1;
      const rec: Score = {
        id: g.__polyTechSeq, player_name: nick.value, score, character_id: character,
        created_at: new Date().toISOString(),
      };
      memScores.push(rec);
      memScores.sort(compare);
      const rank = memScores.indexOf(rec) + 1;
      memScores.splice(MEMORY_CAP);
      return NextResponse.json({ id: rec.id, rank }, { status: 201 });
    }

    const sql = getDb();
    const inserted = await sql`
      INSERT INTO poly_tech_scores (player_name, score, character_id)
      VALUES (${nick.value}, ${score}, ${character})
      RETURNING id
    `;
    // 새 기록은 동점자 중 가장 늦으므로, 자기보다 같거나 높은 기록 수 = 내 순위
    const ranked = await sql`SELECT COUNT(*)::int AS rank FROM poly_tech_scores WHERE score >= ${score}`;
    return NextResponse.json({ id: inserted[0].id, rank: ranked[0].rank }, { status: 201 });
  } catch (e) {
    console.error(e);
    return err(500, "db_error", "기록을 저장하지 못했어요.");
  }
}
