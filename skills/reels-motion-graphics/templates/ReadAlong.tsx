// 어린이 영어: 그림책 장면 읽어주기 → 파닉스 → 그림 고르기 퀴즈   (v2: 퀄리티 패스)
// 그림·소리 전부 코드 (이미지 에셋 0). 채널: --props='{"channel":"kids-english"}' (1920x1080, 앱 색)
//
// v1 → v2 에서 바꾼 것 (= 'craft-checklist.md' 의 실제 적용 예)
//  · 글꼴을 프로젝트에 포함 (fonts.ts) — v1 은 렌더 PC 에 글꼴이 없어 Inter 로 대체돼 있었다
//  · 깊이: 하늘 그라데이션, 먼 언덕/가까운 언덕 패럴랙스, 흘러가는 구름, 그림자, 종이 질감, 비네팅
//  · 카메라: 천천히 밀기 + 장면 전환은 '고양이로 줌인' (페이드 대신 연속성)
//  · 연기: 숨쉬기(idle), 점프 전 웅크림(anticipation) → 점프 → 착지 찌그러짐, 공은 굴러가고 해는 빛남
//  · 하이라이트: 단어마다 켜지는 대신 '한 개의 알약' 이 단어를 따라 미끄러짐 (실측 위치)
//  · 파닉스: 타일이 뒤집혀 나오고 → 미끄러져 합쳐지며 반짝
//  · 퀴즈: 탭 커서가 망설였다가 정답을 누름 → 링 + 색종이 + 칭찬
//  · 소리: 밝은 장조 BGM(synth_bgm.py --mood bright) + 모든 '착지' 에 효과음
//
// 준비: python3 tools/synth_bgm.py --mood bright --bpm 100 --seconds 22 --out public/kids_bgm.wav
//       python3 tools/synth_sfx.py --out public/sfx
// 내레이션: TTS 연결 시 words[].at(초) 에 단어 시각 + narration 파일. 없으면 자동 배분 + 자막만.
import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, Sequence, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./brand";
import { FONTS } from "./fonts";

type PropName = "cat" | "sun" | "tree" | "ball" | "fish";
export type ReadAlongProps = {
  words: { text: string; prop?: PropName; at?: number }[];
  scene: PropName[];
  vocab: { word: string; sounds: string[]; ipa?: string[]; prop: PropName };
  quiz: { question: string; choices: PropName[]; answer: PropName; praise: string };
  narration?: string;
  bgm?: string;
  sfx: boolean;
};

export const readAlongDefaults: ReadAlongProps = {
  words: [
    { text: "The" }, { text: "little" }, { text: "cat", prop: "cat" }, { text: "plays" }, { text: "with" }, { text: "a" },
    { text: "red" }, { text: "ball", prop: "ball" }, { text: "under" }, { text: "the" }, { text: "big" }, { text: "sun.", prop: "sun" },
  ],
  scene: ["sun", "tree", "cat", "ball"],
  vocab: { word: "cat", sounds: ["c", "a", "t"], ipa: ["/k/", "/æ/", "/t/"], prop: "cat" },
  quiz: { question: "Which one is the cat?", choices: ["fish", "cat", "tree"], answer: "cat", praise: "Great job!" },
  bgm: "kids_bgm.wav",
  sfx: true,
};

const INK = "#2B2D42";
const C = { orange: "#FF8A3D", blue: "#3DA5FF", green: "#5CC96B", yellow: "#FFC83D", purple: "#B07CFF", red: "#FF5A5A" };
const TILE = [C.orange, C.blue, C.green, C.purple, C.yellow];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);      // 빠르게 나와서 부드럽게 멈춤
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rand = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ── 타임라인 (초) ──
function timeline(p: ReadAlongProps) {
  const start = 1.1;
  let acc = start;
  const auto: number[] = [];
  p.words.forEach((w) => { auto.push(acc); acc += 0.24 + w.text.replace(/[^a-z]/gi, "").length * 0.065 + (/[.,!?]$/.test(w.text) ? 0.4 : 0); });
  const at = p.words.map((w, i) => w.at ?? auto[i]);
  const readEnd = Math.max(acc, at[at.length - 1] + 0.6) + 0.5;
  const zoom = readEnd, phon = zoom + 1.0;
  const tile = (i: number) => phon + 0.5 + i * 0.75;
  const merge = tile(p.vocab.sounds.length - 1) + 0.9;
  const quiz = merge + 1.6;
  const tap = quiz + 2.6;
  const end = tap + 3.2;
  return { at, readEnd, zoom, phon, tile, merge, quiz, tap, end };
}
export const readAlongDuration = (p: ReadAlongProps, fps = 30) => Math.ceil(timeline(p).end * fps);

