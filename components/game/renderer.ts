// 스마트 물류 컨베이어 렌더러 (docs/TRD.md §4)
// 배경: 1F 입출고장 → 자동화 분류 라인 → 고공 AGV 허브 → 중앙 AI 관제탑 (패럴랙스)

import { getCharacter, SKILL, type CharacterSpec } from "@/lib/characters";
import { AVATAR_VIEW_H, AVATAR_VIEW_W } from "@/lib/avatars";
import { PAD_H, PAD_W, VIEW_H, VIEW_W, isFever, type EngineState, type Pad } from "@/hooks/useGameEngine";

export const CHAR_H = 62;
export const CHAR_W = (CHAR_H * AVATAR_VIEW_W) / AVATAR_VIEW_H;

const FONT_NUM = '"Orbitron", "Do Hyeon", sans-serif';
const FONT_KR = '"Do Hyeon", sans-serif';

export const ZONES = [
  { from: 0, name: "1F 입출고장", top: "#0B1120", bottom: "#0E1A30", accent: "#06B6D4" },
  { from: 25, name: "자동화 분류 라인", top: "#0A1024", bottom: "#0F2142", accent: "#3B82F6" },
  { from: 50, name: "고공 AGV 허브", top: "#090C1E", bottom: "#1B1745", accent: "#8B5CF6" },
  { from: 100, name: "중앙 AI 관제탑", top: "#05070F", bottom: "#24170A", accent: "#F59E0B" },
] as const;

export function zoneIndex(score: number): number {
  let z = 0;
  ZONES.forEach((zn, i) => { if (score >= zn.from) z = i; });
  return z;
}

// ---------- 배경 레이어 ----------
type Ctx = CanvasRenderingContext2D;

function tiled(scroll: number, h: number, draw: (oy: number) => void) {
  const off = ((scroll % h) + h) % h;
  draw(off - h);
  draw(off);
}

