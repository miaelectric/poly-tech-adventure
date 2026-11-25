"use client";

import { useCallback, useEffect, useState } from "react";
import CharacterAvatar from "@/components/CharacterAvatar";
import { DEFAULT_CHARACTER, getCharacter, isCharacterId } from "@/lib/characters";

export interface ScoreRow {
  id: number;
  player_name: string;
  score: number;
  character_id: string;
  created_at: string;
}

export const API_TIMEOUT_MS = 5000;

interface Props {
  /** 방금 저장한 내 기록의 id (강조 표시용) */
  myId: number | null;
}

type Load = "loading" | "ok" | "error" | "unavailable";

/** 명예의 전당 TOP 20 (Neon DB poly_tech_scores) */
export default function Leaderboard({ myId }: Props) {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [state, setState] = useState<Load>("loading");

  const load = useCallback(() => {
    setState("loading");
    fetch("/api/scores", { signal: AbortSignal.timeout(API_TIMEOUT_MS), cache: "no-store" })
      .then(async (r) => {
        if (r.status === 503) { setState("unavailable"); return; }
        if (!r.ok) throw new Error(String(r.status));
        setScores(await r.json());
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col w-full flex-1 min-h-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-lg text-slate-100">🏆 명예의 전당</h2>
        <span className="font-orbitron text-[10px] tracking-widest text-cyan-300 border border-cyan-400/50 px-2 py-0.5 rounded-full">TOP 20</span>
      </div>

      <div className="flex-1 min-h-[180px] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/70 p-2">
        {state === "loading" ? (
          <p className="text-center text-cyan-300/80 mt-8">랭킹 데이터 수신 중...</p>
        ) : state === "unavailable" ? (
          <p className="text-center text-slate-400 mt-8">랭킹 서버가 아직 준비되지 않았어요.</p>
        ) : state === "error" ? (
          <div className="text-center mt-8 flex flex-col items-center gap-2">
            <p className="text-rose-400">랭킹을 불러오지 못했어요.</p>
            <button onClick={load} className="px-4 py-1.5 rounded-xl border border-cyan-400/60 text-cyan-200 text-sm hover:bg-cyan-500/10 active:scale-95 transition">
              다시 불러오기
            </button>
          </div>
        ) : scores.length === 0 ? (
          <p className="text-center text-slate-500 mt-8">아직 기록이 없어요. 첫 번째 기록의 주인공이 되어 보세요!</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {scores.map((s, i) => {
              const isMe = myId !== null && s.id === myId;
              const spec = getCharacter(isCharacterId(s.character_id) ? s.character_id : DEFAULT_CHARACTER);
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                    isMe ? "bg-cyan-500/15 ring-1 ring-cyan-400" : i % 2 === 0 ? "bg-slate-800/50" : ""
                  }`}
                >
                  <span className="w-7 text-center font-orbitron text-sm text-slate-400">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span className="w-8 h-9 rounded-lg bg-slate-950 border flex items-end justify-center overflow-hidden" style={{ borderColor: spec.themeColor }}>
                    <CharacterAvatar id={spec.id} size={34} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-slate-100">{s.player_name}</span>
                    <span className="inline-block text-[10px] leading-4 px-1.5 rounded-md" style={{ color: spec.themeColor, background: `${spec.themeColor}22` }}>
                      {spec.name}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-orbitron text-cyan-200">{s.score}</span>
                    <span className="block text-[9px] font-orbitron text-slate-500">SECTOR</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