// ── 점프 연기: 웅크림 → 점프 → 착지 찌그러짐 ──
function jump(k: number, height = 90) {
  if (k < 0 || k > 0.9) return { y: 0, sx: 1, sy: 1 };
  if (k < 0.12) { const q = k / 0.12; return { y: 0, sx: 1 + 0.12 * q, sy: 1 - 0.14 * q }; }          // 웅크림
  if (k < 0.62) { const q = (k - 0.12) / 0.5; return { y: -height * Math.sin(q * Math.PI), sx: 0.94, sy: 1.08 }; } // 체공 (늘어남)
  const q = (k - 0.62) / 0.28; const d = Math.sin(q * Math.PI) * (1 - q);                                  // 착지
  return { y: 0, sx: 1 + 0.16 * d, sy: 1 - 0.18 * d };
}

// ── 그림 (코드로 그림, 두꺼운 외곽선 + 하이라이트/음영 그라데이션) ──
const Defs = () => (
  <defs>
    {Object.entries(C).map(([k, v]) => (
      <radialGradient key={k} id={`g-${k}`} cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
        <stop offset="35%" stopColor={v} />
        <stop offset="100%" stopColor={v} stopOpacity={1} />
      </radialGradient>
    ))}
    <linearGradient id="g-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.18} /></linearGradient>
  </defs>
);
const Art: React.FC<{ name: PropName; t: number; glow?: number; spin?: number }> = ({ name, t, glow = 0, spin = 0 }) => {
  const sw = 7;
  switch (name) {
    case "sun":
      return (
        <g>
          <circle r={95 + glow * 30} fill={C.yellow} opacity={0.18 + glow * 0.25} />
          {[...Array(12)].map((_, i) => (
            <rect key={i} x={-8} y={-104 - glow * 10} width={16} height={34} rx={8} fill={C.yellow} stroke={INK} strokeWidth={5} transform={`rotate(${i * 30 + t * 12})`} />
          ))}
          <circle r={60} fill="url(#g-yellow)" stroke={INK} strokeWidth={sw} />
          <circle cx={-20} cy={-6} r={7} fill={INK} /><circle cx={20} cy={-6} r={7} fill={INK} />
          <circle cx={-34} cy={12} r={9} fill={C.orange} opacity={0.5} /><circle cx={34} cy={12} r={9} fill={C.orange} opacity={0.5} />
          <path d="M-20 16 Q0 34 20 16" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
        </g>
      );
    case "tree": {
      const sway = Math.sin(t * 1.3) * 2.5;
      return (
        <g>
          <path d="M-18 10 Q-14 60 -22 92 H22 Q14 60 18 10 Z" fill="#A86B3C" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <g transform={`rotate(${sway} 0 20)`}>
            {[[-46, 2, 42], [46, 2, 42], [0, -36, 62], [-24, -70, 34], [28, -66, 36]].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="url(#g-green)" stroke={INK} strokeWidth={sw} />
            ))}
            <ellipse cx={0} cy={-14} rx={70} ry={44} fill={C.green} />
            <circle cx={-20} cy={-30} r={7} fill={C.red} stroke={INK} strokeWidth={4} /><circle cx={26} cy={-6} r={7} fill={C.red} stroke={INK} strokeWidth={4} />
          </g>
        </g>
      );
    }
    case "cat": {
      const blink = Math.floor(t * 30) % 96 < 4;
      const tail = Math.sin(t * 4) * 14;
      return (
        <g>
          <path d={`M58 52 Q${104 + tail} 18 ${84 + tail * 0.6} -24`} stroke={INK} strokeWidth={20} fill="none" strokeLinecap="round" />
          <path d={`M58 52 Q${104 + tail} 18 ${84 + tail * 0.6} -24`} stroke={C.orange} strokeWidth={8} fill="none" strokeLinecap="round" />
          <ellipse cx={0} cy={44} rx={64} ry={48} fill="url(#g-orange)" stroke={INK} strokeWidth={sw} />
          <ellipse cx={0} cy={56} rx={34} ry={26} fill="#FFE1C7" />
          <polygon points="-54,-40 -40,-96 -12,-56" fill={C.orange} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <polygon points="54,-40 40,-96 12,-56" fill={C.orange} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <polygon points="-44,-50 -38,-80 -22,-58" fill="#FFB3C1" /><polygon points="44,-50 38,-80 22,-58" fill="#FFB3C1" />
          <circle cx={0} cy={-30} r={55} fill="url(#g-orange)" stroke={INK} strokeWidth={sw} />
          <path d="M-14 -82 q4 14 0 22 M0 -84 v24 M14 -82 q-4 14 0 22" stroke="#D96A20" strokeWidth={5} strokeLinecap="round" fill="none" />
          {blink
            ? <><path d="M-30 -36 h20" stroke={INK} strokeWidth={6} strokeLinecap="round" /><path d="M10 -36 h20" stroke={INK} strokeWidth={6} strokeLinecap="round" /></>
            : <><ellipse cx={-20} cy={-36} rx={9} ry={11} fill={INK} /><ellipse cx={20} cy={-36} rx={9} ry={11} fill={INK} /><circle cx={-17} cy={-40} r={3.5} fill="#fff" /><circle cx={23} cy={-40} r={3.5} fill="#fff" /></>}
          <circle cx={-34} cy={-16} r={9} fill="#FF7A9A" opacity={0.45} /><circle cx={34} cy={-16} r={9} fill="#FF7A9A" opacity={0.45} />
          <path d="M-7 -20 L0 -13 L7 -20 Z" fill="#FF5A7A" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M0 -13 Q-8 -4 -14 -8 M0 -13 Q8 -4 14 -8" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
          {[-1, 1].map((d) => <path key={d} d={`M${d * 18} -16 L${d * 58} -24 M${d * 18} -10 L${d * 58} -6`} stroke={INK} strokeWidth={3} strokeLinecap="round" />)}
          <ellipse cx={-26} cy={86} rx={18} ry={11} fill={C.orange} stroke={INK} strokeWidth={5} /><ellipse cx={26} cy={86} rx={18} ry={11} fill={C.orange} stroke={INK} strokeWidth={5} />
        </g>
      );
    }
    case "ball":
      return (
        <g transform={`rotate(${spin})`}>
          <circle r={50} fill="url(#g-red)" stroke={INK} strokeWidth={sw} />
          <path d="M-50 0 Q0 34 50 0" stroke="#FFFFFF" strokeWidth={9} fill="none" />
          <path d="M0 -50 Q-30 0 0 50" stroke="#FFFFFF" strokeWidth={6} fill="none" opacity={0.7} />
        </g>
      );
    case "fish":
      return (
        <g>
          <polygon points="36,0 92,-38 92,38" fill="url(#g-blue)" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <ellipse cx={-12} cy={0} rx={66} ry={42} fill="url(#g-blue)" stroke={INK} strokeWidth={sw} />
          <path d="M-10 -40 Q10 -64 34 -36" fill={C.blue} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <circle cx={-44} cy={-8} r={9} fill={INK} /><circle cx={-41} cy={-11} r={3} fill="#fff" />
          <path d="M-20 -30 q10 30 0 60" stroke={INK} strokeWidth={4} fill="none" opacity={0.5} />
        </g>
      );
  }
};
const Figure: React.FC<{ name: PropName; size: number; t: number; j?: { y: number; sx: number; sy: number }; glow?: number; spin?: number; shadow?: boolean }> =
  ({ name, size, t, j = { y: 0, sx: 1, sy: 1 }, glow, spin, shadow = true }) => {
    const breathe = name === "cat" ? 1 + Math.sin(t * 3.2) * 0.012 : 1;
    const groundY = name === "sun" ? 999 : name === "ball" ? 50 : 96;
    return (
      <svg width={size} height={size} viewBox="-120 -120 240 240" style={{ overflow: "visible" }}>
        <Defs />
        {shadow && name !== "sun" && (
          <ellipse cx={0} cy={groundY + 8} rx={62 * (1 + j.y / 400)} ry={12 * (1 + j.y / 400)} fill="#000" opacity={0.16 * (1 + j.y / 300)} />
        )}
        <g transform={`translate(0 ${j.y}) translate(0 ${groundY}) scale(${j.sx} ${j.sy * breathe}) translate(0 ${-groundY})`}>
          <Art name={name} t={t} glow={glow} spin={spin} />
        </g>
      </svg>
    );
  };

