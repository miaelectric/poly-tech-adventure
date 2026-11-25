// 클라이언트·서버 공용 검증 규칙

export const NICK_MAX = 10;

/** 한글·영문·숫자·공백·_ - . 만 허용 (이모지·HTML 특수문자 불가) */
const NICK_PATTERN = /^[\p{Script=Hangul}A-Za-z0-9 _.\-]+$/u;

/**
 * 점수 타당성: 일반 이동 약 5칸/초 + 데이터 칩 보너스, 안영휘 피버(3초 자동 질주)까지 고려해
 * 초당 8섹터 + 여유 30을 상한으로 둔다.
 */
export const MAX_SCORE_PER_SEC = 8;
export const SCORE_SLACK = 30;
/** 게임 세션 토큰 유효 시간 */
export const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

/** 사용자가 보는 글자(그래핌) 단위로 자르기 */
export function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) return Array.from(new Seg("ko", { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type NickResult = { ok: true; value: string } | { ok: false; error: string };

export function validateNickname(raw: unknown): NickResult {
  if (typeof raw !== "string") return { ok: false, error: "닉네임을 입력해 주세요!" };
  const v = normalizeNickname(raw);
  if (!v) return { ok: false, error: "닉네임을 입력해 주세요!" };
  if (graphemes(v).length > NICK_MAX) return { ok: false, error: `닉네임은 ${NICK_MAX}자 이내로 입력해 주세요!` };
  if (!NICK_PATTERN.test(v)) return { ok: false, error: "한글·영문·숫자·공백·_ - . 만 쓸 수 있어요" };
  return { ok: true, value: v };
}

export function maxPlausibleScore(elapsedMs: number): number {
  return Math.floor((Math.max(0, elapsedMs) / 1000) * MAX_SCORE_PER_SEC) + SCORE_SLACK;
}
