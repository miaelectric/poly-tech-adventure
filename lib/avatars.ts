// 6종 캐릭터 2D SVG 아바타 (viewBox 0 0 64 80, 발끝 y≈78)
// 같은 SVG 문자열을 DOM(CharacterAvatar)과 Canvas(인게임, data URL 이미지)에서 함께 사용한다.
// 여러 개가 한 문서에 인라인되므로 gradient/filter id를 쓰지 않고 단색 + 반투명 레이어로 표현한다.

import type { CharacterId } from "@/lib/characters";

export const AVATAR_VIEW_W = 64;
export const AVATAR_VIEW_H = 80;

const LINE = "#0F172A";
const SKIN = "#FFDCC0";
const SW = 'stroke="#0F172A" stroke-width="1.4" stroke-linejoin="round"';

// ---------- 공용 파츠 ----------
const legs = (pants: string, shoes: string) => `
  <rect x="24" y="61" width="7" height="13" rx="3" fill="${pants}" ${SW}/>
  <rect x="33" y="61" width="7" height="13" rx="3" fill="${pants}" ${SW}/>
  <ellipse cx="26.5" cy="75.5" rx="5.2" ry="2.8" fill="${shoes}" ${SW}/>
  <ellipse cx="37.5" cy="75.5" rx="5.2" ry="2.8" fill="${shoes}" ${SW}/>`;

const torso = (color: string) =>
  `<path d="M20 48 Q20 43 25 43 L39 43 Q44 43 44 48 L45 64 L19 64 Z" fill="${color}" ${SW}/>`;

const arm = (side: "L" | "R", sleeve: string, rot = 0, hand = SKIN) => {
  const x = side === "L" ? 14.5 : 42.5;
  const pivotX = side === "L" ? 19 : 45;
  const r = side === "L" ? 10 + rot : -10 - rot;
  return `<g transform="rotate(${r} ${pivotX} 46)">
    <rect x="${x}" y="45" width="7" height="15" rx="3.5" fill="${sleeve}" ${SW}/>
    <circle cx="${x + 3.5}" cy="61.5" r="3.2" fill="${hand}" ${SW}/>
  </g>`;
};

const head = () => `
  <ellipse cx="16.5" cy="29" rx="2.6" ry="3.4" fill="${SKIN}" ${SW}/>
  <ellipse cx="47.5" cy="29" rx="2.6" ry="3.4" fill="${SKIN}" ${SW}/>
  <circle cx="32" cy="27" r="15.5" fill="${SKIN}" ${SW}/>`;

const blush = `<ellipse cx="22.5" cy="34" rx="2.6" ry="1.5" fill="#FB7185" opacity=".45"/>
  <ellipse cx="41.5" cy="34" rx="2.6" ry="1.5" fill="#FB7185" opacity=".45"/>`;

const dotEyes = `<ellipse cx="26.5" cy="29.5" rx="1.9" ry="2.4" fill="${LINE}"/>
  <ellipse cx="37.5" cy="29.5" rx="1.9" ry="2.4" fill="${LINE}"/>
  <circle cx="27.2" cy="28.6" r=".7" fill="#fff"/><circle cx="38.2" cy="28.6" r=".7" fill="#fff"/>`;

const smileEyes = `<path d="M24 30 Q26.5 27.2 29 30" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M35 30 Q37.5 27.2 40 30" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/>`;

const smile = `<path d="M29 35.5 Q32 38 35 35.5" fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round"/>`;

const svg = (body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_VIEW_W} ${AVATAR_VIEW_H}" role="img" aria-label="${label}">${body}</svg>`;

