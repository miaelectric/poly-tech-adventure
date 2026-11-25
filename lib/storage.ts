// localStorage 안전 래퍼: 사용할 수 없으면(사생활 보호 모드 등) 이번 세션 동안 메모리에 보관

export const KEYS = {
  /** 최고 도달 섹터 (docs/TRD.md §3.2) */
  best: "poly_tech_best_score",
  nickname: "poly_tech_nickname",
  character: "poly_tech_character",
  /** 개발 모드 전체 해금 토글 */
  devUnlockAll: "poly_tech_dev_unlock_all",
} as const;

const fallback = new Map<string, string>();

export function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return fallback.get(key) ?? null;
  }
}

export function setItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    fallback.set(key, value);
  }
}

export function getInt(key: string): number {
  const n = parseInt(getItem(key) ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
