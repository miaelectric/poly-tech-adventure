// 점수 저장소 — DB 접근은 이 파일 한 곳에서만 한다. (docs/TRD.md §5)
//
// - DATABASE_URL 있음      → Neon Postgres (@neondatabase/serverless)
// - 없음 + 개발 모드        → 메모리 저장소 (서버 재시작 시 초기화, 파일에 저장하지 않음)
// - 없음 + 운영 모드        → StoreUnavailableError (API는 503)
import { randomUUID } from "node:crypto";
import { neon, Pool } from "@neondatabase/serverless";
import { TOP_N, checkPlayTime } from "./game_rules.js";

/** @typedef {{ id: number, player_name: string, score: number, character_id: string, created_at: string }} ScoreRow */
/**
 * @typedef {{ ok: true, id: number, rank: number }
 *   | { ok: false, reason: "game_not_found" | "already_submitted" | "too_fast" | "expired" }} SubmitResult
 */

export class StoreUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL이 설정되지 않아 랭킹 저장소를 사용할 수 없습니다.");
    this.name = "StoreUnavailableError";
  }
}

function dbUrl() {
  const url = process.env.DATABASE_URL ?? "";
  return /^postgres(ql)?:\/\//.test(url) ? url : null;
}

/** @returns {"db" | "memory" | "unavailable"} */
export function storeMode() {
  if (dbUrl()) return "db";
  return process.env.NODE_ENV === "production" ? "unavailable" : "memory";
}

function requireMode() {
  const m = storeMode();
  if (m === "unavailable") throw new StoreUnavailableError();
  return m;
}

// ---------- 메모리 저장소 (개발 전용) ----------
/** @type {{ __polyTechMem?: { games: Map<string, { startedAt: number, submittedAt: number | null }>, scores: (ScoreRow & { game_id: string })[], seq: number } }} */
const g = /** @type {any} */ (globalThis);
const mem = (g.__polyTechMem ??= { games: new Map(), scores: [], seq: 0 });

/** 점수 내림차순, 동점이면 먼저 달성(created_at, id 오름차순) */
function compare(/** @type {ScoreRow} */ a, /** @type {ScoreRow} */ b) {
  return b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id;
}

// ---------- 공개 API ----------

/** 새 게임 세션 발급 */
export async function createGame() {
  const m = requireMode();
  const gameId = randomUUID();
  if (m === "memory") {
    mem.games.set(gameId, { startedAt: Date.now(), submittedAt: null });
    return { gameId };
  }
  const sql = neon(/** @type {string} */ (dbUrl()));
  await sql`INSERT INTO poly_tech_games (game_id) VALUES (${gameId})`;
  return { gameId };
}

/**
 * 명예의 전당 TOP N
 * @returns {Promise<ScoreRow[]>}
 */
export async function getTopScores(limit = TOP_N) {
  const m = requireMode();
  if (m === "memory") {
    return [...mem.scores].sort(compare).slice(0, limit).map(({ game_id: _omit, ...row }) => row);
  }
  const sql = neon(/** @type {string} */ (dbUrl()));
  const rows = await sql`
    SELECT id, player_name, score, character_id, created_at
    FROM poly_tech_scores
    ORDER BY score DESC, created_at ASC, id ASC
    LIMIT ${limit}
  `;
  return /** @type {ScoreRow[]} */ (rows);
}

/**
 * 점수 등록 (POST /api/scores 처리 3~8단계). 입력 형식 검증(1~2단계)은 호출 전에 끝나 있어야 한다.
 *   3. 트랜잭션 시작 + game_id 단위 잠금 (pg_advisory_xact_lock) → 같은 게임의 동시 등록 직렬화
 *   4. game_id 조회 (없으면 game_not_found)
 *   5. 이미 제출된 게임인지 확인 (already_submitted)
 *   6. 플레이 시간 검증 — DB 시계 기준 경과 시간 (too_fast / expired)
 *   7. 점수 INSERT + 게임 제출 시각 기록
 *   8. 순위 계산 후 COMMIT
 * @param {{ gameId: string, playerName: string, characterId: string, score: number }} input
 * @returns {Promise<SubmitResult>}
 */
export async function submitScore({ gameId, playerName, characterId, score }) {
  const m = requireMode();

  if (m === "memory") {
    // 단일 스레드 이벤트 루프라 await 없이 처리하면 원자적
    const game = mem.games.get(gameId);
    if (!game) return { ok: false, reason: "game_not_found" };
    if (game.submittedAt !== null) return { ok: false, reason: "already_submitted" };
    const time = checkPlayTime(score, Date.now() - game.startedAt);
    if (time !== "ok") return { ok: false, reason: time };
    game.submittedAt = Date.now();
    const row = { id: ++mem.seq, player_name: playerName, score, character_id: characterId, created_at: new Date().toISOString(), game_id: gameId };
    mem.scores.push(row);
    const rank = mem.scores.filter((s) => s.score >= score).length;
    return { ok: true, id: row.id, rank };
  }

  const pool = new Pool({ connectionString: /** @type {string} */ (dbUrl()) });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`poly_tech:${gameId}`]);

    const found = await client.query(
      `SELECT submitted_at, EXTRACT(EPOCH FROM (now() - started_at)) * 1000 AS elapsed_ms
       FROM poly_tech_games WHERE game_id = $1 FOR UPDATE`,
      [gameId],
    );
    if (found.rowCount === 0) { await client.query("ROLLBACK"); return { ok: false, reason: "game_not_found" }; }
    const game = found.rows[0];
    if (game.submitted_at !== null) { await client.query("ROLLBACK"); return { ok: false, reason: "already_submitted" }; }

    const time = checkPlayTime(score, Number(game.elapsed_ms));
    if (time !== "ok") { await client.query("ROLLBACK"); return { ok: false, reason: time }; }

    const ins = await client.query(
      `INSERT INTO poly_tech_scores (player_name, score, character_id, game_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [playerName, score, characterId, gameId],
    );
    await client.query("UPDATE poly_tech_games SET submitted_at = now() WHERE game_id = $1", [gameId]);

    // 새 기록은 동점자 중 가장 늦으므로, 자기보다 같거나 높은 기록 수 = 내 순위
    const ranked = await client.query("SELECT COUNT(*)::int AS rank FROM poly_tech_scores WHERE score >= $1", [score]);
    await client.query("COMMIT");
    return { ok: true, id: ins.rows[0].id, rank: ranked.rows[0].rank };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    // 잠금을 우회한 중복(유니크 인덱스 위반)도 중복 제출로 처리
    if (e && typeof e === "object" && "code" in e && e.code === "23505") return { ok: false, reason: "already_submitted" };
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
