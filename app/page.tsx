"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Leaderboard, { API_TIMEOUT_MS, type ScoreRow } from "@/components/Leaderboard";
import CharacterAvatar from "@/components/CharacterAvatar";
import TechHero from "@/components/TechHero";
import {
  CHARACTERS, DEFAULT_CHARACTER, getCharacter, isCharacterId, isUnlocked, type CharacterId,
} from "@/lib/characters";
import { isMuted, setMuted, sfx } from "@/lib/sound";
import { KEYS, getInt, getItem, setItem } from "@/lib/storage";
import { NICK_MAX, graphemes, isValidScore, validateNickname } from "@/lib/game_rules";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), { ssr: false });

type Screen = "start" | "game" | "gameover";
type SaveState = "idle" | "saving" | "saved" | "failed" | "skipped" | "unavailable" | "rejected";

const VERSION = "v2.0.0";
const IS_DEV = process.env.NODE_ENV !== "production";
const RANDOM_NAMES = ["폴리봇", "AGV-01", "물류왕", "스캐너", "로봇팔", "칩셋", "오토봇", "센서왕", "바코드", "테크러너"];

/** 타임아웃 + 재시도 1회 (네트워크 오류·5xx만 재시도) */
async function postScore(body: object): Promise<Response> {
  const send = () =>
    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  try {
    const r = await send();
    if (r.status < 500 || r.status === 503) return r;
  } catch { /* 재시도 */ }
  return send();
}

/** 게임 시작: 서버가 발급한 game_id (플레이 시간 검증·중복 등록 방지용) */
function requestGame(): Promise<string | null> {
  return fetch("/api/games", { method: "POST", signal: AbortSignal.timeout(API_TIMEOUT_MS), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { game_id?: string } | null) => j?.game_id ?? null)
    .catch(() => null);
}

