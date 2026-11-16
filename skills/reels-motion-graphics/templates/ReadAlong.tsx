// 어린이 영어: 그림책 장면 읽어주기 → 파닉스 → 그림 고르기 퀴즈   (v3: 내용은 하나, 스타일은 skin 으로)
//
//   --props='{"channel":"kids-english","skin":"storybook"}'   그림책 (노을 → 푸른 저녁 → 달밤)
//   --props='{"channel":"kids-english","skin":"doodle"}'      모눈 공책 마커 낙서 + 픽셀아트 + 게임 UI
//   skin: "chalk" | "neon" 도 가능. 새 스타일은 kidsSkins.tsx 의 SKINS 에 추가.
//
// 준비: python3 tools/synth_bgm.py --mood bright --bpm 100 --seconds 22 --out public/kids_bgm.wav
//       python3 tools/synth_sfx.py --out public/sfx
// 내레이션: TTS 연결 시 words[].at(초) + narration 파일. 없으면 자동 배분 + 자막만.
import React, { useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { HandDefs, rnd, wobblyCircle, wobblyRect } from "./handdrawn";
import { Phase, Pose, PropName, PropView, SKINS, Skin, WordMark } from "./kidsSkins";

export type ReadAlongProps = {
  skin: string;
  words: { text: string; prop?: PropName; at?: number }[];
  scene: PropName[];
  vocab: { word: string; sounds: string[]; ipa?: string[]; prop: PropName };
  quiz: { question: string; choices: PropName[]; answer: PropName };
  narration?: string;
  bgm?: string;
  sfx: boolean;
};
export const readAlongDefaults: ReadAlongProps = {
  skin: "storybook",
  words: [
    { text: "The" }, { text: "little" }, { text: "cat", prop: "cat" }, { text: "plays" }, { text: "with" }, { text: "a" },
    { text: "red" }, { text: "ball", prop: "ball" }, { text: "under" }, { text: "the" }, { text: "big" }, { text: "sun.", prop: "sun" },
  ],
  scene: ["tree", "cat", "ball"],
  vocab: { word: "cat", sounds: ["c", "a", "t"], ipa: ["/k/", "/æ/", "/t/"], prop: "cat" },
  quiz: { question: "Which one is the cat?", choices: ["fish", "cat", "tree"], answer: "cat" },
  bgm: "kids_bgm.wav",
  sfx: true,
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function timeline(p: ReadAlongProps) {
  let acc = 1.2; const auto: number[] = [];
  p.words.forEach((w) => { auto.push(acc); acc += 0.26 + w.text.replace(/[^a-z]/gi, "").length * 0.065 + (/[.,!?]$/.test(w.text) ? 0.4 : 0); });
  const at = p.words.map((w, i) => w.at ?? auto[i]);
  const readEnd = Math.max(acc, at[at.length - 1] + 0.6) + 0.6;
  const phon = readEnd + 0.9, tile = (i: number) => phon + 0.4 + i * 0.75;
  const merge = tile(p.vocab.sounds.length - 1) + 0.9, quiz = merge + 1.8, tap = quiz + 2.8, end = tap + 3.0;
  return { at, readEnd, phon, tile, merge, quiz, tap, end };
}
export const readAlongDuration = (p: ReadAlongProps, fps = 30) => Math.ceil(timeline(p).end * fps);
/** 주요 순간(초): 쇼릴·썸네일에서 '이 순간' 을 고를 때 */
export const readAlongMoments = (p: ReadAlongProps) => { const T = timeline(p); return { reading: T.at[Math.min(3, T.at.length - 1)] + 0.2, phonicsMerged: T.merge + 0.6, quizSolved: T.tap + 1.0 }; };

function jump(k: number, height = 80): Pose {
  if (k < 0 || k > 0.9) return { y: 0, sx: 1, sy: 1 };
  if (k < 0.12) { const q = k / 0.12; return { y: 0, sx: 1 + 0.1 * q, sy: 1 - 0.12 * q }; }
  if (k < 0.62) { const q = (k - 0.12) / 0.5; return { y: -height * Math.sin(q * Math.PI), sx: 0.95, sy: 1.07 }; }
  const q = (k - 0.62) / 0.28, d = Math.sin(q * Math.PI) * (1 - q); return { y: 0, sx: 1 + 0.14 * d, sy: 1 - 0.15 * d };
}

export const ReadAlong: React.FC<ReadAlongProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const T = timeline(p);
  const skin: Skin = SKINS[p.skin] ?? SKINS.storybook;
  const dark = skin.id === "chalk" || skin.id === "neon";

  // 시간대 가중치 [읽기, 파닉스, 퀴즈] — 배경이 서서히 바뀐다
  const toPhon = interpolate(t, [T.readEnd, T.phon], [0, 1], { ...clamp, easing: easeInOut });
  const toQuiz = interpolate(t, [T.merge + 0.8, T.quiz], [0, 1], { ...clamp, easing: easeInOut });
  const w: [number, number, number] = [(1 - toPhon), toPhon * (1 - toQuiz), toQuiz];
  const phase: Phase = t < T.readEnd + 0.4 ? 0 : t < T.merge + 1.2 ? 1 : 2;

  // ── 글자 배치 (canvas measureText, DOM 을 읽지 않음) ──
  const FS = 74, LH = 100, GAP = 30, PADX = 48, PADY = 20, cardW = W - 440;
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("read font"));
  useLayoutEffect(() => { document.fonts.load(`600 ${FS}px Lexend`).finally(() => { setReady(true); continueRender(handle); }); }, [handle]);
  const layout = useMemo(() => {
    if (!ready) return null;
    const ctx = document.createElement("canvas").getContext("2d")!; ctx.font = `600 ${FS}px ${skin.font.read}`;
    const maxW = cardW - PADX * 2, items: { x: number; line: number; w: number }[] = []; let x = 0, line = 0;
    p.words.forEach((wd) => { const ww = ctx.measureText(wd.text).width; if (x > 0 && x + ww > maxW) { line++; x = 0; } items.push({ x, line, w: ww }); x += ww + GAP; });
    const lw: number[] = []; items.forEach((it) => { lw[it.line] = it.x + it.w; });
    return { rects: items.map((it) => ({ x: PADX + (maxW - lw[it.line]) / 2 + it.x, y: PADY + it.line * LH, w: it.w, h: LH })), height: PADY * 2 + (line + 1) * LH };
  }, [ready, p.words, cardW, skin.font.read]);
  const cur = T.at.reduce((k, a, i) => (t >= a ? i : k), -1);
  const hitAt = (n: PropName) => { let h: number | undefined; p.words.forEach((wd, i) => { if (wd.prop === n && t >= T.at[i]) h = T.at[i]; }); return h; };

  // ── 소리 ──
  const sfx: React.ReactNode[] = [];
  const S = (sec: number, n: string, v = 0.6) => { if (p.sfx) sfx.push(<Sequence key={`${n}-${sec.toFixed(3)}`} from={Math.max(0, Math.round(sec * fps))} durationInFrames={50} layout="none"><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>); };
  p.scene.forEach((_, i) => S(0.2 + i * 0.15 + 0.35, "pop", 0.3));
  p.words.forEach((wd, i) => { if (wd.prop) S(T.at[i] + 0.05, "pop", 0.45); });

  // ── 그림: 장면 속 위치 → 파닉스/퀴즈에서도 같은 고양이가 이어진다 ──
  const slots: Record<PropName, [number, number, number]> = { tree: [0.16, 0.6, 300], cat: [0.42, 0.66, 250], ball: [0.6, 0.74, 120], sun: [0.8, 0.22, 200], fish: [0.3, 0.7, 180] };
  const sceneFade = 1 - toPhon;
  const props = p.scene.map((n, i) => {
    const [sx, sy, sz] = slots[n], st = 0.2 + i * 0.15;
    const drop = interpolate(t, [st, st + 0.35], [-H * 0.6, 0], { ...clamp, easing: Easing.in(Easing.quad) });
    const land = t - st - 0.35, ls = land > 0 && land < 0.3 ? Math.sin((land / 0.3) * Math.PI) * (1 - land / 0.3) : 0;
    let pose: Pose = { y: drop, sx: 1 + 0.14 * ls, sy: 1 - 0.15 * ls };
    const h = hitAt(n); let dx = 0;
    if (n === "cat" && h !== undefined && phase === 0) pose = jump((t - h) / 0.9);
    if (n === "ball" && h !== undefined) dx = 160 * interpolate(t - h, [0, 0.9], [0, 1], { ...clamp, easing: easeOut });
    if (n === "cat") { // 파닉스: 왼쪽으로 걸어가 글자를 올려다봄 / 퀴즈: 왼쪽 아래
      const mv = interpolate(t, [T.readEnd, T.phon], [0, 1], { ...clamp, easing: easeInOut });
      const mv2 = interpolate(t, [T.merge + 0.8, T.quiz], [0, 1], { ...clamp, easing: easeInOut });
      const x = lerp(lerp(sx * W, W * 0.2, mv), W * 0.12, mv2), y = lerp(sy * H, H * 0.68, mv);
      const hop = t > T.merge + 0.4 && t < T.merge + 1.3 ? jump((t - T.merge - 0.4) / 0.9, 60) : t > T.tap + 0.4 && t < T.tap + 1.3 ? jump((t - T.tap - 0.4) / 0.9, 70) : null;
      const walk = (mv > 0 && mv < 1) || (mv2 > 0 && mv2 < 1) ? { y: -Math.abs(Math.sin(t * 14)) * 10, sx: 1, sy: 1 } : null;
      return { n, x: x - sz / 2, y: y - sz / 2, sz, pose: hop ?? walk ?? pose, alpha: t >= st ? 1 : 0, happy: (t > T.merge + 0.4 && t < T.quiz) || t > T.tap + 0.3 };
    }
    return { n, x: sx * W - sz / 2 + dx, y: sy * H - sz / 2, sz, pose, alpha: (t >= st ? 1 : 0) * sceneFade, happy: false };
  });

  // ── 읽기 카드 ──
  const cardIn = interpolate(t, [0.7, 1.1], [0, 1], { ...clamp, easing: easeOut });
  const cardOut = interpolate(t, [T.readEnd, T.readEnd + 0.4], [1, 0], clamp);
  const card = layout && cardOut > 0 && (
    <div style={{ position: "absolute", left: (W - cardW) / 2, width: cardW, bottom: 70, height: layout.height, opacity: cardIn * cardOut, transform: `translateY(${(1 - cardIn) * 50}px)` }}>
      {skin.card === "paper" && <svg width={cardW} height={layout.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}><path d={wobblyRect(0, 0, cardW, layout.height, 26, 2, 2)} fill="rgba(252,247,236,0.93)" filter="url(#hd-wobble)" stroke={skin.ink} strokeOpacity={0.35} strokeWidth={2.5} /></svg>}
      {skin.card === "highlighter" && <svg width={cardW} height={layout.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}><path d={wobblyRect(0, 0, cardW, layout.height, 8, 4, 3)} fill="rgba(255,255,255,0.75)" stroke="#2B2B33" strokeWidth={4} /></svg>}
      {cur >= 0 && (() => { const r = layout.rects[cur], k = interpolate(t - T.at[cur], [0, 0.22], [0, 1], { ...clamp, easing: easeOut }); return <WordMark skin={skin} x={r.x} y={r.y} w={r.w} h={r.h} k={k} seed={cur + 3} />; })()}
      {p.words.map((wd, i) => {
        const wi = interpolate(t, [0.8 + i * 0.03, 1.1 + i * 0.03], [0, 1], { ...clamp, easing: easeOut }), on = i === cur, done = i < cur, r = layout.rects[i];
        const lift = on ? interpolate(t - T.at[i], [0, 0.12, 0.3], [0, -7, -3], clamp) : 0;
        const glow = skin.id === "neon" && (on || done) ? `0 0 12px ${skin.ink}, 0 0 26px ${skin.ink}` : skin.id === "chalk" ? "0 0 2px rgba(255,255,255,0.6)" : "none";
        return <span key={i} style={{ position: "absolute", left: r.x, top: r.y, height: LH, lineHeight: `${LH}px`, fontFamily: skin.font.read, fontSize: FS, fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "-0.01em",
          color: on ? skin.text.current : done ? skin.text.done : skin.text.todo, textShadow: glow, transform: `translateY(${(1 - wi) * 18 + lift}px)`, opacity: wi }}>{wd.text}</span>;
      })}
    </div>
  );

  // ── ② 파닉스 타일 (스타일마다 다른 카드) ──
  const n = p.vocab.sounds.length;
  const mergeK = interpolate(t, [T.merge, T.merge + 0.45], [0, 1], { ...clamp, easing: easeInOut });
  const phonAlpha = interpolate(t, [T.phon - 0.2, T.phon + 0.3, T.quiz - 0.6, T.quiz - 0.1], [0, 1, 1, 0], clamp);
  for (let i = 0; i < n; i++) S(T.tile(i), "pop", 0.5);
  S(T.merge + 0.45, "ding", 0.5);
  const TW = 200, TH = 240, tx0 = W * 0.42;
  const neonCols = ["#FF4FD8", "#3DF2FF", "#FFD23D"];
  const tiles = phonAlpha > 0 && (
    <div style={{ position: "absolute", left: tx0, top: H * 0.24, opacity: phonAlpha }}>
      {skin.tile === "holo" && (
        <svg width={n * (TW + 40)} height={TH + 80} style={{ position: "absolute", left: 0, top: -30, overflow: "visible", opacity: 1 - mergeK }}>
          {[...Array(n - 1)].map((_, i) => <line key={i} x1={i * (TW + 40) + TW / 2} y1={-10 + (i % 2) * 20} x2={(i + 1) * (TW + 40) + TW / 2} y2={-10 + ((i + 1) % 2) * 20} stroke="#DFF8FF" strokeWidth={2} opacity={t > T.tile(i + 1) ? 0.8 : 0} style={{ filter: "drop-shadow(0 0 6px #BFF3FF)" }} />)}
        </svg>
      )}
      <div style={{ display: "flex", gap: lerp(40, skin.tile === "holo" ? 6 : 0, mergeK) }}>
        {p.vocab.sounds.map((s, i) => {
          const st = T.tile(i), e = spring({ frame: frame - Math.round(st * fps), fps, config: { damping: 12, stiffness: 170 } }), on = t >= st;
          const tilt = skin.tile === "sticky" ? (rnd(i + 4) - 0.5) * 10 * (1 - mergeK) : 0;
          const common: React.CSSProperties = { width: TW, height: TH, display: "grid", placeItems: "center", opacity: on ? 1 : 0, transform: `translateY(${(1 - e) * 60}px) rotate(${tilt}deg) scale(${0.75 + 0.25 * e})`, position: "relative" };
          const letter = (style: React.CSSProperties) => <div style={{ fontSize: 170, lineHeight: 1, marginTop: 10, ...style }}>{s}</div>;
          if (skin.tile === "holo") return (
            <div key={i} style={{ ...common, borderRadius: 26, background: "linear-gradient(160deg, rgba(235,250,255,0.28), rgba(200,235,255,0.10))", border: "2px solid rgba(225,250,255,0.85)",
              boxShadow: "0 0 24px rgba(170,235,255,0.55), inset 0 0 30px rgba(200,245,255,0.25)" }}>
              <div style={{ position: "absolute", top: 12, left: 16, display: "flex", gap: 6 }}>{[0, 1, 2].map((d) => <div key={d} style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(225,250,255,0.8)" }} />)}</div>
              {letter({ fontFamily: skin.font.read, fontWeight: 700, color: "#FFFFFF", textShadow: "0 0 18px rgba(190,240,255,0.9)" })}
              {p.vocab.ipa && <div style={{ position: "absolute", bottom: 14, fontFamily: skin.font.display, fontStyle: "italic", fontSize: 34, color: "#E6FAFF", opacity: 1 - mergeK }}>{p.vocab.ipa[i]}</div>}
            </div>);
          if (skin.tile === "sticky") return (
            <div key={i} style={{ ...common, background: ["#FFE45C", "#9EE6A0", "#9EC9FF", "#FFB3C7"][i % 4], boxShadow: "6px 8px 0 rgba(43,43,51,0.18)", filter: "url(#hd-wobble)" }}>
              {letter({ fontFamily: skin.font.note, fontWeight: 700, color: "#2B2B33", fontSize: 190 })}
              {p.vocab.ipa && <div style={{ position: "absolute", bottom: 10, fontFamily: skin.font.display, fontSize: 26, color: "#2B2B33", opacity: 1 - mergeK }}>{p.vocab.ipa[i]}</div>}
            </div>);
          if (skin.tile === "chalkbox") return (
            <div key={i} style={common}>
              <svg width={TW} height={TH} style={{ position: "absolute", inset: 0, opacity: 1 - mergeK }}><path d={wobblyRect(6, 6, TW - 12, TH - 12, 14, i + 2, 2.5)} fill="none" stroke="#F3F6F2" strokeWidth={4} filter="url(#hd-pencil)" /></svg>
              {letter({ fontFamily: skin.font.note, fontWeight: 700, color: i === 0 ? "#FFE58A" : "#F3F6F2", fontSize: 190 })}
              {p.vocab.ipa && <div style={{ position: "absolute", bottom: 6, fontFamily: skin.font.note, fontSize: 40, color: "#CFE0D6", opacity: 1 - mergeK }}>{p.vocab.ipa[i]}</div>}
            </div>);
          return (
            <div key={i} style={common}>
              {letter({ fontFamily: skin.font.read, fontWeight: 700, color: "#FFFFFF", textShadow: `0 0 8px ${neonCols[i % 3]}, 0 0 24px ${neonCols[i % 3]}, 0 0 48px ${neonCols[i % 3]}` })}
            </div>);
        })}
      </div>
      {mergeK > 0 && [...Array(16)].map((_, i) => { const k = t - T.merge - 0.45; if (k < 0 || k > 1) return null; const a = (i / 16) * Math.PI * 2, d = 80 + 300 * easeOut(Math.min(1, k / 0.7));
        return <div key={i} style={{ position: "absolute", left: (n * TW) / 2 + Math.cos(a) * d * 1.3, top: TH / 2 + Math.sin(a) * d * 0.7, width: 10, height: 10, borderRadius: 5,
          background: skin.id === "doodle" ? ["#E8572F", "#2F6FE4", "#3FA34D", "#F6C431"][i % 4] : skin.id === "chalk" ? "#F3F6F2" : "#FFF6C2", boxShadow: skin.id === "doodle" ? "none" : "0 0 12px #FFF3A6", opacity: 1 - k }} />; })}
    </div>
  );

  // ── ③ 퀴즈 ──
  const qIn = interpolate(t, [T.quiz - 0.3, T.quiz + 0.4], [0, 1], { ...clamp, easing: easeOut });
  const ansIdx = p.quiz.choices.indexOf(p.quiz.answer), wrongIdx = (ansIdx + p.quiz.choices.length - 1) % p.quiz.choices.length;
  const box = 300, cardX = (i: number) => W * 0.56 + (i - (p.quiz.choices.length - 1) / 2) * (box + 70), cardY = H * 0.56;
  const curPos = (tt: number) => ({
    x: interpolate(tt, [T.quiz + 0.5, T.quiz + 1.2, T.tap - 0.9, T.tap - 0.15], [W * 0.15, cardX(wrongIdx), cardX(wrongIdx), cardX(ansIdx)], { ...clamp, easing: easeInOut }) + (tt > T.quiz + 1.2 && tt < T.tap - 0.9 ? Math.sin(tt * 7) * 18 : 0),
    y: interpolate(tt, [T.quiz + 0.5, T.quiz + 1.2, T.tap - 0.9, T.tap - 0.15], [H * 0.6, cardY - 30, cardY - 30, cardY - 20], { ...clamp, easing: easeInOut }) + Math.sin(tt * 9) * 6,
  });
  const { x: cx, y: cy } = curPos(t);
  const ring = interpolate(t, [T.tap + 0.05, T.tap + 0.5], [0, 1], { ...clamp, easing: easeInOut });
  const praiseK = spring({ frame: frame - Math.round((T.tap + 0.45) * fps), fps, config: { damping: 11, stiffness: 140 } });
  S(T.tap, "click", 0.7); S(T.tap + 0.05, "ding", 0.6);
  const quiz = qIn > 0 && (
    <div style={{ position: "absolute", inset: 0, opacity: qIn }}>
      <div style={{ position: "absolute", top: H * 0.12, width: "100%", textAlign: "center", fontFamily: skin.id === "doodle" ? skin.font.note : skin.font.display,
        fontStyle: skin.id === "storybook" ? "italic" : "normal", fontWeight: 600, fontSize: skin.id === "doodle" ? 96 : skin.id === "chalk" ? 92 : 84,
        color: skin.id === "doodle" ? "#2B2B33" : "#FFFFFF", textShadow: skin.id === "storybook" ? "0 0 24px rgba(255,240,200,0.45)" : skin.id === "neon" ? "0 0 14px #FF4FD8, 0 0 30px #FF4FD8" : "none" }}>
        {p.quiz.question}
      </div>
      {p.quiz.choices.map((c, i) => {
        const e = spring({ frame: frame - Math.round((T.quiz + 0.1 + i * 0.12) * fps), fps, config: { damping: 12, stiffness: 150 } });
        const correct = i === ansIdx, dim = ring > 0 && !correct ? 0.45 : 1, near = Math.abs(cx - cardX(i)) < 40 && t < T.tap;
        const frameEl = (() => {
          if (skin.quizFrame === "lantern") return <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,240,190,0.38), rgba(255,240,190,0.08) 62%, rgba(255,240,190,0) 72%)", boxShadow: correct && ring > 0 ? `0 0 ${60 * ring}px rgba(255,236,160,0.8)` : "none" }} />;
          if (skin.quizFrame === "itembox") return <svg width={box} height={box} style={{ position: "absolute", inset: 0 }}><path d={wobblyRect(8, 8, box - 16, box - 16, 6, i + 5, 2.5)} fill="#FFFFFF" stroke="#2B2B33" strokeWidth={6} /><path d={wobblyRect(18, 18, box - 36, box - 36, 4, i + 9, 2)} fill="none" stroke="#2B2B33" strokeOpacity={0.25} strokeWidth={3} /></svg>;
          if (skin.quizFrame === "chalkring") return <svg width={box} height={box} style={{ position: "absolute", inset: 0 }}><path d={wobblyCircle(box / 2, box / 2, box / 2 - 12, i + 3, 0.06)} fill="none" stroke="#F3F6F2" strokeWidth={4} opacity={0.7} filter="url(#hd-pencil)" /></svg>;
          return <div style={{ position: "absolute", inset: 10, borderRadius: 30, border: `5px solid ${neonCols[i % 3]}`, boxShadow: `0 0 16px ${neonCols[i % 3]}, inset 0 0 16px ${neonCols[i % 3]}` }} />;
        })();
        return (
          <div key={c} style={{ position: "absolute", left: cardX(i) - box / 2, top: cardY - box / 2, width: box, height: box, opacity: dim,
            transform: `translateY(${(1 - e) * 120 + Math.sin(t * 1.6 + i * 2) * 6}px) scale(${e * (near ? 1.05 : 1)})` }}>
            {frameEl}
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><PropView skin={skin} name={c} size={box * 0.72} happy={correct && ring > 0.9} shadow={false} seed={i + 20} /></div>
            {correct && ring > 0 && (
              <svg width={box + 60} height={box + 60} style={{ position: "absolute", left: -30, top: -30, overflow: "visible" }}>
                <path d={skin.quizFrame === "itembox" ? wobblyRect(10, 10, box + 40, box + 40, 10, 7, 3) : wobblyCircle((box + 60) / 2, (box + 60) / 2, box / 2 + 18, 9, 0.05)} fill="none"
                  stroke={skin.accent} strokeWidth={skin.id === "doodle" ? 12 : 8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring}
                  style={{ filter: dark || skin.id === "storybook" ? `drop-shadow(0 0 10px ${skin.accent})` : "none" }} />
              </svg>
            )}
          </div>
        );
      })}
      {t < T.tap + 0.7 && (() => {
        if (skin.cursor === "firefly" || skin.cursor === "spark") {
          const col = skin.cursor === "firefly" ? "#FFF3A6" : "#3DF2FF";
          return <>{[...Array(6)].map((_, k) => { const q = curPos(t - k * 0.05);
            return <div key={k} style={{ position: "absolute", left: q.x - 8 + k, top: q.y - 8, width: 16 - k * 2, height: 16 - k * 2, borderRadius: "50%", background: col, opacity: (1 - k / 6) * (k ? 0.5 : 1), boxShadow: k ? "none" : `0 0 18px ${col}, 0 0 40px ${col}` }} />; })}</>;
        }
        if (skin.cursor === "pixelhand") return <svg style={{ position: "absolute", left: cx - 10, top: cy - 4 }} width={60} height={70} viewBox="0 0 12 14">
          <path d="M3 0h2v6h1V4h2v3h1V5h2v6l-1 3H4L1 9V7h2z" fill="#FFFFFF" stroke="#2B2B33" strokeWidth={0.9} shapeRendering="crispEdges" /></svg>;
        return <div style={{ position: "absolute", left: cx - 12, top: cy - 12, width: 24, height: 24, borderRadius: "50%", background: "#F3F6F2", opacity: 0.85 }} />;
      })()}
      {praiseK > 0.01 && (
        <div style={{ position: "absolute", top: H * 0.82, width: "100%", textAlign: "center", transform: `scale(${praiseK})`,
          fontFamily: skin.id === "chalk" ? skin.font.note : skin.font.display, fontStyle: skin.id === "storybook" ? "italic" : "normal",
          fontWeight: skin.id === "doodle" ? 700 : 600, fontSize: skin.id === "doodle" ? 92 : 96,
          color: skin.id === "doodle" ? "#3FA34D" : skin.id === "neon" ? "#FFFFFF" : skin.id === "chalk" ? "#FFE58A" : "#FFF2CF",
          textShadow: skin.id === "doodle" ? "6px 6px 0 #2B2B33" : skin.id === "neon" ? "0 0 14px #3DF2FF, 0 0 32px #3DF2FF" : skin.id === "storybook" ? "0 0 28px rgba(255,230,160,0.7)" : "none" }}>
          {skin.praise}
        </div>
      )}
    </div>
  );

  const boil = skin.id === "doodle" || skin.id === "chalk" ? Math.floor(frame / 4) % 3 : 0; // 낙서·분필은 선이 살짝 '보글'
  const Hud = skin.Hud;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <HandDefs boil={boil} />
      {p.bgm && <Audio src={staticFile(p.bgm)} volume={(f) => interpolate(f, [0, 10, T.end * fps - 30, T.end * fps], [0, 0.4, 0.4, 0], clamp)} />}
      {p.narration && <Audio src={staticFile(p.narration)} />}
      {sfx}
      <skin.Background W={W} H={H} w={w} t={t} />
      {props.map((q) => q.alpha > 0 && (
        <div key={q.n} style={{ position: "absolute", left: q.x, top: q.y, opacity: q.alpha }}>
          <PropView skin={skin} name={q.n} size={q.sz} pose={q.pose} happy={q.happy} seed={7} />
        </div>
      ))}
      {card}
      {tiles}
      {quiz}
      {Hud && <Hud W={W} H={H} phase={phase} t={t} wordIndex={phase === 0 ? cur : p.words.length - 1} words={p.words.length} correct={ring > 0.5} />}
    </AbsoluteFill>
  );
};