const Cloud: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <svg style={{ position: "absolute", left: x, top: y, overflow: "visible" }} width={300 * s} height={140 * s} viewBox="0 0 300 140">
    <g fill="#FFFFFF" opacity={0.95}>
      <ellipse cx={150} cy={95} rx={130} ry={42} /><circle cx={105} cy={70} r={48} /><circle cx={170} cy={55} r={58} /><circle cx={225} cy={82} r={38} />
    </g>
  </svg>
);

export const ReadAlong: React.FC<ReadAlongProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const T = timeline(p);
  const kidsFont = FONTS.kids;

  // ── 단어 배치를 직접 계산 (글꼴 로딩 후 canvas measureText) ──
  // DOM 위치를 읽지 않는다: 렌더러가 배치 전에 읽으면 틀어지기 때문. 단어와 하이라이트가 같은 좌표를 쓰므로 항상 맞는다.
  const FS = 76, LH = 98, GAP = 32, PADX = 44, PADY = 22;
  const cardW = W - SAFE.left - SAFE.right - 120;
  const [fontReady, setFontReady] = useState(false);
  const [handle] = useState(() => delayRender("kids font"));
  useLayoutEffect(() => {
    document.fonts.load(`800 ${FS}px 'Baloo 2'`).then(() => { setFontReady(true); continueRender(handle); }).catch(() => { setFontReady(true); continueRender(handle); });
  }, [handle]);
  const layout = useMemo(() => {
    if (!fontReady) return null;
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `800 ${FS}px ${kidsFont}`;
    const maxW = cardW - PADX * 2;
    const items: { x: number; line: number; w: number }[] = [];
    let x = 0, line = 0;
    p.words.forEach((w) => { const ww = ctx.measureText(w.text).width; if (x > 0 && x + ww > maxW) { line++; x = 0; } items.push({ x, line, w: ww }); x += ww + GAP; });
    const lineW: number[] = [];
    items.forEach((it) => { lineW[it.line] = it.x + it.w; });
    return { rects: items.map((it) => ({ x: PADX + (maxW - lineW[it.line]) / 2 + it.x, y: PADY + it.line * LH, w: it.w, h: LH })), height: PADY * 2 + (line + 1) * LH };
  }, [fontReady, p.words, cardW, kidsFont]);
  const rects = layout?.rects ?? null;

  const cur = T.at.reduce((k, a, i) => (t >= a ? i : k), -1);
  const hitAt = (n: PropName) => { let h: number | undefined; p.words.forEach((w, i) => { if (w.prop === n && t >= T.at[i]) h = T.at[i]; }); return h; };

  // ── 소리 ──
  const sfx: React.ReactNode[] = [];
  const S = (sec: number, n: string, v = 0.6) => { if (p.sfx) sfx.push(<Sequence key={`${n}-${sec.toFixed(3)}`} from={Math.max(0, Math.round(sec * fps))} durationInFrames={50} layout="none"><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>); };

  // ── ① 장면 ──
  const camPush = interpolate(t, [0, T.zoom], [1.0, 1.06], clamp);
  const zoomK = interpolate(t, [T.zoom, T.zoom + 0.9], [0, 1], { ...clamp, easing: easeInOut });
  const sceneAlpha = interpolate(t, [T.zoom + 0.5, T.zoom + 0.9], [1, 0], clamp);
  const slots: Record<PropName, [number, number, number]> = { sun: [0.79, 0.2, 250], tree: [0.15, 0.47, 330], cat: [0.43, 0.54, 270], ball: [0.6, 0.61, 140], fish: [0.3, 0.6, 200] };
  const catX = slots.cat[0] * W, catY = slots.cat[1] * H;
  const drift = t * 18;
  const groundY = H * 0.66;

  p.scene.forEach((n, i) => S(0.15 + i * 0.12 + 0.35, "pop", 0.35));
  p.words.forEach((w, i) => { if (w.prop) S(T.at[i] + (w.prop === "cat" ? 0.55 : 0.05), w.prop === "cat" ? "hit" : "pop", w.prop === "cat" ? 0.35 : 0.5); });
  S(T.zoom + 0.1, "whoosh", 0.6);

  const scene = sceneAlpha > 0 && (
    <AbsoluteFill style={{ opacity: sceneAlpha, transformOrigin: `${catX}px ${catY}px`, transform: `scale(${camPush * lerp(1, 2.8, zoomK)})` }}>
      {/* 하늘 */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #8ED3FF 0%, #CDEBFF 55%, #FFF3D6 100%)" }} />
      <div style={{ position: "absolute", left: slots.sun[0] * W - 260, top: slots.sun[1] * H - 260, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,226,120,0.55), rgba(255,226,120,0) 70%)" }} />
      {/* 구름 (느린 패럴랙스) */}
      <Cloud x={((120 + drift * 0.6) % (W + 400)) - 200} y={90} s={1.0} />
      <Cloud x={((900 + drift * 0.35) % (W + 400)) - 200} y={170} s={0.7} />
      <Cloud x={((1500 + drift * 0.5) % (W + 400)) - 200} y={60} s={0.85} />
      {/* 먼 언덕 / 가까운 언덕 */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `translateX(${-drift * 0.25}px)` }}>
        <path d={`M-100 ${groundY - 30} Q ${W * 0.25} ${groundY - 150} ${W * 0.55} ${groundY - 60} T ${W + 200} ${groundY - 90} V ${H} H -100 Z`} fill="#A8DB8F" />
      </svg>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `translateX(${-drift * 0.5}px)` }}>
        <defs><linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8FD172" /><stop offset="1" stopColor="#6DBA55" /></linearGradient></defs>
        <path d={`M-100 ${groundY} Q ${W * 0.4} ${groundY - 50} ${W * 0.7} ${groundY + 10} T ${W + 200} ${groundY - 10} V ${H} H -100 Z`} fill="url(#hill)" />
        {[...Array(40)].map((_, i) => { const x = rand(i) * (W + 200) - 100, y = groundY + 30 + rand(i + 50) * (H - groundY - 60); return <path key={i} d={`M${x} ${y} l-6 -14 M${x} ${y} l0 -18 M${x} ${y} l6 -14`} stroke="#5AA545" strokeWidth={4} strokeLinecap="round" />; })}
      </svg>
      {/* 그림들: 떨어져 착지하며 등장 */}
      {p.scene.map((n, i) => {
        const [sx, sy, sz] = slots[n];
        const st = 0.15 + i * 0.12;
        const drop = interpolate(t, [st, st + 0.35], [-H * 0.5, 0], { ...clamp, easing: Easing.in(Easing.quad) });
        const land = t - st - 0.35;
        const landSquash = land > 0 && land < 0.3 ? Math.sin((land / 0.3) * Math.PI) * (1 - land / 0.3) : 0;
        let j = { y: drop, sx: 1 + 0.15 * landSquash, sy: 1 - 0.17 * landSquash };
        const h = hitAt(n);
        let glow = 0, spin = 0, dx = 0;
        if (n === "cat" && h !== undefined) j = jump((t - h) / 0.9);
        if (n === "ball" && h !== undefined) { const k = interpolate(t - h, [0, 0.9], [0, 1], { ...clamp, easing: easeOut }); dx = 150 * k; spin = 330 * k; }
        if (n === "sun" && h !== undefined) glow = Math.exp(-(t - h) * 2.5) * (1 + Math.sin((t - h) * 12) * 0.2);
        if (n === "sun") j = { ...j, y: j.y + Math.sin(t * 1.5) * 6 };
        return (
          <div key={n} style={{ position: "absolute", left: sx * W - sz / 2 + dx, top: sy * H - sz / 2, opacity: t >= st ? 1 : 0 }}>
            <Figure name={n} size={sz} t={t} j={j} glow={glow} spin={spin} />
          </div>
        );
      })}
    </AbsoluteFill>
  );

  // 읽기 카드: 단어는 순서대로 살짝 올라오며 등장, 하이라이트 알약 하나가 단어를 따라감
  const cardIn = interpolate(t, [0.6, 1.0], [0, 1], { ...clamp, easing: easeOut });
  const cardOut = interpolate(t, [T.zoom, T.zoom + 0.35], [1, 0], clamp);
  let pill: React.ReactNode = null;
  if (rects && rects.length === p.words.length && cur >= 0) {
    const k = interpolate(t - T.at[cur], [0, 0.16], [0, 1], { ...clamp, easing: easeOut });
    const a = rects[Math.max(0, cur - 1)], b = rects[cur];
    const r = cur === 0 ? b : { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) };
    const col = p.words[cur].prop ? TILE[cur % TILE.length] : BRAND.accent;
    pill = <div style={{ position: "absolute", left: r.x - 14, top: r.y + 12, width: r.w + 28, height: r.h - 18, borderRadius: 22, background: col, boxShadow: "0 6px 0 rgba(43,45,66,0.18)" }} />;
  }
  const card = layout && cardOut > 0 && (
    <div style={{ position: "absolute", left: SAFE.left + 60, width: cardW, bottom: SAFE.bottom + 30, height: layout.height, opacity: cardIn * cardOut,
      transform: `translateY(${(1 - cardIn) * 60}px)`, background: "#FFFFFF", borderRadius: 40, fontFamily: kidsFont,
      boxShadow: "0 14px 0 rgba(43,45,66,0.10), 0 30px 60px rgba(43,45,66,0.12)" }}>
      {pill}
      {p.words.map((w, i) => {
        const wi = interpolate(t, [0.7 + i * 0.03, 1.0 + i * 0.03], [0, 1], { ...clamp, easing: easeOut });
        const on = i === cur, done = i < cur;
        const lift = on ? interpolate(t - T.at[i], [0, 0.12, 0.3], [0, -8, -4], clamp) : 0;
        const r = layout.rects[i];
        return (
          <span key={i} style={{ position: "absolute", left: r.x, top: r.y, height: LH, lineHeight: `${LH}px`, fontSize: FS, fontWeight: 800, whiteSpace: "nowrap",
            color: on ? "#FFFFFF" : done ? INK : "#A3A5B8", transform: `translateY(${(1 - wi) * 20 + lift}px)`, opacity: wi }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );

  // ── ② 파닉스 ──
  const n = p.vocab.sounds.length;
  const phonIn = interpolate(t, [T.zoom + 0.55, T.zoom + 1.0], [0, 1], { ...clamp, easing: easeOut });
  const phonOut = interpolate(t, [T.quiz - 0.5, T.quiz - 0.1], [1, 0], clamp);
  const mergeK = interpolate(t, [T.merge, T.merge + 0.45], [0, 1], { ...clamp, easing: easeInOut });
  for (let i = 0; i < n; i++) S(T.tile(i), "pop", 0.55);
  S(T.merge + 0.45, "ding", 0.55);
  const phonics = t >= T.zoom + 0.5 && t < T.quiz && (
    <AbsoluteFill style={{ opacity: Math.min(phonIn, phonOut) }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 30% 50%, #FFE7C7 0%, #FFF6E5 55%, #FFEFD9 100%)" }} />
      {/* 고양이: 줌인된 위치(화면 중앙)에서 왼쪽 자리로 이동 → 연속성 */}
      {(() => {
        const k = interpolate(t, [T.zoom + 0.6, T.phon + 0.4], [0, 1], { ...clamp, easing: easeInOut });
        const size = lerp(720, 440, k), x = lerp(W / 2, W * 0.25, k), y = lerp(H / 2, H * 0.5, k);
        const j = mergeK >= 1 ? jump((t - T.merge - 0.45) / 0.9, 70) : { y: 0, sx: 1, sy: 1 };
        return <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2 }}><Figure name={p.vocab.prop} size={size} t={t} j={j} /></div>;
      })()}
      {/* 타일 */}
      <div style={{ position: "absolute", left: W * 0.45, top: H * 0.5 - 150, display: "flex", gap: lerp(36, 0, mergeK), fontFamily: kidsFont }}>
        {p.vocab.sounds.map((s, i) => {
          const st = T.tile(i);
          const flip = interpolate(t, [st, st + 0.35], [90, 0], { ...clamp, easing: easeOut });
          const pop = spring({ frame: frame - Math.round(st * fps), fps, config: { damping: 11, stiffness: 190 } });
          const col = TILE[i % TILE.length];
          const tileBg = mergeK > 0 ? `color-mix(in srgb, ${col} ${100 - mergeK * 100}%, #FFFFFF)` : col;
          return (
            <div key={i} style={{ width: 210, height: 250, borderRadius: lerp(34, i === 0 ? 34 : 0, mergeK), background: tileBg, display: "grid", placeItems: "center",
              transform: `perspective(800px) rotateY(${flip}deg) scale(${0.7 + 0.3 * pop})`, opacity: t >= st ? 1 : 0,
              boxShadow: mergeK > 0.5 ? "none" : "0 12px 0 rgba(43,45,66,0.18)",
              borderTopRightRadius: i === n - 1 || mergeK < 0.5 ? 34 : 0, borderBottomRightRadius: i === n - 1 || mergeK < 0.5 ? 34 : 0,
              borderTopLeftRadius: i === 0 || mergeK < 0.5 ? 34 : 0, borderBottomLeftRadius: i === 0 || mergeK < 0.5 ? 34 : 0 }}>
              <div style={{ fontSize: 200, fontWeight: 800, lineHeight: 1, color: mergeK > 0.5 ? INK : "#FFFFFF", marginTop: 20 }}>{s}</div>
            </div>
          );
        })}
      </div>
      {/* 발음 기호 */}
      {p.vocab.ipa && (
        <div style={{ position: "absolute", left: W * 0.45, top: H * 0.5 + 125, display: "flex", gap: 36, fontFamily: kidsFont, opacity: 1 - mergeK }}>
          {p.vocab.ipa.map((s, i) => (
            <div key={i} style={{ width: 210, textAlign: "center", fontSize: 54, fontWeight: 600, color: TILE[i % TILE.length], opacity: t >= T.tile(i) + 0.2 ? 1 : 0 }}>{s}</div>
          ))}
        </div>
      )}
      {/* 합쳐질 때 반짝 */}
      {mergeK > 0 && [...Array(14)].map((_, i) => {
        const k = t - T.merge - 0.45; if (k < 0 || k > 0.9) return null;
        const a = (i / 14) * Math.PI * 2, d = 120 + 260 * easeOut(Math.min(1, k / 0.6));
        const cx = W * 0.45 + (210 * n) / 2, cy = H * 0.5 - 25;
        return <div key={i} style={{ position: "absolute", left: cx + Math.cos(a) * d * 1.3, top: cy + Math.sin(a) * d * 0.8, width: 18, height: 18, borderRadius: 4,
          background: TILE[i % TILE.length], transform: `rotate(${45 + k * 300}deg) scale(${1 - k})` }} />;
      })}
    </AbsoluteFill>
  );

  // ── ③ 퀴즈 ──
  const qIn = interpolate(t, [T.quiz - 0.2, T.quiz + 0.4], [0, 1], { ...clamp, easing: easeOut });
  const box = 330, gap = 90;
  const ansIdx = p.quiz.choices.indexOf(p.quiz.answer);
  const cardX = (i: number) => W / 2 + (i - (p.quiz.choices.length - 1) / 2) * (box + gap);
  const cardY = H * 0.58;
  // 커서: 들어와서 → 오답 위에서 망설임 → 정답으로 → 누름
  const wrongIdx = (ansIdx + p.quiz.choices.length - 1) % p.quiz.choices.length;
  const cx = interpolate(t, [T.quiz + 0.6, T.quiz + 1.3, T.tap - 0.9, T.tap - 0.15], [W * 0.85, cardX(wrongIdx), cardX(wrongIdx), cardX(ansIdx)], { ...clamp, easing: easeInOut });
  const cy = interpolate(t, [T.quiz + 0.6, T.quiz + 1.3, T.tap - 0.9, T.tap - 0.15], [H * 1.05, cardY + 40, cardY + 40, cardY + 30], { ...clamp, easing: easeInOut })
    + (t > T.quiz + 1.3 && t < T.tap - 0.9 ? Math.sin((t - T.quiz) * 9) * 6 : 0);
  const press = t >= T.tap && t < T.tap + 0.2 ? Math.sin(((t - T.tap) / 0.2) * Math.PI) : 0;
  const ring = interpolate(t, [T.tap + 0.05, T.tap + 0.5], [0, 1], { ...clamp, easing: easeInOut });
  const praise = spring({ frame: frame - Math.round((T.tap + 0.45) * fps), fps, config: { damping: 9, stiffness: 160 } });
  S(T.quiz, "whoosh", 0.4); S(T.tap, "click", 0.8); S(T.tap + 0.05, "ding", 0.6); S(T.tap + 0.45, "pop", 0.6);
  const quiz = t >= T.quiz - 0.2 && (
    <AbsoluteFill style={{ opacity: qIn }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FFF6E5 60%, #FFE8C9 100%)" }} />
      <div style={{ position: "absolute", top: H * 0.17, width: "100%", textAlign: "center", fontFamily: kidsFont, fontSize: 96, fontWeight: 800, color: INK,
        transform: `translateY(${(1 - qIn) * -40}px)` }}>
        {p.quiz.question.split(new RegExp(`(${p.vocab.word})`, "i")).map((part, i) =>
          part.toLowerCase() === p.vocab.word.toLowerCase() ? <span key={i} style={{ color: C.orange }}>{part}</span> : <span key={i}>{part}</span>)}
      </div>
      {p.quiz.choices.map((c, i) => {
        const e = spring({ frame: frame - Math.round((T.quiz + 0.1 + i * 0.12) * fps), fps, config: { damping: 12, stiffness: 150 } });
        const correct = i === ansIdx;
        const hover = Math.abs(cx - cardX(i)) < 40 && t < T.tap ? 1 : 0;
        const dim = ring > 0 && !correct ? 0.4 : 1;
        const s = e * (1 + hover * 0.04) * (correct ? 1 - press * 0.06 + (ring >= 1 ? Math.sin((t - T.tap) * 10) * 0.03 * Math.exp(-(t - T.tap) * 2) : 0) : 1);
        return (
          <div key={c} style={{ position: "absolute", left: cardX(i) - box / 2, top: cardY - box / 2, width: box, height: box, borderRadius: 48, background: "#FFFFFF",
            display: "grid", placeItems: "center", transform: `translateY(${(1 - e) * 120}px) scale(${s}) rotate(${hover ? Math.sin(t * 14) * 1.5 : 0}deg)`, opacity: dim,
            boxShadow: `0 ${14 - press * 8}px 0 rgba(43,45,66,0.14), 0 30px 60px rgba(43,45,66,0.10)` }}>
            <Figure name={c} size={box * 0.8} t={t} shadow={false} />
            {correct && ring > 0 && (
              <svg width={box + 80} height={box + 80} style={{ position: "absolute", left: -40, top: -40 }}>
                <rect x={14} y={14} width={box + 52} height={box + 52} rx={64} fill="none" stroke={C.green} strokeWidth={16} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} />
              </svg>
            )}
          </div>
        );
      })}
      {/* 탭 커서 + 물결 */}
      {t < T.tap + 0.6 && (
        <div style={{ position: "absolute", left: cx - 40, top: cy - 40, width: 80, height: 80 }}>
          {press > 0 || (t >= T.tap && t < T.tap + 0.6) ? (
            <div style={{ position: "absolute", inset: -((t - T.tap) * 160), borderRadius: "50%", border: `6px solid ${C.green}`, opacity: Math.max(0, 1 - (t - T.tap) / 0.6) }} />
          ) : null}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: `8px solid ${INK}`, transform: `scale(${1 - press * 0.25})`,
            boxShadow: "0 8px 0 rgba(43,45,66,0.2)" }} />
        </div>
      )}
      {/* 색종이 */}
      {ring > 0 && [...Array(60)].map((_, i) => {
        const k = t - T.tap - 0.05; if (k < 0 || k > 2.2) return null;
        const a = -Math.PI / 2 + (rand(i) - 0.5) * 2.2, v = 900 + rand(i + 7) * 900;
        const x = cardX(ansIdx) + Math.cos(a) * v * k * 0.6, y = cardY + Math.sin(a) * v * k * 0.6 + 900 * k * k;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 18, height: 30, borderRadius: 4, background: TILE[i % TILE.length],
          transform: `rotate(${rand(i + 3) * 360 + k * 600}deg) rotateX(${k * 900}deg)`, opacity: k > 1.6 ? 1 - (k - 1.6) / 0.6 : 1 }} />;
      })}
      {/* 칭찬 */}
      {praise > 0.01 && (
        <div style={{ position: "absolute", top: H * 0.82, width: "100%", textAlign: "center", fontFamily: kidsFont, fontSize: 110, fontWeight: 800, color: C.green,
          transform: `scale(${praise}) rotate(${(1 - praise) * -8}deg)`, textShadow: `0 8px 0 rgba(43,45,66,0.12)` }}>
          {p.quiz.praise} <span style={{ color: C.yellow }}>★★★</span>
        </div>
      )}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: "#FFF6E5", fontFamily: BRAND.font, overflow: "hidden" }}>
      {p.bgm && <Audio src={staticFile(p.bgm)} volume={(f) => interpolate(f, [0, 10, T.end * fps - 30, T.end * fps], [0, 0.45, 0.45, 0], clamp)} />}
      {p.narration && <Audio src={staticFile(p.narration)} />}
      {sfx}
      {scene}
      {card}
      {phonics}
      {quiz}
      {/* 종이 질감 + 비네팅 (전체 위에 아주 옅게) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", opacity: 0.18, pointerEvents: "none" }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} /><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0.9 0" /></filter>
        <rect width={W} height={H} filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(60,40,20,0.16) 100%)", pointerEvents: "none" }} />
      {/* 진행 점 */}
      <div style={{ position: "absolute", top: SAFE.top, right: SAFE.right, display: "flex", gap: 12 }}>
        {[0, T.phon, T.quiz].map((s0, i) => (
          <div key={i} style={{ width: t >= s0 ? 44 : 18, height: 18, borderRadius: 9, background: t >= s0 ? C.orange : "rgba(43,45,66,0.15)" }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
