// 캐릭터 6종 정의 (docs/PRD.md §3, docs/TRD.md §3) — 클라이언트·서버 공용

export type CharacterId =
  | "e_human" // E조인간 (기본)
  | "lim_junga" // 임정아 (20)
  | "park_jy" // 박정용 (40)
  | "gil_wj" // 길완제 (60)
  | "ahn_yh" // 안영휘 (80)
  | "koo_bm"; // 구병모 (100)

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  role: "robot" | "female_prof" | "male_prof";
  /** 이 섹터 이상을 달성하면 해금 */
  unlockScore: number;
  /** 외형 컨셉 한 줄 */
  concept: string;
  skillName: string;
  skillType: "PASSIVE" | "ACTIVE";
  skillDescription: string;
  themeColor: string;
}

export const CHARACTERS: CharacterSpec[] = [
  {
    id: "e_human", name: "E조인간", role: "robot", unlockScore: 0,
    concept: "LED 바이저를 장착한 미래형 테크 로봇",
    skillName: "프로토콜 안정화", skillType: "PASSIVE",
    skillDescription: "에너지 감소 속도가 10% 느려져요.",
    themeColor: "#06B6D4",
  },
  {
    id: "lim_junga", name: "임정아", role: "female_prof", unlockScore: 20,
    concept: "스마트 글래스를 쓴 지적인 연구 교수",
    skillName: "데이터 최적화", skillType: "PASSIVE",
    skillDescription: "데이터 칩 획득 시 +2 섹터를 추가로 얻어요.",
    themeColor: "#A855F7",
  },
  {
    id: "park_jy", name: "박정용", role: "male_prof", unlockScore: 40,
    concept: "태블릿 PC를 든 카리스마 교수",
    skillName: "경로 예측 알고리즘", skillType: "PASSIVE",
    skillDescription: "다음 5개 발판의 경로를 네온 가이드로 미리 보여줘요.",
    themeColor: "#3B82F6",
  },
  {
    id: "gil_wj", name: "길완제", role: "male_prof", unlockScore: 60,
    concept: "안경을 쓴 온화하고 신뢰감 있는 교수",
    skillName: "긴급 백업 시스템", skillType: "ACTIVE",
    skillDescription: "방향 실수 1회를 실드로 막고 올바른 길로 자동 복구해요.",
    themeColor: "#10B981",
  },
  {
    id: "ahn_yh", name: "안영휘", role: "male_prof", unlockScore: 80,
    concept: "스마트 워치를 찬 열정적인 테크 교수",
    skillName: "하이퍼 부스트", skillType: "ACTIVE",
    skillDescription: "15연속 빠른 입력 시 3초간 무적 자동 질주(피버)!",
    themeColor: "#F97316",
  },
  {
    id: "koo_bm", name: "구병모", role: "male_prof", unlockScore: 100,
    concept: "골드 테크 배지를 단 위엄 있는 교수",
    skillName: "마스터 오버클럭", skillType: "PASSIVE",
    skillDescription: "에너지 회복량 +30%, 보안 퀴즈 오답 패널티 면제.",
    themeColor: "#F59E0B",
  },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id) as readonly CharacterId[];
export const DEFAULT_CHARACTER: CharacterId = "e_human";

export function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === "string" && (CHARACTER_IDS as readonly string[]).includes(v);
}

export function getCharacter(id: CharacterId): CharacterSpec {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function isUnlocked(spec: CharacterSpec, bestScore: number, devUnlockAll = false): boolean {
  return devUnlockAll || bestScore >= spec.unlockScore;
}

/** 스킬 수치 (docs/TRD.md §3.3) */
export const SKILL = {
  /** E조인간: 에너지 감소량 가중치 */
  E_HUMAN_DECAY_MUL: 0.9,
  /** 데이터 칩 등장 확률 / 임정아 보너스 섹터 */
  CHIP_CHANCE: 0.15,
  LIM_CHIP_BONUS: 2,
  /** 박정용: 미리 보여 줄 발판 수 */
  PARK_GUIDE_COUNT: 5,
  /** 안영휘: 콤보 조건과 피버 지속 시간 */
  AHN_COMBO_WINDOW_MS: 400,
  AHN_FEVER_COMBO: 15,
  AHN_FEVER_MS: 3000,
  /** 구병모: 회복량 가중치 */
  KOO_HEAL_MUL: 1.3,
} as const;