// ---------- E조인간: LED 바이저 테크 로봇 ----------
const eHuman = svg(`
  <rect x="25" y="61" width="6" height="13" rx="2" fill="#94A3B8" ${SW}/>
  <rect x="33" y="61" width="6" height="13" rx="2" fill="#94A3B8" ${SW}/>
  <rect x="21" y="72" width="11" height="6" rx="2.5" fill="#334155" ${SW}/>
  <rect x="32" y="72" width="11" height="6" rx="2.5" fill="#334155" ${SW}/>
  ${arm("L", "#CBD5E1", 4, "#64748B")}
  ${arm("R", "#CBD5E1", 4, "#64748B")}
  <rect x="20" y="43" width="24" height="21" rx="6" fill="#E2E8F0" ${SW}/>
  <rect x="20" y="57" width="24" height="7" rx="3" fill="#94A3B8" opacity=".6"/>
  <circle cx="32" cy="51.5" r="5.2" fill="#0B1120" stroke="#06B6D4" stroke-width="1.6"/>
  <text x="32" y="54.4" font-family="Arial,sans-serif" font-weight="900" font-size="8" text-anchor="middle" fill="#22D3EE">E</text>
  <line x1="32" y1="11" x2="32" y2="4" stroke="${LINE}" stroke-width="1.6"/>
  <circle cx="32" cy="4" r="2.8" fill="#22D3EE" ${SW}/>
  <circle cx="32" cy="4" r="5" fill="#22D3EE" opacity=".25"/>
  <rect x="11" y="23" width="6" height="11" rx="2.5" fill="#64748B" ${SW}/>
  <rect x="47" y="23" width="6" height="11" rx="2.5" fill="#64748B" ${SW}/>
  <rect x="15" y="11" width="34" height="31" rx="10" fill="#E2E8F0" ${SW}/>
  <path d="M19 15 Q24 12.5 34 13" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>
  <rect x="17.5" y="21" width="29" height="12" rx="6" fill="#0B1120" stroke="#06B6D4" stroke-width="1.6"/>
  <rect x="16.5" y="20" width="31" height="14" rx="7" fill="none" stroke="#22D3EE" stroke-width="2.5" opacity=".25"/>
  <rect x="22.5" y="24.5" width="6" height="5" rx="2" fill="#22D3EE">
    <animate attributeName="height" values="5;5;0.8;5" keyTimes="0;0.9;0.95;1" dur="3.4s" repeatCount="indefinite"/>
  </rect>
  <rect x="35.5" y="24.5" width="6" height="5" rx="2" fill="#22D3EE">
    <animate attributeName="height" values="5;5;0.8;5" keyTimes="0;0.9;0.95;1" dur="3.4s" repeatCount="indefinite"/>
  </rect>
  <path d="M27 37.5 H37" stroke="#64748B" stroke-width="1.6" stroke-linecap="round"/>
`, "E조인간");

// ---------- 임정아: 스마트 글래스 + 연구원 가운 ----------
const limJunga = svg(`
  <path d="M15.5 25 Q14 8.5 32 8.5 Q50 8.5 48.5 25 L50 46 Q45 49 41 44 L23 44 Q19 49 14 46 Z" fill="#2B1B17" ${SW}/>
  ${legs("#4C1D95", "#1F2937")}
  ${arm("L", "#F8FAFC", 2)}
  ${arm("R", "#F8FAFC", 2)}
  ${torso("#F8FAFC")}
  <path d="M27 43 L32 53 L37 43 Z" fill="#A855F7" ${SW}/>
  <path d="M25 43 L30 56 M39 43 L34 56" stroke="#CBD5E1" stroke-width="1.2"/>
  <rect x="37" y="53" width="5" height="6.5" rx="1" fill="#A855F7" ${SW}/>
  <rect x="38" y="54.5" width="3" height="1.2" fill="#fff"/>
  ${head()}
  <path d="M16.5 25 Q17.5 10 32 10.5 Q46.5 10 47.5 25 Q42 16.5 34 17.5 Q30 22 22 21 Q19 22.5 16.5 25 Z" fill="#2B1B17" ${SW}/>
  <circle cx="16.5" cy="35" r="1.4" fill="#E9D5FF" ${SW}/>
  <circle cx="47.5" cy="35" r="1.4" fill="#E9D5FF" ${SW}/>
  ${dotEyes}
  <rect x="21" y="25.5" width="10" height="8" rx="3" fill="#C4B5FD" fill-opacity=".28" stroke="#6D28D9" stroke-width="1.4"/>
  <rect x="33" y="25.5" width="10" height="8" rx="3" fill="#C4B5FD" fill-opacity=".28" stroke="#6D28D9" stroke-width="1.4"/>
  <path d="M31 28 H33" stroke="#6D28D9" stroke-width="1.4"/>
  <rect x="38.5" y="26.8" width="3" height="1.6" rx=".6" fill="#22D3EE"/>
  <path d="M21 28 L17 27 M43 28 L47 27" stroke="#6D28D9" stroke-width="1.2"/>
  ${blush}
  <path d="M29 36 Q32 38.4 35 36" fill="none" stroke="#BE185D" stroke-width="1.5" stroke-linecap="round"/>
`, "임정아");

