"use client";

import { useEffect, useRef } from "react";
import { CHARACTERS, getCharacter, type CharacterId } from "@/lib/characters";
import { avatarDataUrl } from "@/lib/avatars";
import { useGameEngine, VIEW_H, VIEW_W, type Action } from "@/hooks/useGameEngine";
import { renderFrame, type RenderCtx } from "@/components/game/renderer";

interface Props {
  character: CharacterId;
  onGameOver: (score: number) => void;
  onUnlock: (id: CharacterId) => void;
}

// 조작: TURN = A / ← / Space, CLIMB = D / → / Enter (docs/PRD.md S2)
const TURN_KEYS = new Set(["a", "A", "ArrowLeft", " "]);
const CLIMB_KEYS = new Set(["d", "D", "ArrowRight", "Enter"]);

export default function GameCanvas({ character, onGameOver, onUnlock }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stateRef, press, tick, quiz, answerQuiz, paused, pause, resume } = useGameEngine({
    charId: character, onGameOver, onUnlock,
  });
  const spec = getCharacter(character);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;

    const images: RenderCtx["images"] = {};
    for (const c of CHARACTERS) {
      const img = new Image();
      img.src = avatarDataUrl(c.id);
      images[c.id] = img;
    }
    const rc: RenderCtx = { images, zone: { cur: 0, prev: 0, at: -1e9 } };
    // 개발 모드 전용: 자동 플레이 테스트용 엔진 상태 노출
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __polyTech?: () => unknown }).__polyTech = () => stateRef.current;
    }

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      tick(now, dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderFrame(ctx, stateRef.current, now, rc);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const isTurn = TURN_KEYS.has(e.key), isClimb = CLIMB_KEYS.has(e.key);
      if (isTurn || isClimb || e.key === "Escape" || e.key === "p" || e.key === "P") e.preventDefault();
      if (e.repeat) return; // 길게 누를 때의 자동 반복 입력은 무시
      if (s.quiz) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 3) answerQuiz(n - 1);
        return;
      }
      if (s.paused) {
        if (isTurn || isClimb || e.key === "Escape" || e.key === "p" || e.key === "P") resume();
        return;
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { pause(); return; }
      if (isTurn) press("turn");
      else if (isClimb) press("climb");
    };
    window.addEventListener("keydown", onKey);

    // 탭 전환·화면 꺼짐 → 자동 일시정지
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stateRef, tick, press, answerQuiz, pause, resume]);

  const onPad = (a: Action) => (e: React.PointerEvent) => {
    e.preventDefault();
    press(a);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-tech-bg">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain object-top"
        style={{ maxWidth: VIEW_W, touchAction: "none" }}
        aria-label="스마트 물류 컨베이어 게임 화면"
      />

      {/* 하단 컨트롤러 */}
      <div className="absolute bottom-4 left-0 right-0 mx-auto flex items-end justify-between gap-3 px-4" style={{ maxWidth: VIEW_W }}>
        <button
          onPointerDown={onPad("turn")}
          aria-label="방향 전환 (TURN)"
          className="ctl-btn flex-1 h-[84px] rounded-2xl border-2 border-cyan-400/70 bg-gradient-to-b from-slate-800 to-slate-950 text-cyan-300 shadow-neon-cyan flex flex-col items-center justify-center select-none"
        >
          <span className="text-3xl leading-none">⟲</span>
          <span className="font-orbitron text-sm tracking-widest mt-1">TURN</span>
          <span className="text-[10px] text-cyan-200/60">방향 전환 · A / ← / Space</span>
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); pause(); }}
          aria-label="일시정지"
          className="w-11 h-11 mb-5 rounded-full border border-slate-500 bg-slate-900/80 text-slate-300 text-sm flex items-center justify-center"
        >
          ❚❚
        </button>
        <button
          onPointerDown={onPad("climb")}
          aria-label="전진 / 오르기 (CLIMB)"
          className="ctl-btn flex-1 h-[84px] rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-slate-800 to-slate-950 text-amber-300 shadow-neon-amber flex flex-col items-center justify-center select-none"
        >
          <span className="text-3xl leading-none">▲</span>
          <span className="font-orbitron text-sm tracking-widest mt-1">CLIMB</span>
          <span className="text-[10px] text-amber-200/60">전진 · D / → / Enter</span>
        </button>
      </div>

      {/* 보안 퀴즈 게이트 */}
      {quiz && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-[370px] rounded-3xl border-2 border-cyan-400/70 bg-tech-panel p-5 shadow-neon-cyan animate-pop-in">
            <p className="text-center font-orbitron text-[11px] tracking-[0.25em] text-amber-400 mb-1">SECURITY GATE</p>
            <p className="text-center text-xs text-cyan-300/80 mb-3">보안 인증 퀴즈 · 정답 시 에너지 100% + 부스트</p>
            <h3 className="text-center text-xl text-slate-50 leading-snug mb-4">{quiz.q.question}</h3>
            <div className="flex flex-col gap-2">
              {quiz.q.options.map((opt, i) => {
                const isAns = i === quiz.q.answer;
                const style =
                  quiz.picked === null
                    ? "border-slate-600 bg-slate-900/80 hover:border-cyan-400 hover:bg-slate-800"
                    : isAns
                    ? "border-emerald-400 bg-emerald-500/15"
                    : quiz.picked === i
                    ? "border-rose-500 bg-rose-500/15"
                    : "border-slate-700 bg-slate-900/50 opacity-50";
                return (
                  <button
                    key={i}
                    onClick={() => answerQuiz(i)}
                    disabled={quiz.picked !== null}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition active:scale-[0.98] ${style}`}
                  >
                    <span className="w-7 h-7 shrink-0 rounded-lg bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-orbitron text-sm flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-base text-slate-100">{opt}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-sm mt-4 h-5">
              {quiz.picked === null ? (
                <span className="text-slate-400">숫자키 1~3으로도 고를 수 있어요</span>
              ) : quiz.picked === quiz.q.answer ? (
                <span className="text-emerald-400">ACCESS GRANTED · 에너지 충전 완료 ⚡</span>
              ) : quiz.exempt ? (
                <span className="text-amber-400">오답! 하지만 마스터 오버클럭으로 패널티 면제</span>
              ) : (
                <span className="text-rose-400">ACCESS DENIED · 에너지 -25%</span>
              )}
            </p>
          </div>
        </div>
      )}

      {paused && !quiz && (
        <div className="absolute inset-0 z-20 bg-slate-950/70 flex flex-col items-center justify-center gap-4">
          <p className="font-orbitron text-cyan-300 text-2xl tracking-widest">SYSTEM PAUSED</p>
          <p className="text-slate-300 text-sm">{spec.name} · {spec.skillName}</p>
          <button
            onClick={resume}
            className="btn-3d px-8 py-3 rounded-2xl bg-gradient-to-b from-cyan-400 to-blue-600 text-white text-xl shadow-neon-cyan border border-cyan-200/60"
          >
            ▶ 재가동
          </button>
          <p className="text-slate-400 text-xs">아무 조작 키나 눌러도 다시 시작해요</p>
        </div>
      )}
    </div>
  );
}
