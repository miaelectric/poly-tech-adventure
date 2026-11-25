// 게임 규칙·검증 함수 — 화면(클라이언트)과 API(서버)가 함께 사용한다. (docs/TRD.md §5)

/** 닉네임 최대 글자 수 (그래핌 단위) */
export const NICK_MAX = 10;
/** 랭킹 표시 수 (docs/PRD.md S4: TOP 20) */
export const TOP_N = 20;

/** 최소 플레이 시간: 이보다 빨리 제출된 기록은 거부 */
export const MIN_PLAY_MS = 1500;
/**
 * 점수 상한: 일반 이동 약 5칸/초 + 데이터 칩 보너스 + 안영휘 피버(3초 자동 질주)를 고려해
 * 초당 8섹터 + 여유 30.
 */
export const MAX_SCORE_PER_SEC = 8;
export const SCORE_SLACK = 30;
/** 발급된 game_id 유효 시간 */
export const GAME_MAX_AGE_MS = 60 * 60 * 1000;
/** 점수 상한(DB INTEGER 범위 안에서 넉넉히) */
export const SCORE_MAX = 1_000_000;

/** 한글·영문·숫자·공백·_ - . 만 허용 (이모지·HTML 특수문자 불가) */
const NICK_PATTERN = /^[\p{Script=Hangul}A-Za-z0-9 _.\-]+$/u;
/** game_id: UUID v4 (crypto.randomUUID 형식) */
const GAME_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * 사용자가 보는 글자(그래핌) 단위로 자르기
 * @param {string} s
 * @returns {string[]}
 */
export function graphemes(s) {
  const Seg = /** @type {any} */ (Intl).Segmenter;
  if (Seg) return Array.from(new Seg("ko", { granularity: "grapheme" }).segment(s), (x) => /** @type {{segment: string}} */ (x).segment);
  return Array.from(s);
}

/** @param {string} raw */
export function normalizeNickname(raw) {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * @typedef {{ ok: true, value: string } | { ok: false, error: string }} NickResult
 */

/**
 * 이름 검증
 * @param {unknown} raw
 * @returns {NickResult}
 */
export function validateNickname(raw) {
  if (typeof raw !== "string") return { ok: false, error: "닉네임을 입력해 주세요!" };
  const v = normalizeNickname(raw);
  if (!v) return { ok: false, error: "닉네임을 입력해 주세요!" };
  if (graphemes(v).length > NICK_MAX) return { ok: false, error: `닉네임은 ${NICK_MAX}자 이내로 입력해 주세요!` };
  if (!NICK_PATTERN.test(v)) return { ok: false, error: "한글·영문·숫자·공백·_ - . 만 쓸 수 있어요" };
  return { ok: true, value: v };
}

/**
 * 점수 형식 검증 (1 이상 정수)
 * @param {unknown} score
 * @returns {score is number}
 */
export function isValidScore(score) {
  return typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= SCORE_MAX;
}

/**
 * game_id 형식 검증
 * @param {unknown} id
 * @returns {id is string}
 */
export function isValidGameId(id) {
  return typeof id === "string" && GAME_ID_PATTERN.test(id);
}

/**
 * 이 점수를 내는 데 필요한 최소 플레이 시간(ms)
 * @param {number} score
 */
export function minPlayTimeMs(score) {
  return Math.max(MIN_PLAY_MS, ((score - SCORE_SLACK) / MAX_SCORE_PER_SEC) * 1000);
}

/**
 * 플레이 시간 검증
 * @param {number} score
 * @param {number} elapsedMs game_id 발급부터 제출까지 걸린 시간
 * @returns {"ok" | "too_fast" | "expired"}
 */
export function checkPlayTime(score, elapsedMs) {
  if (!(elapsedMs >= 0) || elapsedMs > GAME_MAX_AGE_MS) return "expired";
  if (elapsedMs < minPlayTimeMs(score)) return "too_fast";
  return "ok";
}
