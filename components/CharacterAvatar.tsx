"use client";

import { AVATAR_SVG, AVATAR_VIEW_H, AVATAR_VIEW_W } from "@/lib/avatars";
import type { CharacterId } from "@/lib/characters";

interface Props {
  id: CharacterId;
  /** 표시 높이(px). 너비는 SVG 비율(64:80)에 맞춰 계산 */
  size?: number;
  /** 위아래로 살짝 떠 있는 모션 */
  bob?: boolean;
  /** 잠긴 캐릭터: 실루엣 처리 */
  locked?: boolean;
  className?: string;
}

/** 6종 캐릭터 SVG 아바타 (components/CharacterAvatar.tsx, docs/TRD.md §4) */
export default function CharacterAvatar({ id, size = 48, bob = false, locked = false, className = "" }: Props) {
  const w = Math.round((size * AVATAR_VIEW_W) / AVATAR_VIEW_H);
  return (
    <span
      className={`inline-block shrink-0 [&>svg]:w-full [&>svg]:h-full ${bob ? "animate-bob" : ""} ${
        locked ? "brightness-0 opacity-40" : ""
      } ${className}`}
      style={{ width: w, height: size }}
      // AVATAR_SVG는 이 저장소 안의 고정 문자열(사용자 입력 없음)
      dangerouslySetInnerHTML={{ __html: AVATAR_SVG[id] }}
    />
  );
}
