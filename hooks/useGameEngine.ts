"use client";

// 스마트 물류 컨베이어 게임 엔진 + 캐릭터 고유 스킬 (docs/TRD.md §3.3)
// 렌더링은 components/game/renderer.ts, 입력·루프는 components/GameCanvas.tsx 담당.

import { useCallback, useRef, useState } from "react";
import { CHARACTERS, SKILL, type CharacterId } from "@/lib/characters";
import { gateAfter, pickQuestion, type QuizQuestion } from "@/lib/quiz";
import { sfx } from "@/lib/sound";
import { KEYS, getInt, setItem } from "@/lib/storage";

// ---------- 월드 상수 ----------
export const VIEW_W = 420;
export const VIEW_H = 700;
export const PAD_W = 78;
export const PAD_H = 18;
const STEP_X = 54;
const STEP_Y = 66;
const JUMP_MS = 180;
const FEVER_JUMP_MS = 95;
const HEAL = 0.14;
const CHIP_ENERGY = 0.08;
const FALL_MS = 750;
const KEEP_BELOW = 20;
/** 에너지 감소 속도가 더 이상 빨라지지 않는 섹터 */
const DRAIN_CAP = 150;
const QUIZ_RESULT_MS = 1500;
const QUIZ_BOOST_MS = 2000;
const QUIZ_PENALTY = 0.25;

export type Action = "turn" | "climb";
export type Dir = 1 | -1;

export interface Pad {
  id: number;
  /** 왼쪽 위 모서리 */
  x: number;
  y: number;
  /** 이전 발판에서 이 발판으로 가는 방향 */
  dir: Dir;
  hasDataChip: boolean;
  litAt: number;
}

export interface Fx {
  kind: "text" | "spark" | "shard" | "cargo";
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string; size: number;
  text?: string;
}

export interface EngineState {
  charId: CharacterId;
  pads: Pad[];
  idx: number;
  facing: Dir;
  /** 캐릭터 발끝 중앙 (월드 좌표) */
  x: number; y: number;
  jumping: boolean;
  jumpFrom: { x: number; y: number };
  jumpTo: { x: number; y: number };
  jumpT: number;
  jumpMs: number;
  landAt: number;
  queued: Action | null;

  floor: number;
  score: number;
  energy: number;
  phase: "play" | "falling" | "over";
  fallAt: number;
  paused: boolean;
  quiz: boolean;
  quizPending: boolean;
  nextGate: number;
  usedQuiz: Set<number>;
  best: number;

  // ---- 스킬 상태 ----
  hasShield: boolean;
  shieldBreakAt: number;
  combo: number;
  lastInputAt: number;
  feverUntil: number;
  boostUntil: number;
  chipFlashAt: number;
  trail: { x: number; y: number }[];

  camY: number;
  scorePop: number;
  fx: Fx[];
  banner: { text: string; color: string; at: number } | null;
  frozenAt: number | null;
}

function generatePads(from: Pad, count: number): Pad[] {
  const out: Pad[] = [];
  let { x, y, id } = from;
  const minX = 10;
  const maxX = VIEW_W - PAD_W - 10;
  for (let i = 0; i < count; i++) {
    // 벽에 막히는 방향은 고르지 않음 → 다음 발판은 항상 정확히 왼쪽 또는 오른쪽 한 칸
    let dir: Dir = Math.random() < 0.5 ? 1 : -1;
    if (dir === 1 && x + STEP_X > maxX) dir = -1;
    else if (dir === -1 && x - STEP_X < minX) dir = 1;
    x += dir * STEP_X;
    y -= STEP_Y;
    id++;
    // 데이터 칩(보너스 아이템): 발판 생성 시 15% 확률 (시작 직후 몇 칸은 제외)
    out.push({ id, x, y, dir, hasDataChip: id > 3 && Math.random() < SKILL.CHIP_CHANCE, litAt: -1e9 });
  }
  return out;
}

