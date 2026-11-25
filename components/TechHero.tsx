"use client";

import CharacterAvatar from "@/components/CharacterAvatar";
import type { CharacterId } from "@/lib/characters";

// 시작 화면 배경 연출: 움직이는 물류 컨베이어, 바코드 스캐너 레이저, 자동 분류 로봇 암 (docs/PRD.md S1)
export default function TechHero({ id, color }: { id: CharacterId; color: string }) {
  return (
    <div className="relative w-full h-[150px] overflow-hidden" aria-hidden>
      <svg viewBox="0 0 320 150" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
        {/* 로봇 암 실루엣 */}
        <g className="hero-arm" style={{ transformOrigin: "40px 118px" }}>
          <rect x="28" y="112" width="24" height="10" rx="3" fill="#1E293B" />
          <rect x="36" y="70" width="8" height="46" rx="4" fill="#334155" />
          <circle cx="40" cy="70" r="6" fill="#475569" />
          <g className="hero-forearm" style={{ transformOrigin: "40px 70px" }}>
            <rect x="40" y="66" width="48" height="8" rx="4" fill="#334155" />
            <circle cx="88" cy="70" r="5" fill="#475569" />
            <path d="M88 74 L84 88 M88 74 L92 88" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
            <circle cx="88" cy="70" r="2" fill="#22D3EE" />
          </g>
        </g>

        {/* 스캐너 게이트 */}
        <rect x="262" y="56" width="6" height="66" fill="#1E293B" />
        <rect x="306" y="56" width="6" height="66" fill="#1E293B" />
        <rect x="262" y="52" width="50" height="8" rx="2" fill="#334155" />
        <circle cx="287" cy="56" r="2" fill="#F43F5E" className="animate-pulse" />
        <g className="hero-laser">
          <rect x="268" y="62" width="38" height="2" fill="#F43F5E" />
          <rect x="268" y="58" width="38" height="10" fill="#F43F5E" opacity=".15" />
        </g>

        {/* 컨베이어 벨트 */}
        <rect x="0" y="122" width="320" height="16" rx="3" fill="#1E293B" stroke="#334155" />
        <line x1="0" y1="130" x2="320" y2="130" stroke="#475569" strokeWidth="6" strokeDasharray="6 8" className="hero-belt" />
        <rect x="0" y="136" width="320" height="3" fill="#06B6D4" opacity=".8" />
        {Array.from({ length: 11 }, (_, i) => (
          <circle key={i} cx={14 + i * 29} cy="145" r="4" fill="#0F172A" stroke="#334155" />
        ))}

        {/* 이송 중인 박스 */}
        {[0, 1, 2].map((i) => (
          <g key={i} className="hero-box" style={{ animationDelay: `${-i * 2.2}s` }}>
            <rect x="0" y="104" width="22" height="18" rx="2" fill="#B45309" />
            <rect x="9" y="104" width="4" height="18" fill="#F59E0B" />
            <rect x="3" y="108" width="5" height="5" fill="#FDE68A" opacity=".8" />
          </g>
        ))}
      </svg>

      {/* 선택 캐릭터: 중앙 AGV 패드 위 */}
      <div className="absolute left-1/2 bottom-[18px] -translate-x-1/2 flex flex-col items-center">
        <CharacterAvatar id={id} size={92} bob />
        <div className="w-24 h-3 -mt-1 rounded-md bg-slate-700 border border-slate-500" style={{ boxShadow: `0 0 14px ${color}` }}>
          <div className="h-[3px] mt-[7px] mx-2 rounded" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
}