// ---------- 박정용: 세미 정장 + 태블릿 PC ----------
const parkJy = svg(`
  ${legs("#1E293B", "#0F172A")}
  ${arm("L", "#1E3A8A", 0)}
  ${torso("#1E3A8A")}
  <path d="M27 43 L32 52 L37 43 Z" fill="#DBEAFE" ${SW}/>
  <path d="M25 43 L31 56 M39 43 L33 56" stroke="#172554" stroke-width="1.4"/>
  <g transform="rotate(-10 45 46)">
    <rect x="42.5" y="45" width="7" height="15" rx="3.5" fill="#1E3A8A" ${SW}/>
  </g>
  <g transform="rotate(-8 50 55)">
    <rect x="44" y="46" width="13" height="17" rx="2" fill="#0F172A" ${SW}/>
    <rect x="45.5" y="47.5" width="10" height="14" rx="1" fill="#3B82F6"/>
    <rect x="47" y="50" width="7" height="1.5" fill="#BFDBFE"/>
    <rect x="47" y="53" width="4.5" height="1.5" fill="#BFDBFE"/>
    <path d="M47 59.5 L49 57 L51 58.5 L54 55" stroke="#22D3EE" stroke-width="1.1" fill="none"/>
  </g>
  <circle cx="48.5" cy="60.5" r="3.2" fill="${SKIN}" ${SW}/>
  ${head()}
  <path d="M16.5 26 Q14.5 9 32 9 Q49 9 47.5 25 Q46 17 39 16 Q30 14.5 24.5 19.5 Q20 21 16.5 26 Z" fill="#111827" ${SW}/>
  <path d="M25 13 Q33 10.5 42 14" stroke="#475569" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M23.5 25 L29 24.2 M35 24.2 L40.5 25" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>
  ${dotEyes}
  ${blush}
  <path d="M29 36 Q32.5 37.8 35.5 35.3" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-linecap="round"/>
`, "박정용");

// ---------- 길완제: 둥근 안경 + 셔츠/자켓 ----------
const gilWj = svg(`
  ${legs("#334155", "#1F2937")}
  ${arm("L", "#475569", 0)}
  ${arm("R", "#475569", 0)}
  ${torso("#475569")}
  <path d="M26 43 L32 54 L38 43 Z" fill="#F8FAFC" ${SW}/>
  <path d="M24.5 43 L30.5 58 M39.5 43 L33.5 58" stroke="#1E293B" stroke-width="1.4"/>
  <path d="M37.5 51 h4 v2.5 h-4 z" fill="#10B981"/>
  ${head()}
  <path d="M16.5 26 Q15.5 10 32 10 Q48.5 10 47.5 26 Q46.5 18 41 16.5 L27 16.5 Q20 18 16.5 26 Z" fill="#3F2E25" ${SW}/>
  <path d="M27 16.5 Q24 19 22 23" stroke="#3F2E25" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M27 11 L27 16.5" stroke="#1C1410" stroke-width="1" opacity=".6"/>
  <path d="M38 13 Q42 13.5 44 16" stroke="#94A3B8" stroke-width="1.3" fill="none" opacity=".8"/>
  ${smileEyes}
  <circle cx="26.5" cy="29.5" r="4.8" fill="#E0F2FE" fill-opacity=".25" stroke="#334155" stroke-width="1.5"/>
  <circle cx="37.5" cy="29.5" r="4.8" fill="#E0F2FE" fill-opacity=".25" stroke="#334155" stroke-width="1.5"/>
  <path d="M31.3 29 H32.7 M21.7 29 L17.5 28 M42.3 29 L46.5 28" stroke="#334155" stroke-width="1.3"/>
  ${blush}
  ${smile}
`, "길완제");