export function createState(charId: CharacterId, best: number): EngineState {
  const ground: Pad = { id: 0, x: VIEW_W / 2 - PAD_W / 2, y: VIEW_H - 150, dir: 1, hasDataChip: false, litAt: -1e9 };
  const pads = [ground, ...generatePads(ground, 30)];
  return {
    charId, pads, idx: 0, facing: 1,
    x: ground.x + PAD_W / 2, y: ground.y,
    jumping: false, jumpFrom: { x: 0, y: 0 }, jumpTo: { x: 0, y: 0 }, jumpT: 0, jumpMs: JUMP_MS,
    landAt: -1e9, queued: null,
    floor: 0, score: 0, energy: 1,
    phase: "play", fallAt: 0, paused: false, quiz: false, quizPending: false,
    nextGate: gateAfter(0), usedQuiz: new Set(), best,
    // 길완제: 게임 시작 시 hasShield = true
    hasShield: charId === "gil_wj", shieldBreakAt: -1e9,
    combo: 0, lastInputAt: -1e9, feverUntil: -1e9, boostUntil: -1e9, chipFlashAt: -1e9, trail: [],
    camY: ground.y - VIEW_H * 0.62, scorePop: 0, fx: [], banner: null, frozenAt: null,
  };
}

/** 프레임(ms)당 에너지 감소량 */
export function decayRate(s: EngineState): number {
  const base = 0.00008 + Math.min(s.floor, DRAIN_CAP) * 0.000003;
  // E조인간 - 프로토콜 안정화: decayRate * 0.9
  return s.charId === "e_human" ? base * SKILL.E_HUMAN_DECAY_MUL : base;
}

/** 한 칸 이동 시 에너지 회복량 */
export function healAmount(s: EngineState): number {
  // 구병모 - 마스터 오버클럭: healAmount * 1.3
  return s.charId === "koo_bm" ? HEAL * SKILL.KOO_HEAL_MUL : HEAL;
}

export const isFever = (s: EngineState, now: number) => now < s.feverUntil;

function burst(s: EngineState, x: number, y: number, n: number, color: string, kind: Fx["kind"] = "spark", speed = 0.18) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    s.fx.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, life: 600, max: 600, color, size: 2 + Math.random() * 3 });
  }
}

function floatText(s: EngineState, x: number, y: number, text: string, color: string) {
  s.fx.push({ kind: "text", x, y, vx: 0, vy: -0.05, life: 900, max: 900, color, size: 16, text });
}

interface Options {
  charId: CharacterId;
  onGameOver: (score: number) => void;
  onUnlock: (id: CharacterId) => void;
}

export interface QuizView {
  q: QuizQuestion;
  picked: number | null;
  /** 오답 패널티 면제 여부 (구병모) */
  exempt: boolean;
}

