// 서버 상태 없이 검증 가능한 게임 세션 토큰: "<시작시각ms>.<HMAC 서명>"
// 서버리스 인스턴스끼리 메모리를 공유하지 않아도 동작한다. (docs/TRD.md §6)
import { createHmac, timingSafeEqual } from "crypto";

function key(): string {
  return process.env.SCORE_SECRET || process.env.DATABASE_URL || "dev-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function issueToken(now = Date.now()): string {
  const payload = String(now);
  return `${payload}.${sign(payload)}`;
}

/** 서명이 맞으면 게임 시작 시각(ms), 아니면 null */
export function verifyToken(token: unknown): number | null {
  if (typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const startedAt = Number(payload);
  return Number.isFinite(startedAt) ? startedAt : null;
}