// ---------- 안영휘: 테크 재킷 + 스마트 워치, 주먹 번쩍 ----------
const ahnYh = svg(`
  ${legs("#111827", "#F97316")}
  ${arm("L", "#F97316", 2)}
  <g transform="rotate(-150 45 46)">
    <rect x="42.5" y="45" width="7" height="15" rx="3.5" fill="#F97316" ${SW}/>
    <rect x="42" y="54.5" width="8" height="4.5" rx="1.2" fill="#0F172A" ${SW}/>
    <rect x="43.5" y="55.5" width="5" height="2.5" rx=".6" fill="#4ADE80"/>
    <circle cx="46" cy="61.5" r="3.6" fill="${SKIN}" ${SW}/>
  </g>
  ${torso("#F97316")}
  <path d="M31 43 V64" stroke="#111827" stroke-width="2"/>
  <path d="M20.5 52 H29 M35 52 H43.5" stroke="#111827" stroke-width="2.2"/>
  <path d="M20.5 52 H29 M35 52 H43.5" stroke="#22D3EE" stroke-width=".9"/>
  <path d="M25 43 L32 47 L39 43" fill="#111827" ${SW}/>
  ${head()}
  <path d="M16.5 25 L13.5 14 L20.5 17 L20 7 L27 12.5 L31 4 L35.5 12 L42 6 L42.5 14.5 L50 12 L47.5 25 Q42 17 32 17.5 Q23 17 16.5 25 Z" fill="#111827" ${SW}/>
  <path d="M31 6.5 L33.5 12 M42 8.5 L41.6 13.5" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M23.5 24.5 L29 25.5 M35 25.5 L40.5 24.5" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/>
  ${dotEyes}
  ${blush}
  <path d="M27.5 34.5 Q32 41 36.5 34.5 Z" fill="#9F1239" ${SW}/>
  <path d="M29 35.2 H35" stroke="#fff" stroke-width="1.2"/>
`, "안영휘");

// ---------- 구병모: 수트 + 골드 테크 배지 ----------
const kooBm = svg(`
  ${legs("#111827", "#0B0F19")}
  ${arm("L", "#1F2937", 0)}
  ${arm("R", "#1F2937", 0)}
  ${torso("#1F2937")}
  <path d="M27 43 L32 53 L37 43 Z" fill="#F8FAFC" ${SW}/>
  <path d="M30.6 45 L33.4 45 L34.3 55 L32 58 L29.7 55 Z" fill="#F59E0B" ${SW}/>
  <path d="M24.5 43 L30.5 59 M39.5 43 L33.5 59" stroke="#0B0F19" stroke-width="1.4"/>
  <circle cx="39.5" cy="51" r="4.8" fill="#FBBF24" opacity=".3"/>
  <path d="M39.5 47.5 L42.5 49.2 L42.5 52.8 L39.5 54.5 L36.5 52.8 L36.5 49.2 Z" fill="#F59E0B" stroke="#78350F" stroke-width="1"/>
  <circle cx="39.5" cy="51" r="1.2" fill="#FEF3C7"/>
  ${head()}
  <path d="M16.5 26 Q15 10.5 32 10 Q49 10.5 47.5 26 Q46 18.5 41 16 Q32 13 23 16 Q18.5 18.5 16.5 26 Z" fill="#CBD5E1" ${SW}/>
  <path d="M22 16.5 Q32 12 42 16.5" stroke="#94A3B8" stroke-width="1.4" fill="none"/>
  <path d="M23 25 L29.5 24 M34.5 24 L41 25" stroke="#64748B" stroke-width="2.6" stroke-linecap="round"/>
  ${dotEyes}
  <path d="M26 34.2 Q29 32.5 32 34 Q35 32.5 38 34.2 Q35 36 32 35 Q29 36 26 34.2 Z" fill="#94A3B8" ${SW}/>
  <path d="M30 38 Q32 39 34 38" fill="none" stroke="${LINE}" stroke-width="1.3" stroke-linecap="round"/>
`, "구병모");

export const AVATAR_SVG: Record<CharacterId, string> = {
  e_human: eHuman,
  lim_junga: limJunga,
  park_jy: parkJy,
  gil_wj: gilWj,
  ahn_yh: ahnYh,
  koo_bm: kooBm,
};

export function avatarDataUrl(id: CharacterId): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AVATAR_SVG[id])}`;
}