export function useGameEngine({ charId, onGameOver, onUnlock }: Options) {
  const stateRef = useRef<EngineState>(null as unknown as EngineState);
  if (!stateRef.current) stateRef.current = createState(charId, getInt(KEYS.best));

  const cbRef = useRef({ onGameOver, onUnlock });
  cbRef.current = { onGameOver, onUnlock };

  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [paused, setPaused] = useState(false);

  // ---- 일시정지 동안 스킬 타이머가 흐르지 않도록 ----
  const freeze = (s: EngineState, now: number) => { s.frozenAt ??= now; };
  const unfreeze = (s: EngineState, now: number) => {
    if (s.frozenAt === null) return;
    const d = now - s.frozenAt;
    if (s.feverUntil > s.frozenAt) s.feverUntil += d;
    if (s.boostUntil > s.frozenAt) s.boostUntil += d;
    s.lastInputAt += d;
    s.frozenAt = null;
  };

  const fall = (s: EngineState, now: number) => {
    if (s.phase !== "play") return;
    s.phase = "falling";
    s.fallAt = now;
    s.jumping = false;
    s.queued = null;
    s.combo = 0;
    sfx.gameOver();
  };

  /** 실제 한 칸 이동. auto=true면 피버 자동 질주 */
  const step = (s: EngineState, action: Action, now: number, auto: boolean) => {
    const next = s.pads[s.idx + 1];
    if (!next) return;
    const fever = isFever(s, now);
    let dir: Dir = action === "turn" ? (-s.facing as Dir) : s.facing;

    // 안영휘 - 하이퍼 부스트: 피버 중에는 어떤 버튼이든 정답 방향으로 전진
    if (fever) dir = next.dir;

    if (dir !== next.dir) {
      if (s.hasShield) {
        // 길완제 - 긴급 백업 시스템: 1회 자동 복구
        s.hasShield = false;
        s.shieldBreakAt = now;
        dir = next.dir;
        s.combo = 0;
        burst(s, s.x, s.y - 30, 16, "#34D399", "shard", 0.25);
        floatText(s, s.x, s.y - 70, "BACKUP RESTORED", "#34D399");
        sfx.shield();
      } else {
        s.facing = dir;
        fall(s, now);
        return;
      }
    } else if (!auto) {
      // 연속 입력 콤보 (입력 간격 0.4초 이내 유지 시 증가)
      s.combo = now - s.lastInputAt <= SKILL.AHN_COMBO_WINDOW_MS ? s.combo + 1 : 1;
    }
    if (!auto) s.lastInputAt = now;

    if (s.charId === "ahn_yh" && !fever && s.combo >= SKILL.AHN_FEVER_COMBO) {
      s.feverUntil = now + SKILL.AHN_FEVER_MS;
      s.combo = 0;
      s.banner = { text: "HYPER BOOST · FEVER!", color: "#F97316", at: now };
      sfx.fever();
    }

    const turned = dir !== s.facing;
    s.facing = dir;
    s.jumpFrom = { x: s.x, y: s.y };
    s.jumpTo = { x: next.x + PAD_W / 2, y: next.y };
    s.jumping = true;
    s.jumpT = 0;
    s.jumpMs = isFever(s, now) ? FEVER_JUMP_MS : JUMP_MS;
    s.idx++;
    s.floor++;

    let gain = 1;
    s.energy = Math.min(1, s.energy + healAmount(s));
    if (next.hasDataChip) {
      next.hasDataChip = false;
      s.energy = Math.min(1, s.energy + CHIP_ENERGY);
      if (s.charId === "lim_junga") {
        // 임정아 - 데이터 최적화: score += 2
        gain += SKILL.LIM_CHIP_BONUS;
        s.chipFlashAt = now;
        floatText(s, next.x + PAD_W / 2, next.y - 50, `+${SKILL.LIM_CHIP_BONUS} DATA`, "#C084FC");
      } else {
        floatText(s, next.x + PAD_W / 2, next.y - 50, "+ENERGY", "#FBBF24");
      }
      burst(s, next.x + PAD_W / 2, next.y - 26, 10, "#FBBF24");
      sfx.chip();
    }
    s.score += gain;
    s.scorePop = 1;
    if (!auto || s.floor % 2 === 0) sfx.step(turned);

    // 보안 퀴즈 게이트
    if (s.score >= s.nextGate) {
      s.quizPending = true;
      s.nextGate = gateAfter(s.score);
    }

    // 최고 기록 + 캐릭터 해금 (개인 최고 기록이 기준을 "처음" 넘는 순간)
    if (s.score > s.best) {
      const newly = CHARACTERS.filter((c) => c.unlockScore > 0 && s.best < c.unlockScore && s.score >= c.unlockScore);
      s.best = s.score;
      setItem(KEYS.best, String(s.best));
      for (const c of newly) {
        s.banner = { text: `NEW UNLOCK · ${c.name}`, color: c.themeColor, at: now };
        sfx.unlock();
        cbRef.current.onUnlock(c.id);
      }
    }

    if (s.idx > s.pads.length - 15) s.pads.push(...generatePads(s.pads[s.pads.length - 1], 20));
    const drop = s.idx - KEEP_BELOW;
    if (drop > 0) {
      s.pads.splice(0, drop);
      s.idx -= drop;
    }
  };

  const press = useCallback((action: Action) => {
    const s = stateRef.current;
    if (s.phase !== "play" || s.paused || s.quiz) return;
    // 이동 중 입력은 1개까지 저장했다가 착지 직후 실행 (입력 버퍼)
    if (s.jumping) { s.queued = action; return; }
    step(s, action, performance.now(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = useCallback((now: number, dt: number) => {
    const s = stateRef.current;

    if (s.phase === "play" && !s.paused && !s.quiz) {
      const fever = isFever(s, now);
      // 피버·퀴즈 부스트 중에는 에너지 감소 중지
      if (!fever && now >= s.boostUntil) {
        s.energy = Math.max(0, s.energy - decayRate(s) * dt);
        if (s.energy <= 0) fall(s, now);
      }

      if (s.jumping) {
        s.jumpT += dt / s.jumpMs;
        if (s.jumpT >= 1) {
          s.jumping = false;
          s.x = s.jumpTo.x;
          s.y = s.jumpTo.y;
          s.landAt = now;
          const pad = s.pads[s.idx];
          pad.litAt = now;
          // 물류 박스 이송 연출
          const nd = s.pads[s.idx + 1]?.dir ?? s.facing;
          s.fx.push({ kind: "cargo", x: pad.x + PAD_W / 2, y: pad.y, vx: nd * 0.12, vy: 0, life: 520, max: 520, color: "#F59E0B", size: 9 });
          burst(s, s.x, s.y, 4, "#22D3EE", "spark", 0.12);

          if (s.quizPending) {
            s.quizPending = false;
            s.queued = null;
            s.quiz = true;
            freeze(s, now);
            sfx.gate();
            setQuiz({ q: pickQuestion(s.usedQuiz), picked: null, exempt: s.charId === "koo_bm" });
          } else if (s.queued !== null) {
            const q = s.queued;
            s.queued = null;
            step(s, q, now, false);
          }
        } else {
          const t = s.jumpT;
          s.x = s.jumpFrom.x + (s.jumpTo.x - s.jumpFrom.x) * t;
          s.y = s.jumpFrom.y + (s.jumpTo.y - s.jumpFrom.y) * t - Math.sin(t * Math.PI) * 30;
        }
      }

      // 피버: 무적 자동 질주
      if (isFever(s, now) && !s.jumping && !s.quiz && s.phase === "play") step(s, "climb", now, true);

      if (isFever(s, now)) {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 7) s.trail.shift();
      } else if (s.trail.length) s.trail.shift();

      // 콤보 끊김
      if (now - s.lastInputAt > SKILL.AHN_COMBO_WINDOW_MS && !s.jumping) s.combo = 0;
      s.scorePop = Math.max(0, s.scorePop - dt / 200);
    }

    if (s.phase === "falling" && now - s.fallAt > FALL_MS) {
      s.phase = "over";
      cbRef.current.onGameOver(s.score);
    }

    // 카메라: 캐릭터가 화면 62% 높이에 오도록 부드럽게
    if (s.phase === "play") {
      const target = s.y - VIEW_H * 0.62;
      s.camY += (target - s.camY) * Math.min(1, dt * (isFever(s, now) ? 0.025 : 0.01));
    }

    s.fx = s.fx.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "shard" || p.kind === "spark") p.vy += 0.0005 * dt;
      return p.life > 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quizRef = useRef<QuizView | null>(null);
  quizRef.current = quiz;

  const answerQuiz = useCallback((i: number) => {
    const s = stateRef.current;
    const cur = quizRef.current;
    if (!cur || cur.picked !== null) return; // 한 번만 답할 수 있음
    const picked = { ...cur, picked: i };
    quizRef.current = picked;
    setQuiz(picked);
    const correct = i === cur.q.answer;
    if (correct) sfx.correct(); else sfx.wrong();
    setTimeout(() => {
        const now = performance.now();
        unfreeze(s, now);
        if (correct) {
          // 정답: 에너지 100% 회복 + 부스트(잠시 감소 중지)
          s.energy = 1;
          s.boostUntil = now + QUIZ_BOOST_MS;
          s.banner = { text: "ACCESS GRANTED · BOOST", color: "#22D3EE", at: now };
        } else if (s.charId === "koo_bm") {
          // 구병모: 오답 패널티 완전 면제
          s.banner = { text: "OVERCLOCK · 패널티 면제", color: "#F59E0B", at: now };
        } else {
          s.energy = Math.max(0.12, s.energy - QUIZ_PENALTY);
          s.banner = { text: "ACCESS DENIED · ENERGY -25%", color: "#F43F5E", at: now };
        }
        s.quiz = false;
        quizRef.current = null;
        setQuiz(null);
      }, QUIZ_RESULT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "play" || s.paused || s.quiz) return;
    s.paused = true;
    s.queued = null;
    freeze(s, performance.now());
    setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = useCallback(() => {
    const s = stateRef.current;
    if (!s.paused) return;
    s.paused = false;
    unfreeze(s, performance.now());
    setPaused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stateRef, press, tick, quiz, answerQuiz, paused, pause, resume };
}
