// Web Audio로 만드는 테크토닉 효과음 (파일 없음)

let ac: AudioContext | null = null;

export function isMuted(): boolean {
  try { return localStorage.getItem("muted") === "1"; } catch { return false; }
}

export function setMuted(m: boolean) {
  try { localStorage.setItem("muted", m ? "1" : "0"); } catch { /* ignore */ }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ac.state === "suspended") void ac.resume();
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

export const sfx = {
  /** 스캐너 비프음 (방향 전환은 살짝 낮게) */
  step(turned: boolean) { tone(turned ? 1180 : 1480, 0.05, "square", 0.035); },
  click() { tone(900, 0.04, "square", 0.04); },
  chip() { [1568, 2093].forEach((f, i) => tone(f, 0.07, "square", 0.04, undefined, i * 0.05)); },
  shield() { tone(300, 0.18, "sawtooth", 0.06, 900); tone(1200, 0.12, "triangle", 0.05, 600, 0.12); },
  fever() { tone(220, 0.5, "sawtooth", 0.05, 1760); },
  unlock() { [660, 880, 1320, 1760].forEach((f, i) => tone(f, 0.1, "square", 0.05, undefined, i * 0.07)); },
  gameOver() { tone(880, 0.6, "sawtooth", 0.05, 60); },
  gate() { [440, 660].forEach((f, i) => tone(f, 0.12, "square", 0.05, undefined, i * 0.12)); },
  correct() { [784, 1047, 1568].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, undefined, i * 0.08)); },
  wrong() { tone(200, 0.3, "square", 0.05, 120); },
};