function bgWarehouse(ctx: Ctx, cam: number, now: number) {
  // 먼 레이어: 랙 선반 + 박스
  tiled(-cam * 0.15, VIEW_H, (oy) => {
    ctx.fillStyle = "#13213A";
    for (const rx of [8, 150, 292]) {
      ctx.fillRect(rx, oy, 6, VIEW_H);
      ctx.fillRect(rx + 114, oy, 6, VIEW_H);
      for (let y = 40; y < VIEW_H; y += 120) {
        ctx.fillRect(rx, oy + y, 120, 5);
        for (let b = 0; b < 4; b++) {
          ctx.fillStyle = (b + y / 120 + rx) % 3 < 1 ? "#1E3352" : "#182A45";
          ctx.fillRect(rx + 12 + b * 26, oy + y - 26, 20, 26);
        }
        ctx.fillStyle = "#13213A";
      }
    }
  });
  // 가까운 레이어: 도크 표지등
  tiled(-cam * 0.35, VIEW_H, (oy) => {
    for (let i = 0; i < 4; i++) {
      const on = Math.floor(now / 500 + i) % 2 === 0;
      ctx.fillStyle = on ? "rgba(245,158,11,0.55)" : "rgba(245,158,11,0.15)";
      ctx.beginPath(); ctx.arc(24 + i * 124, oy + 300, 3, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function bgSorting(ctx: Ctx, cam: number, now: number) {
  tiled(-cam * 0.2, VIEW_H, (oy) => {
    for (let k = 0; k < 4; k++) {
      const y = oy + 90 + k * 170;
      const dir = k % 2 ? -1 : 1;
      ctx.fillStyle = "#15274A";
      ctx.fillRect(0, y, VIEW_W, 10);
      ctx.fillStyle = "#0E1B35";
      for (let x = 0; x < VIEW_W; x += 40) ctx.fillRect(x + 10, y + 10, 4, 30);
      // 이동하는 박스
      for (let b = 0; b < 5; b++) {
        const bx = ((now * 0.04 * dir + b * 95 + k * 37) % (VIEW_W + 60) + VIEW_W + 60) % (VIEW_W + 60) - 30;
        ctx.fillStyle = "#23395F";
        ctx.fillRect(bx, y - 16, 22, 16);
        ctx.fillStyle = "#2D4A78";
        ctx.fillRect(bx + 8, y - 16, 6, 16);
      }
    }
  });
  // 로봇 암 실루엣
  tiled(-cam * 0.4, VIEW_H, (oy) => {
    for (const [ax, ph] of [[60, 0], [360, 1.6]] as const) {
      const a = Math.sin(now / 900 + ph) * 0.5;
      ctx.save();
      ctx.translate(ax, oy + 420);
      ctx.strokeStyle = "rgba(59,130,246,0.22)";
      ctx.lineCap = "round";
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -60);
      const ex = Math.sin(a) * 60, ey = -60 - Math.cos(a) * 60;
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a) * 30, ey + Math.sin(a) * 30 + 10);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function bgAgvHub(ctx: Ctx, cam: number, now: number) {
  tiled(-cam * 0.18, VIEW_H, (oy) => {
    // 케이블
    ctx.strokeStyle = "#1E1B4B";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, oy + 100 + i * 230);
      ctx.quadraticCurveTo(VIEW_W / 2, oy + 180 + i * 230, VIEW_W, oy + 90 + i * 230);
      ctx.stroke();
    }
    // 공중 플랫폼 + AGV
    for (let i = 0; i < 3; i++) {
      const px = [40, 250, 120][i], py = oy + 160 + i * 220;
      ctx.fillStyle = "#211C52";
      ctx.beginPath(); ctx.roundRect(px, py, 140, 12, 6); ctx.fill();
      ctx.fillStyle = "rgba(139,92,246,0.35)";
      ctx.fillRect(px + 6, py + 12, 128, 2);
      const t = (Math.sin(now / 1200 + i * 2) + 1) / 2;
      ctx.fillStyle = "#2E2873";
      ctx.beginPath(); ctx.roundRect(px + 10 + t * 96, py - 12, 24, 12, 3); ctx.fill();
      ctx.fillStyle = "rgba(167,139,250,0.8)";
      ctx.fillRect(px + 14 + t * 96, py - 9, 5, 3);
    }
  });
}

function bgAiTower(ctx: Ctx, cam: number, now: number) {
  // 중앙 관제탑 + 회전 링 (화면 고정에 가까운 먼 배경)
  const cx = VIEW_W / 2;
  ctx.fillStyle = "#1A1208";
  ctx.beginPath();
  ctx.moveTo(cx - 40, VIEW_H); ctx.lineTo(cx - 18, 160); ctx.lineTo(cx + 18, 160); ctx.lineTo(cx + 40, VIEW_H);
  ctx.fill();
  const core = 0.5 + 0.5 * Math.sin(now / 400);
  ctx.fillStyle = `rgba(245,158,11,${0.25 + core * 0.3})`;
  ctx.beginPath(); ctx.arc(cx, 150, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(245,158,11,0.35)";
  ctx.lineWidth = 2;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    ctx.ellipse(cx, 150, 60 + r * 34, 14 + r * 6, 0, now / (900 + r * 300), now / (900 + r * 300) + Math.PI * 1.4);
    ctx.stroke();
  }
  // 데이터 스트림
  tiled(-cam * 0.3 + now * 0.08, VIEW_H, (oy) => {
    ctx.fillStyle = "rgba(251,191,36,0.35)";
    for (let i = 0; i < 14; i++) {
      const x = (i * 31 + 7) % VIEW_W;
      for (let j = 0; j < 5; j++) ctx.fillRect(x, oy + ((i * 97 + j * 23) % VIEW_H), 2, 8);
    }
  });
}

const ZONE_BG = [bgWarehouse, bgSorting, bgAgvHub, bgAiTower];

function drawBackground(ctx: Ctx, s: EngineState, now: number, zone: { cur: number; prev: number; at: number }) {
  const k = Math.min(1, (now - zone.at) / 1200);
  const z = ZONES[zone.cur], pz = ZONES[zone.prev];
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, z.top);
  g.addColorStop(1, z.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (k < 1 && zone.prev !== zone.cur) {
    ctx.globalAlpha = 1 - k;
    const pg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    pg.addColorStop(0, pz.top);
    pg.addColorStop(1, pz.bottom);
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ZONE_BG[zone.prev](ctx, s.camY, now);
  }
  ctx.globalAlpha = k;
  ZONE_BG[zone.cur](ctx, s.camY, now);
  ctx.globalAlpha = 1;

  // 테크 그리드
  ctx.strokeStyle = "rgba(6,182,212,0.06)";
  ctx.lineWidth = 1;
  tiled(-s.camY * 0.5, 40, (oy) => {
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(VIEW_W, oy); ctx.stroke();
  });
  for (let x = 0; x <= VIEW_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); ctx.stroke();
  }

  // 바코드 스캐너 레이저 스윕
  const sweep = (now % 4200) / 4200;
  const ly = sweep * VIEW_H * 1.2 - 40;
  ctx.fillStyle = "rgba(244,63,94,0.08)";
  ctx.fillRect(0, ly - 16, VIEW_W, 32);
  ctx.fillStyle = "rgba(244,63,94,0.5)";
  ctx.fillRect(0, ly, VIEW_W, 1.5);
}

// ---------- 발판 ----------
function drawPad(ctx: Ctx, p: Pad, nextDir: number, current: boolean, now: number, accent: string) {
  const lit = Math.max(0, 1 - (now - p.litAt) / 700);
  const { x, y } = p;
  // 두께(그림자)
  ctx.fillStyle = "#070B14";
  ctx.beginPath(); ctx.roundRect(x + 2, y + 7, PAD_W - 4, PAD_H, 5); ctx.fill();
  // 금속 프레임
  ctx.fillStyle = "#334155";
  ctx.beginPath(); ctx.roundRect(x, y, PAD_W, PAD_H, 5); ctx.fill();
  ctx.strokeStyle = "#64748B";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 4, y + 1.5, PAD_W - 8, 1.5);
  // 컨베이어 벨트 (롤러가 다음 경로 방향으로 흐름)
  const bx = x + 6, by = y + 4, bw = PAD_W - 12, bh = PAD_H - 9;
  ctx.fillStyle = "#111827";
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.clip();
  ctx.strokeStyle = "#1F2A3D";
  ctx.lineWidth = 2;
  const shift = ((now * 0.03 * nextDir) % 8 + 8) % 8;
  for (let lx = bx - 8 + shift; lx < bx + bw + 8; lx += 8) {
    ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx + 3, by + bh); ctx.stroke();
  }
  // LED 방향 화살표
  ctx.fillStyle = current || lit > 0 ? "#FBBF24" : "rgba(34,211,238,0.55)";
  const cx = x + PAD_W / 2, cy = by + bh / 2;
  for (const o of [-9, 3]) {
    ctx.beginPath();
    ctx.moveTo(cx + o * nextDir, cy - 3);
    ctx.lineTo(cx + (o + 5) * nextDir, cy);
    ctx.lineTo(cx + o * nextDir, cy + 3);
    ctx.fill();
  }
  ctx.restore();
  // 네온 스트립 (밟으면 앰버로 점등)
  const strip = current || lit > 0 ? "#F59E0B" : accent;
  if (current || lit > 0) {
    ctx.shadowColor = strip;
    ctx.shadowBlur = 10 + lit * 14;
  }
  ctx.fillStyle = strip;
  ctx.fillRect(x + 5, y + PAD_H - 3.5, PAD_W - 10, 2.5);
  ctx.shadowBlur = 0;
  if (lit > 0) {
    ctx.fillStyle = `rgba(245,158,11,${lit * 0.25})`;
    ctx.beginPath(); ctx.roundRect(x - 3, y - 3, PAD_W + 6, PAD_H + 6, 7); ctx.fill();
  }
}

function drawChip(ctx: Ctx, cx: number, cy: number, now: number) {
  const bob = Math.sin(now / 250 + cx) * 3;
  const y = cy + bob;
  ctx.save();
  ctx.translate(cx, y);
  ctx.shadowColor = "#FBBF24";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#F59E0B";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FEF3C7";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 바코드 코어
  ctx.fillStyle = "#1F2937";
  [-5, -3, -0.5, 1.5, 4].forEach((bx, i) => ctx.fillRect(bx, -5, i % 2 ? 1 : 1.6, 10));
  ctx.restore();
}

// ---------- 캐릭터 ----------
function drawCharacter(ctx: Ctx, s: EngineState, img: HTMLImageElement | undefined, spec: CharacterSpec, now: number) {
  let { x, y } = s;
  let rot = 0;
  let alpha = 1;
  let sx = 1, sy = 1;

  if (s.phase !== "play") {
    const t = now - s.fallAt;
    x += s.facing * t * 0.09;
    y += 0.0009 * t * t;
    rot = s.facing * t * 0.006;
    alpha = Math.max(0, 1 - t / 750);
  } else if (s.jumping) {
    const j = Math.sin(s.jumpT * Math.PI);
    sy = 1 + 0.1 * j; sx = 1 - 0.07 * j;
  } else {
    const land = now - s.landAt;
    if (land < 160) {
      const k = 1 - land / 160;
      sy = 1 - 0.14 * k; sx = 1 + 0.1 * k;
    } else {
      const b = Math.sin(now / 280);
      sy = 1 + 0.02 * b; sx = 1 - 0.015 * b;
    }
  }

  if (!s.jumping && s.phase === "play") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(x, y + 1, 16, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  const fever = isFever(s, now);
  const draw = (dx: number, dy: number, a: number) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.scale(s.facing * sx, sy);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -CHAR_W / 2, -CHAR_H, CHAR_W, CHAR_H);
    } else {
      ctx.fillStyle = spec.themeColor;
      ctx.beginPath(); ctx.roundRect(-14, -CHAR_H + 10, 28, CHAR_H - 10, 10); ctx.fill();
    }
    ctx.restore();
  };

  // 피버: 부스트 잔상 + 오라
  if (fever && s.trail.length) {
    s.trail.forEach((p, i) => draw(p.x, p.y, 0.08 + (i / s.trail.length) * 0.25));
    ctx.fillStyle = "rgba(249,115,22,0.22)";
    ctx.beginPath(); ctx.ellipse(x, y - CHAR_H / 2, 34, 42, 0, 0, Math.PI * 2); ctx.fill();
  }

  draw(x, y, alpha);

  // 길완제 실드
  if (s.hasShield && s.phase === "play") {
    const p = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.strokeStyle = `rgba(52,211,153,${0.35 + p * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + now / 2000;
      ctx.lineTo(x + Math.cos(a) * 34, y - CHAR_H / 2 + Math.sin(a) * 38);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(16,185,129,${0.06 + p * 0.05})`;
    ctx.fill();
  }
  const sb = now - s.shieldBreakAt;
  if (sb < 500) {
    ctx.strokeStyle = `rgba(52,211,153,${1 - sb / 500})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y - CHAR_H / 2, 34 + sb * 0.12, 0, Math.PI * 2); ctx.stroke();
  }
}

// ---------- 박정용 경로 가이드 ----------
function drawGuide(ctx: Ctx, s: EngineState, now: number, color: string) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SKILL.PARK_GUIDE_COUNT; i++) {
    const p = s.pads[s.idx + i];
    if (!p) break;
    pts.push({ x: p.x + PAD_W / 2, y: p.y - 8 });
  }
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.lineDashOffset = -now * 0.06;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  pts.slice(1).forEach((p, i) => {
    ctx.globalAlpha = 1 - i * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ---------- HUD ----------
function skillStatus(s: EngineState, now: number): { text: string; color: string; progress?: number } {
  switch (s.charId) {
    case "e_human": return { text: "에너지 감소 -10%", color: "#22D3EE" };
    case "lim_junga": return { text: now - s.chipFlashAt < 900 ? "칩 획득! +2 SECTOR" : "데이터 칩 +2 SECTOR", color: "#C084FC" };
    case "park_jy": return { text: "경로 가이드 ON", color: "#60A5FA" };
    case "gil_wj": return s.hasShield ? { text: "백업 실드 READY", color: "#34D399" } : { text: "백업 실드 USED", color: "#64748B" };
    case "ahn_yh":
      if (isFever(s, now)) return { text: `FEVER ${((s.feverUntil - now) / 1000).toFixed(1)}s`, color: "#FB923C", progress: (s.feverUntil - now) / SKILL.AHN_FEVER_MS };
      return { text: `COMBO ${s.combo}/${SKILL.AHN_FEVER_COMBO}`, color: "#FB923C", progress: s.combo / SKILL.AHN_FEVER_COMBO };
    case "koo_bm": return { text: "회복 +30% · 패널티 면제", color: "#FBBF24" };
  }
}

function drawHud(ctx: Ctx, s: EngineState, img: HTMLImageElement | undefined, spec: CharacterSpec, now: number, zoneName: string) {
  const px = 10, py = 10, pw = VIEW_W - 20, ph = 92;
  ctx.fillStyle = "rgba(8,13,26,0.85)";
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 캐릭터 아이콘
  ctx.fillStyle = "#0F172A";
  ctx.strokeStyle = spec.themeColor;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px + 8, py + 8, 46, 50, 10); ctx.fill(); ctx.stroke();
  if (img?.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(px + 8, py + 8, 46, 50, 10); ctx.clip();
    ctx.drawImage(img, px + 8 + 3, py + 8 + 2, 40, 50);
    ctx.restore();
  }

  // 이름 + 스킬 상태
  const st = skillStatus(s, now);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#E2E8F0";
  ctx.font = `16px ${FONT_KR}`;
  ctx.fillText(spec.name, px + 64, py + 25);
  const nameW = ctx.measureText(spec.name).width;
  ctx.fillStyle = spec.themeColor;
  ctx.font = `12px ${FONT_KR}`;
  ctx.fillText(spec.skillName, px + 64 + nameW + 8, py + 25);
  // 스킬 상태 칩
  ctx.font = `12px ${FONT_KR}`;
  const tw = ctx.measureText(st.text).width + 20;
  const active = s.charId !== "gil_wj" || s.hasShield;
  const pulse = active ? 0.5 + 0.5 * Math.sin(now / 250) : 0;
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.strokeStyle = st.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(px + 64, py + 33, tw, 22, 11); ctx.fill(); ctx.stroke();
  if (st.progress !== undefined) {
    ctx.fillStyle = st.color + "55";
    ctx.beginPath(); ctx.roundRect(px + 64, py + 33, Math.max(0, Math.min(1, st.progress)) * tw, 22, 11); ctx.fill();
  }
  ctx.fillStyle = st.color;
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.beginPath(); ctx.arc(px + 74, py + 44, 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillText(st.text, px + 82, py + 48);

  // 섹터
  const pop = 1 + s.scorePop * 0.2;
  ctx.save();
  ctx.translate(px + pw - 12, py + 44);
  ctx.scale(pop, pop);
  ctx.textAlign = "right";
  ctx.font = `bold 34px ${FONT_NUM}`;
  ctx.shadowColor = "#22D3EE";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#E0F2FE";
  ctx.fillText(String(s.score), 0, 0);
  ctx.restore();
  ctx.textAlign = "right";
  ctx.font = `10px ${FONT_NUM}`;
  ctx.fillStyle = "#22D3EE";
  ctx.fillText(`SECTOR · ${zoneName}`, px + pw - 12, py + 60);
  ctx.font = `10px ${FONT_NUM}`;

  // 에너지 게이지
  const gx = px + 10, gy = py + 68, gw = pw - 20, gh = 14;
  const low = s.energy < 0.25;
  const shake = low && s.phase === "play" ? Math.sin(now / 30) * 1.2 : 0;
  ctx.fillStyle = "#0F172A";
  ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 7); ctx.fill();
  const fever = isFever(s, now);
  const boost = now < s.boostUntil;
  const eg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  if (fever) { eg.addColorStop(0, "#F97316"); eg.addColorStop(1, "#FDE047"); }
  else if (low) { eg.addColorStop(0, "#BE123C"); eg.addColorStop(1, "#F43F5E"); }
  else { eg.addColorStop(0, "#06B6D4"); eg.addColorStop(1, "#3B82F6"); }
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.roundRect(gx + shake, gy, Math.max(gh, gw * s.energy), gh, 7); ctx.fill();
  // 눈금
  ctx.fillStyle = "rgba(8,13,26,0.6)";
  for (let i = 1; i < 10; i++) ctx.fillRect(gx + (gw * i) / 10, gy, 1.5, gh);
  ctx.textAlign = "left";
  ctx.fillStyle = "#F8FAFC";
  ctx.font = `bold 9px ${FONT_NUM}`;
  ctx.fillText(fever ? "ENERGY · FEVER LOCK" : boost ? "ENERGY · BOOST" : "ENERGY", gx + 8, gy + 10.5);
}

// ---------- 메인 ----------
export interface RenderCtx {
  images: Partial<Record<string, HTMLImageElement>>;
  zone: { cur: number; prev: number; at: number };
}

export function renderFrame(ctx: Ctx, s: EngineState, now: number, rc: RenderCtx) {
  const spec = getCharacter(s.charId);
  const img = rc.images[s.charId];
  const z = zoneIndex(s.score);
  if (z !== rc.zone.cur) rc.zone = { cur: z, prev: rc.zone.cur, at: now };
  const accent = ZONES[rc.zone.cur].accent;

  drawBackground(ctx, s, now, rc.zone);

  ctx.save();
  ctx.translate(0, -s.camY);

  const top = s.camY - 60, bottom = s.camY + VIEW_H + 60;
  s.pads.forEach((p, i) => {
    if (p.y < top || p.y > bottom) return;
    drawPad(ctx, p, s.pads[i + 1]?.dir ?? p.dir, i === s.idx, now, accent);
  });
  s.pads.forEach((p) => {
    if (p.hasDataChip && p.y > top && p.y < bottom) drawChip(ctx, p.x + PAD_W / 2, p.y - 26, now);
  });

  if (s.charId === "park_jy" && s.phase === "play") drawGuide(ctx, s, now, spec.themeColor);

  // 이펙트(캐릭터 뒤)
  for (const f of s.fx) {
    const a = f.life / f.max;
    if (f.kind === "cargo") {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#B45309";
      ctx.fillRect(f.x - f.size, f.y - f.size * 1.6, f.size * 2, f.size * 1.6);
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(f.x - 2, f.y - f.size * 1.6, 4, f.size * 1.6);
    }
  }
  ctx.globalAlpha = 1;

  drawCharacter(ctx, s, img, spec, now);

  for (const f of s.fx) {
    const a = f.life / f.max;
    ctx.globalAlpha = a;
    if (f.kind === "spark") {
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    } else if (f.kind === "shard") {
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.vx * 40, f.y + f.vy * 40); ctx.stroke();
    } else if (f.kind === "text" && f.text) {
      ctx.font = `bold ${f.size}px ${FONT_NUM}`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(8,13,26,0.9)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 피버 화면 연출: 스피드 라인 + 비네트
  if (isFever(s, now)) {
    ctx.strokeStyle = "rgba(251,146,60,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const lx = (i * 37 + 11) % VIEW_W;
      const ly = ((now * 1.2 + i * 83) % (VIEW_H + 120)) - 60;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 50); ctx.stroke();
    }
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.7);
    vg.addColorStop(0, "rgba(249,115,22,0)");
    vg.addColorStop(1, "rgba(249,115,22,0.3)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // 추락: 시스템 정지 붉은 경고
  if (s.phase !== "play") {
    const k = Math.min(1, (now - s.fallAt) / 600);
    ctx.fillStyle = `rgba(190,18,60,${k * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = k;
    ctx.textAlign = "center";
    ctx.font = `bold 30px ${FONT_NUM}`;
    ctx.fillStyle = "#FECDD3";
    ctx.fillText("SYSTEM HALTED", VIEW_W / 2, VIEW_H / 2);
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, s, img, spec, now, ZONES[rc.zone.cur].name);

  // 배너 (해금, 피버, 퀴즈 결과)
  if (s.banner) {
    const age = now - s.banner.at;
    if (age > 2600) s.banner = null;
    else {
      const alpha = Math.min(1, (2600 - age) / 400);
      const pop = Math.max(0, 1 - age / 250);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(VIEW_W / 2, 140);
      ctx.scale(1 + pop * 0.25, 1 + pop * 0.25);
      ctx.font = `17px ${FONT_KR}`;
      const w = Math.max(220, ctx.measureText(s.banner.text).width + 40);
      ctx.fillStyle = "rgba(8,13,26,0.92)";
      ctx.strokeStyle = s.banner.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = s.banner.color;
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(-w / 2, -20, w, 40, 20); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = s.banner.color;
      ctx.textAlign = "center";
      ctx.fillText(s.banner.text, 0, 6);
      ctx.restore();
    }
  }
}