/** 테크 패널 프레임 */
function Shell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="w-screen h-[100dvh] overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4">
      <div
        className={`relative w-full max-w-[430px] min-h-full sm:min-h-[800px] bg-slate-950/85 backdrop-blur-md rounded-[28px] border border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col ${className}`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        {children}
      </div>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("start");
  const [gameKey, setGameKey] = useState(0);
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<CharacterId>(DEFAULT_CHARACTER);
  const [best, setBest] = useState(0);
  const [devAll, setDevAll] = useState(false);
  const [topScore, setTopScore] = useState<number | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [prevBest, setPrevBest] = useState(0);
  const [newUnlocks, setNewUnlocks] = useState<CharacterId[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [myId, setMyId] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState("");
  const [jiggle, setJiggle] = useState<CharacterId | null>(null);
  const [inputFlash, setInputFlash] = useState(false);
  const gameIdRef = useRef<Promise<string | null>>(Promise.resolve(null));
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const spec = getCharacter(selected);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const refreshTop = useCallback(() => {
    fetch("/api/scores", { signal: AbortSignal.timeout(API_TIMEOUT_MS), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: ScoreRow[]) => setTopScore(rows[0]?.score ?? 0))
      .catch(() => setTopScore(null));
  }, []);

  useEffect(() => {
    const b = getInt(KEYS.best);
    const dev = IS_DEV && getItem(KEYS.devUnlockAll) === "1";
    setBest(b);
    setDevAll(dev);
    setMutedState(isMuted());
    const nick = getItem(KEYS.nickname);
    if (nick) setNickname(nick);
    const ch = getItem(KEYS.character);
    if (isCharacterId(ch) && isUnlocked(getCharacter(ch), b, dev)) setSelected(ch);
    refreshTop();
  }, [refreshTop]);

  const startGame = () => {
    gameIdRef.current = requestGame(); // 게임마다 새 game_id
    setPrevBest(getInt(KEYS.best));
    setNewUnlocks([]);
    setGameKey((k) => k + 1);
    setScreen("game");
  };

  const handleStart = () => {
    const r = validateNickname(nickname);
    if (!r.ok) {
      showToast(`✏️ ${r.error}`);
      setInputFlash(true);
      setTimeout(() => setInputFlash(false), 400);
      return;
    }
    setNickname(r.value);
    setItem(KEYS.nickname, r.value);
    setItem(KEYS.character, selected);
    sfx.click();
    startGame();
  };

  const handleSelect = (id: CharacterId) => {
    const c = getCharacter(id);
    if (!isUnlocked(c, best, devAll)) {
      showToast(`🔒 ${c.unlockScore} SECTOR를 돌파하면 해금돼요!`);
      setJiggle(id);
      setTimeout(() => setJiggle(null), 300);
      return;
    }
    setSelected(id);
    setItem(KEYS.character, id);
    sfx.click();
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.click();
    showToast(next ? "효과음 OFF 🔇" : "효과음 ON 🔊");
  };

  const toggleDevAll = () => {
    const next = !devAll;
    setDevAll(next);
    setItem(KEYS.devUnlockAll, next ? "1" : "0");
    if (!next && !isUnlocked(getCharacter(selected), best)) setSelected(DEFAULT_CHARACTER);
    showToast(next ? "개발 모드: 전체 캐릭터 해금" : "개발 모드 해금 해제");
  };

  const saveScore = useCallback(async (score: number) => {
    setSaveState("saving");
    setSaveMsg("");
    const gameId = await gameIdRef.current;
    if (!gameId) {
      // game_id 발급 실패(서버 미설정·네트워크) → 같은 game_id로 재시도할 수 없으므로 저장 불가 안내
      setSaveState("unavailable");
      return;
    }
    try {
      const r = await postScore({ game_id: gameId, player_name: nickname, character_id: selected, score });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) {
        setMyId(j.id ?? null);
        setMyRank(j.rank ?? null);
        setSaveState("saved");
      } else if (r.status === 503) {
        setSaveState("unavailable");
      } else if (r.status >= 400 && r.status < 500) {
        setSaveMsg(j.message ?? "기록을 저장할 수 없어요.");
        setSaveState("rejected");
      } else {
        setSaveState("failed");
      }
    } catch (e) {
      console.error("Score save failed", e);
      setSaveState("failed");
    }
  }, [nickname, selected]);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setMyId(null);
    setMyRank(null);
    setBest(getInt(KEYS.best));
    setScreen("gameover");
    if (!isValidScore(score)) { setSaveState("skipped"); return; }
    void saveScore(score);
  }, [saveScore]);

  const handleUnlock = useCallback((id: CharacterId) => {
    setNewUnlocks((u) => (u.includes(id) ? u : [...u, id]));
    setBest(getInt(KEYS.best));
  }, []);

  const handleRetry = () => { sfx.click(); refreshTop(); startGame(); };
  const handleCharSelect = () => { sfx.click(); refreshTop(); setScreen("start"); };

  // ---------- S2. 인게임 ----------
  if (screen === "game") {
    return (
      <main className="flex items-center justify-center w-screen h-[100dvh]">
        <div className="relative w-full h-full overflow-hidden sm:rounded-[28px] sm:border sm:border-cyan-500/40 sm:my-4 sm:h-[calc(100dvh-2rem)]" style={{ maxWidth: 430 }}>
          <GameCanvas key={gameKey} character={selected} onGameOver={handleGameOver} onUnlock={handleUnlock} />
        </div>
      </main>
    );
  }

  // ---------- S4. 결과 및 랭킹 ----------
  if (screen === "gameover") {
    const isNewBest = finalScore > prevBest;
    return (
      <Shell className="p-4 sm:p-5">
        <div className="relative z-10 text-center flex flex-col items-center animate-pop-in">
          <p className="font-orbitron text-[11px] tracking-[0.3em] text-rose-400">SYSTEM HALTED</p>
          <h1 className="text-3xl text-rose-100 leading-tight" style={{ textShadow: "0 0 14px rgba(244,63,94,0.7)" }}>
            GAME OVER
          </h1>
          <div className="mt-3 w-full grid grid-cols-3 rounded-2xl border border-slate-700 bg-slate-900/70 py-3">
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-400">이번 기록</span>
              <span className="font-orbitron text-2xl text-cyan-200">{finalScore}</span>
              <span className="font-orbitron text-[9px] text-slate-500">SECTOR</span>
            </div>
            <div className="flex flex-col items-center border-x border-slate-700">
              <span className="text-[11px] text-slate-400">최고 기록</span>
              <span className="font-orbitron text-2xl text-amber-300">{best}</span>
              <span className="font-orbitron text-[9px] text-slate-500">{isNewBest ? "NEW BEST!" : "SECTOR"}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-400">현재 순위</span>
              <span className="font-orbitron text-2xl text-slate-100">{myRank ?? "-"}</span>
              <span className="font-orbitron text-[9px] text-slate-500">RANK</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <CharacterAvatar id={selected} size={28} />
            <span>{nickname} · <span style={{ color: spec.themeColor }}>{spec.name}</span></span>
          </div>
          {newUnlocks.length > 0 && (
            <div className="mt-2 w-full rounded-xl border border-amber-400/60 bg-amber-500/10 px-3 py-2 flex items-center gap-2 justify-center">
              {newUnlocks.map((id) => <CharacterAvatar key={id} id={id} size={34} bob />)}
              <span className="text-sm text-amber-200">
                NEW UNLOCK · {newUnlocks.map((id) => getCharacter(id).name).join(", ")}
              </span>
            </div>
          )}
          {saveState === "skipped" && <p className="mt-2 text-xs text-slate-400">0 SECTOR는 랭킹에 기록되지 않아요</p>}
          {saveState === "unavailable" && <p className="mt-2 text-xs text-amber-300">랭킹 서버가 준비되지 않아 기록을 저장하지 못했어요</p>}
          {saveState === "rejected" && <p className="mt-2 text-xs text-rose-400">{saveMsg}</p>}
          {saveState === "failed" && (
            <div className="mt-2 flex items-center gap-2 text-xs text-rose-300">
              기록 저장에 실패했어요
              <button onClick={() => void saveScore(finalScore)} className="px-2.5 py-0.5 rounded-full border border-rose-400/60 hover:bg-rose-500/10 active:scale-95 transition">
                다시 시도
              </button>
            </div>
          )}
          {myRank !== null && myRank > 20 && <p className="mt-2 text-xs text-slate-400">아쉽게 TOP 20 밖이에요. 다시 도전!</p>}
        </div>

        <div className="flex-1 min-h-0 mt-3 flex flex-col">
          {saveState === "saving" ? (
            <p className="text-center text-cyan-300 mt-8">기록 전송 중...</p>
          ) : (
            <Leaderboard key={myId ?? saveState} myId={myId} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <button onClick={handleRetry}
            className="btn-3d py-3 rounded-2xl bg-gradient-to-b from-cyan-400 to-blue-600 text-white text-lg shadow-start-btn border border-cyan-200/50">
            ⟳ 재가동 <span className="font-orbitron text-xs">RETRY</span>
          </button>
          <button onClick={handleCharSelect}
            className="btn-3d py-3 rounded-2xl border border-slate-600 bg-slate-800 text-slate-100 text-lg hover:border-cyan-400/60">
            캐릭터 선택
          </button>
        </div>
      </Shell>
    );
  }

  // ---------- S1. 시작 화면 ----------
  return (
    <Shell className="p-4 sm:p-5">
      <nav className="relative z-10 flex items-center justify-between pb-1">
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5">
          <span>🏆</span>
          <div className="flex flex-col leading-none">
            <span className="text-[10px] text-slate-400">최고 랭킹</span>
            <span className="font-orbitron text-xs text-amber-300">{topScore === null ? "-" : `${topScore} SECTOR`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleSound} aria-label="사운드 토글"
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-900/80 hover:border-cyan-400/60 active:scale-90 transition flex items-center justify-center">
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={() => { sfx.click(); setShowSettings(true); }} aria-label="설정"
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-900/80 hover:border-cyan-400/60 active:scale-90 transition flex items-center justify-center">
            ⚙️
          </button>
        </div>
      </nav>

      <header className="relative z-10 text-center">
        <TechHero id={selected} color={spec.themeColor} />
        <h1 className="neon-title text-[38px] leading-none mt-1 tracking-wide">폴리의 테크 모험</h1>
        <p className="font-orbitron text-[10px] tracking-[0.35em] text-cyan-400/80 mt-1.5">POLY&apos;S TECH ADVENTURE</p>
      </header>

      <section className="relative z-10 flex flex-col gap-3 mt-3">
        {/* 선택 캐릭터 + 스킬 카드 */}
        <div className="relative overflow-hidden rounded-2xl border bg-slate-900/80 p-3 flex gap-3 items-center"
          style={{ borderColor: `${spec.themeColor}aa`, boxShadow: `0 0 18px ${spec.themeColor}33` }}>
          <div aria-hidden className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-scan" />
          <div className="w-16 h-20 rounded-xl bg-slate-950 border flex items-end justify-center shrink-0" style={{ borderColor: spec.themeColor }}>
            <CharacterAvatar id={spec.id} size={74} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl text-slate-50">{spec.name}</h2>
              <span className="font-orbitron text-[9px] tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: spec.themeColor, background: `${spec.themeColor}22` }}>{spec.skillType}</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{spec.concept}</p>
            <p className="mt-1 text-sm" style={{ color: spec.themeColor }}>⚡ {spec.skillName}</p>
            <p className="text-xs text-slate-300 leading-snug">{spec.skillDescription}</p>
          </div>
        </div>

        {/* 캐릭터 선택 */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-sm text-slate-200">캐릭터 선택</span>
            <span className="text-[11px] text-slate-400">
              내 최고 기록 <span className="font-orbitron text-cyan-300">{best}</span> SECTOR
              {devAll && <span className="ml-1 text-amber-400">(DEV 전체 해금)</span>}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTERS.map((c) => {
              const unlocked = isUnlocked(c, best, devAll);
              const sel = c.id === selected;
              return (
                <button key={c.id} type="button" aria-pressed={sel} onClick={() => handleSelect(c.id)}
                  className={`relative rounded-xl border p-1.5 pt-2 flex flex-col items-center transition active:scale-95 ${
                    jiggle === c.id ? "animate-jiggle" : ""
                  } ${sel ? "bg-slate-800" : "bg-slate-900/70 hover:bg-slate-800/80"} ${unlocked ? "" : "cursor-not-allowed"}`}
                  style={{
                    borderColor: sel ? c.themeColor : unlocked ? "#334155" : "#1E293B",
                    boxShadow: sel ? `0 0 14px ${c.themeColor}66` : undefined,
                  }}>
                  <CharacterAvatar id={c.id} size={52} locked={!unlocked} bob={sel} />
                  <span className={`text-sm mt-0.5 ${unlocked ? "text-slate-100" : "text-slate-500"}`}>{c.name}</span>
                  <span className="text-[10px] leading-tight" style={{ color: unlocked ? c.themeColor : "#64748B" }}>
                    {unlocked ? c.skillName : `🔒 ${c.unlockScore} SECTOR`}
                  </span>
                  {sel && <span className="absolute -top-2 right-1 font-orbitron text-[8px] px-1.5 py-0.5 rounded-full text-slate-950" style={{ background: c.themeColor }}>ON</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 닉네임 */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
          <label htmlFor="nicknameInput" className="text-xs text-slate-300 mb-1.5 flex items-center justify-between">
            <span>👤 플레이어 닉네임 <span className="text-[10px] text-slate-500">(최대 {NICK_MAX}자)</span></span>
            <span className="font-orbitron text-[10px] text-cyan-300">{graphemes(nickname).length}/{NICK_MAX}</span>
          </label>
          <div className="relative">
            <input
              id="nicknameInput"
              type="text"
              maxLength={40}
              value={nickname}
              onChange={(e) => {
                const g = graphemes(e.target.value);
                setNickname(g.length > NICK_MAX ? g.slice(0, NICK_MAX).join("") : e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="오퍼레이터 이름 입력"
              className={`w-full h-11 rounded-xl border border-slate-600 bg-slate-950 pl-3 pr-20 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition ${inputFlash ? "ring-2 ring-rose-500" : ""}`}
            />
            <button type="button" title="랜덤 닉네임"
              onClick={() => {
                const pool = RANDOM_NAMES.filter((n) => n !== nickname);
                setNickname(pool[Math.floor(Math.random() * pool.length)]);
                sfx.click();
              }}
              className="absolute right-1.5 top-1.5 h-8 px-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 text-xs hover:bg-cyan-500/20 active:scale-95 transition">
              🎲 랜덤
            </button>
          </div>
        </div>

        {/* 조작 안내 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-cyan-500/40 bg-slate-900/70 px-3 py-2">
            <p className="font-orbitron text-cyan-300 tracking-widest">⟲ TURN</p>
            <p className="text-slate-400">방향 전환 후 전진</p>
            <p className="text-slate-500 text-[10px] mt-0.5">A · ← · Space · 좌측 버튼</p>
          </div>
          <div className="rounded-xl border border-amber-500/40 bg-slate-900/70 px-3 py-2">
            <p className="font-orbitron text-amber-300 tracking-widest">▲ CLIMB</p>
            <p className="text-slate-400">바라보는 방향으로 전진</p>
            <p className="text-slate-500 text-[10px] mt-0.5">D · → · Enter · 우측 버튼</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 pt-4 pb-1 mt-auto">
        <button type="button" onClick={handleStart}
          className="btn-3d w-full py-3.5 rounded-2xl bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 border border-cyan-200/60 shadow-start-btn text-white text-2xl tracking-wider flex items-center justify-center gap-2">
          <span>시스템 가동</span>
          <span className="font-orbitron text-sm opacity-90">(START)</span>
        </button>
        <p className="text-center font-orbitron text-[9px] tracking-widest text-slate-600 mt-3">{VERSION} · SMART LOGISTICS ARCADE</p>
      </footer>

      {/* 토스트 */}
      <div aria-live="polite"
        className={`pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-cyan-500/40 bg-slate-950/95 px-4 py-2 text-xs text-cyan-100 shadow-lg transition-opacity duration-200 z-50 whitespace-nowrap ${toast ? "opacity-100" : "opacity-0"}`}>
        {toast}
      </div>

      {/* 설정 · 게임 방법 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-[360px] rounded-3xl border border-cyan-500/50 bg-slate-950 p-5 shadow-neon-cyan animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl text-cyan-200 text-center mb-3">⚙️ 설정 · 게임 방법</h3>
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 px-3 py-2 mb-2">
              <span className="text-sm text-slate-200">효과음</span>
              <button onClick={toggleSound} aria-label="효과음 켜기/끄기"
                className={`w-12 h-6 rounded-full relative transition ${muted ? "bg-slate-700" : "bg-cyan-500"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${muted ? "left-0.5" : "left-6"}`} />
              </button>
            </div>
            {IS_DEV && (
              <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 px-3 py-2 mb-2">
                <span className="text-sm text-amber-200">DEV · 전체 캐릭터 해금</span>
                <button onClick={toggleDevAll} aria-label="개발 모드 전체 해금"
                  className={`w-12 h-6 rounded-full relative transition ${devAll ? "bg-amber-500" : "bg-slate-700"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${devAll ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
            )}
            <ul className="text-xs text-slate-300 space-y-1.5 rounded-2xl border border-slate-700 p-3">
              <li>▲ <b className="text-amber-300">CLIMB</b>: 바라보는 방향의 다음 발판으로 전진</li>
              <li>⟲ <b className="text-cyan-300">TURN</b>: 방향을 바꾼 뒤 전진</li>
              <li>⚡ 빠르게 이동할수록 에너지가 충전돼요. 0이 되거나 방향을 틀리면 SYSTEM HALTED!</li>
              <li>💾 발판 위 데이터 칩은 에너지를 채워 줘요.</li>
              <li>🛡 30 · 50 · 80 섹터(이후 50마다) 보안 게이트 퀴즈 — 정답 시 에너지 100%</li>
              <li>🔓 20 · 40 · 60 · 80 · 100 섹터 돌파 시 교수님 캐릭터 해금</li>
            </ul>
            <button onClick={() => setShowSettings(false)}
              className="btn-3d mt-4 w-full py-2.5 rounded-2xl bg-gradient-to-b from-cyan-400 to-blue-600 text-white text-lg">
              닫기
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
