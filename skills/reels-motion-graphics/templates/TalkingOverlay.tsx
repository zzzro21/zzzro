// 토킹 영상 오버레이 — 직접 찍은 영상 위에 '얹는' 그래픽 (레퍼런스 original_45 의 A 유형)
//
// 출력 2가지
//  1) 투명 배경 (캡컷 등에서 내 영상 위 레이어로):
//     npx remotion render src/index.ts TalkingOverlay out/overlay.mov --props='{"channel":"instagram"}' \
//       --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png
//  2) 내 영상과 합성한 완성본: props.video = "my/clip.mp4" (public/ 기준)
//
// 얼굴 보호: props.face (화면 비율 0~1 사각형) 안에는 그래픽을 두지 않는다. 자막 위치는 captionArea 로.
// 자막: captions = [{ t: 초, text: "단어" }] — 캡컷·Vrew 자막(SRT)의 시간을 그대로. *단어* 는 강조.
import React, { useLayoutEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "./fonts";
import { HandDefs, wobblyRect } from "./handdrawn";
import { SAFE } from "./brand";
import { Widget, WidgetView, WIDGET_TYPES } from "./InfoWidgets";

type Ev =
  | { type: "search"; at: number; dur: number; query: string; suggestions?: string[] }
  | { type: "sticker"; at: number; dur: number; kind: "cloud" | "fire" | "heart" | "star"; x: number; y: number; size?: number }
  | { type: "stamp"; at: number; dur: number; text: string; x: number; y: number; color?: string }
  | { type: "bubble"; at: number; dur: number; text: string; x: number; y: number; think?: boolean }
  | { type: "burst"; at: number; dur: number; text: string; x: number; y: number }
  | { type: "like"; at: number }        // 하트 카운터 +1
  | { type: "label"; at: number; dur: number; text: string }
  | Widget;                             // 정보 위젯 8종 (InfoWidgets.tsx)
export type TalkingOverlayProps = {
  video?: string;                         // 내 영상 (없으면 투명)
  videoBlur?: number;                     // 미리보기용 흐림
  face: { x: number; y: number; w: number; h: number };
  captionArea: "lower" | "left" | "right";
  captions: { t: number; text: string }[];
  captionMode?: "words" | "phrase";       // words: 단어씩 / phrase: 구절 통째로 (한국 토킹 릴스 스타일)
  captionStyle?: "pop" | "pinkpop";       // pinkpop: 흰 글자 + 핵심어는 압축 글꼴 분홍·빛번짐
  captionY?: number;                      // 자막 높이 (0~1), 기본 0.6
  widgetY?: number;                       // 위젯 높이 (0~1), 기본 자막 아래
  widgetX?: number;                       // 위젯 가로 중심 (0~1), 기본 0.46 (오른쪽 인스타 버튼 열 피함)
  widgetScale?: number;                   // 위젯 크기 배율, 기본 1.4
  scrim?: boolean;                        // 자막·위젯 뒤 옅은 어두운 띠 (밝은 배경·흰 옷에서 글자 살리기). phrase 모드 기본 켬
  events: Ev[];
  accent: string;                         // 강조 단어 색
  counterLabel: string;
  progress: boolean;
  sfx: boolean;
};

export const talkingOverlayDefaults: TalkingOverlayProps = {
  face: { x: 0.28, y: 0.12, w: 0.44, h: 0.36 },
  captionArea: "lower",
  accent: "#C8F560",
  counterLabel: "저장",
  progress: true,
  sfx: true,
  captions: (() => {
    const words = ["릴스", "조회수가", "안", "나오는", "이유,", "*훅*", "때문이에요.", "첫", "*1초*", "안에", "궁금하게", "만들어야", "해요.", "어떻게", "하냐면요,", "*숫자*로", "시작하세요."];
    let t = 0.4; return words.map((w, i) => { const r = { t, text: w }; t += 0.32 + (w.length * 0.03) + (/[,.]$/.test(w) ? 0.35 : 0) + (i === 6 ? 0.6 : 0); return r; });
  })(),
  events: [
    { type: "label", at: 0.2, dur: 11, text: "TIP 01 · 첫 1초" },
    { type: "search", at: 0.6, dur: 2.6, query: "릴스 조회수 올리는 법", suggestions: ["릴스 조회수 올리는 법 2026", "릴스 훅 문장", "릴스 알고리즘"] },
    { type: "stamp", at: 2.2, dur: 1.4, text: "핵심!", x: 0.78, y: 0.56 },
    { type: "like", at: 2.3 }, { type: "like", at: 4.0 }, { type: "like", at: 5.6 },
    { type: "sticker", at: 3.6, dur: 2.4, kind: "fire", x: 0.84, y: 0.2 },
    { type: "bubble", at: 5.0, dur: 2.0, text: "근데 어떤 훅?", x: 0.2, y: 0.18, think: true },
    { type: "burst", at: 7.3, dur: 1.6, text: "3초!", x: 0.8, y: 0.44 },
  ],
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pop = (frame: number, fps: number, at: number, damping = 10) => spring({ frame: frame - Math.round(at * fps), fps, config: { damping, stiffness: 210, mass: 0.7 } });
const live = (t: number, at: number, dur: number) => t >= at && t < at + dur;
const outK = (t: number, at: number, dur: number) => interpolate(t, [at + dur - 0.2, at + dur], [1, 0], clamp);

const Sticker: React.FC<{ kind: "cloud" | "fire" | "heart" | "star"; s: number }> = ({ kind, s }) => {
  const outline = { stroke: "#FFFFFF", strokeWidth: 14, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };
  const body = {
    cloud: <g><path d="M-80 30 Q-110 30 -105 0 Q-100 -35 -60 -30 Q-50 -75 0 -70 Q45 -72 55 -35 Q100 -45 105 -5 Q110 32 75 32 Z" fill="#FFFFFF" {...outline} /><path d="M-35 -2 q10 10 20 0 M15 -2 q10 10 20 0" stroke="#5B4B66" strokeWidth={5} fill="none" strokeLinecap="round" /><ellipse cx={-50} cy={12} rx={12} ry={7} fill="#FFB8C8" /><ellipse cx={50} cy={12} rx={12} ry={7} fill="#FFB8C8" /></g>,
    fire: <g><path d="M0 -95 Q35 -50 30 -20 Q55 -40 55 -70 Q95 -20 75 30 Q60 85 0 90 Q-60 85 -75 30 Q-90 -20 -45 -55 Q-45 -25 -25 -15 Q-35 -60 0 -95 Z" fill="#FF7A2F" {...outline} /><path d="M0 -20 Q25 10 20 40 Q12 70 0 72 Q-12 70 -20 40 Q-25 10 0 -20 Z" fill="#FFD23D" /></g>,
    heart: <path d="M0 80 Q-95 15 -90 -35 Q-80 -85 -30 -80 Q-8 -78 0 -50 Q8 -78 30 -80 Q80 -85 90 -35 Q95 15 0 80 Z" fill="#FF4F7B" {...outline} />,
    star: <path d="M0 -95 L25 -30 L95 -28 L40 15 L60 85 L0 45 L-60 85 L-40 15 L-95 -28 L-25 -30 Z" fill="#FFD23D" {...outline} />,
  }[kind];
  return <svg width={240 * s} height={240 * s} viewBox="-120 -120 240 240" style={{ overflow: "visible", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))" }}>{body}</svg>;
};

export const TalkingOverlay: React.FC<TalkingOverlayProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H, durationInFrames } = useVideoConfig();
  const t = frame / fps, u = W / 1080; // 1080 기준 크기 비율
  const [handle] = useState(() => delayRender("overlay font"));
  useLayoutEffect(() => {
    const txt = p.captions.map((c) => c.text).join("") + JSON.stringify(p.events);
    Promise.all([document.fonts.load(`900 80px Pretendard`, txt), document.fonts.load(`800 80px Pretendard`, txt), document.fonts.load(`400 80px 'Black Han Sans'`, txt), document.fonts.load(`400 80px 'Do Hyeon'`, txt)]).finally(() => continueRender(handle));
  }, [handle, p.captions, p.events]);

  // ── 자막: 3~4단어씩 묶어 한 덩어리, 단어가 말하는 순간 하나씩 등장 ──
  const groups: { t: number; text: string }[][] = [];
  p.captions.forEach((c, i) => { const g = groups[groups.length - 1]; const gap = i > 0 ? c.t - p.captions[i - 1].t : 0; // 말 사이가 0.9초 넘게 비면 새 덩어리
    const breakHere = !g || g.length >= 4 || gap > 0.9 || /[.,!?]$/.test(p.captions[i - 1]?.text ?? ""); breakHere ? groups.push([c]) : g.push(c); });
  const gi = groups.findLastIndex((g) => t >= g[0].t);
  const grp = gi >= 0 ? groups[gi] : null;
  const grpEnd = gi >= 0 ? (groups[gi + 1]?.[0].t ?? grp![grp!.length - 1].t + 1.2) : 0;
  const capBox = p.captionArea === "lower" ? { left: SAFE.left, right: SAFE.right, top: H * 0.6, align: "center" as const }
    : p.captionArea === "left" ? { left: SAFE.left, right: W * (1 - p.face.x) + 20 * u, top: H * 0.3, align: "left" as const }
    : { left: W * (p.face.x + p.face.w) + 20 * u, right: SAFE.right, top: H * 0.3, align: "left" as const };
  const captions = grp && t < grpEnd + 0.05 && (
    <div style={{ position: "absolute", left: capBox.left, right: capBox.right, top: capBox.top, textAlign: capBox.align, lineHeight: 1.12 }}>
      {grp.map((c, i) => {
        if (t < c.t) return null;
        const em = /^\*.*\*/.test(c.text), word = c.text.replace(/\*/g, "");
        const k = pop(frame, fps, c.t, em ? 8 : 14);
        return (
          <span key={i} style={{ display: "inline-block", margin: `0 ${10 * u}px`, fontFamily: em ? FONTS.pop : FONTS.ko, fontWeight: em ? 400 : 900,
            fontSize: (em ? 132 : 86) * u, color: em ? p.accent : "#FFFFFF", letterSpacing: "-0.02em",
            textShadow: `0 ${4 * u}px ${14 * u}px rgba(0,0,0,0.55), 0 0 ${2 * u}px rgba(0,0,0,0.6)`,
            transform: `translateY(${(1 - k) * 30 * u}px) scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 1.5) }}>{word}</span>
        );
      })}
    </div>
  );

  // ── 구절 자막 (phrase 모드): 말하는 구절 전체를 한 번에, *핵심어* 는 강조 ──
  let phraseEl: React.ReactNode = null;
  if (p.captionMode === "phrase") {
    const pi = p.captions.findLastIndex((c) => t >= c.t);
    const ph = pi >= 0 ? p.captions[pi] : null, phEnd = pi >= 0 ? (p.captions[pi + 1]?.t ?? ph!.t + 2) : 0;
    if (ph && t < phEnd) {
      const k = pop(frame, fps, ph.t, 13), pink = p.accent;
      const parts = ph.text.split(/(\*[^*]+\*)/).filter(Boolean);
      phraseEl = (
        <div style={{ position: "absolute", left: 40 * u, right: 150 * u, top: H * (p.captionY ?? 0.56), textAlign: "center", transform: `scale(${0.92 + 0.08 * k})`, opacity: Math.min(1, k * 2), whiteSpace: "pre-wrap" }}>
          {parts.map((part, i) => {
            const em = part.startsWith("*");
            const txt = em ? part.slice(1, -1) : part;
            return p.captionStyle === "pinkpop" ? (
              <span key={i} style={{ fontFamily: em ? FONTS.tall : FONTS.ko, fontWeight: em ? 400 : 800, fontSize: (em ? 140 : 88) * u, lineHeight: 1.15, color: em ? pink : "#FFFFFF",
                WebkitTextStroke: em ? `${3 * u}px #FFFFFF` : `${1.2 * u}px rgba(0,0,0,0.35)`, paintOrder: "stroke fill",
                textShadow: em ? `0 0 ${16 * u}px ${pink}, 0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.5)` : `0 ${3 * u}px ${10 * u}px rgba(0,0,0,0.65)`,
                display: "inline-block", transform: em ? `translateY(${(1 - k) * 18 * u}px)` : undefined }}>{txt}</span>
            ) : (
              <span key={i} style={{ fontFamily: em ? FONTS.pop : FONTS.ko, fontWeight: em ? 400 : 900, fontSize: (em ? 120 : 84) * u, color: em ? pink : "#FFFFFF", textShadow: `0 ${4 * u}px ${14 * u}px rgba(0,0,0,0.55)` }}>{txt}</span>
            );
          })}
        </div>
      );
    }
  }

  // ── 이벤트 ──
  const likes = p.events.filter((e) => e.type === "like").map((e) => e.at);
  const likeCount = likes.filter((a) => t >= a).length, lastLike = likes.filter((a) => t >= a).pop();
  const els: React.ReactNode[] = [];
  const sounds: React.ReactNode[] = [];
  const S = (at: number, n: string, v = 0.6) => { if (p.sfx) sounds.push(<Sequence key={`${n}${at}`} from={Math.round(at * fps)} durationInFrames={40} layout="none"><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>); };
  p.events.forEach((e, idx) => {
    if (e.type === "like") { S(e.at, "pop", 0.5); return; }
    if (WIDGET_TYPES.includes(e.type)) { // 정보 위젯: 자막 아래 가운데
      const wd = e as Widget;
      S(wd.at, wd.type === "comment" ? "click" : "pop", 0.45);
      if (!live(t, wd.at, wd.dur)) return;
      const o = outK(t, wd.at, wd.dur);
      els.push(<div key={idx} style={{ position: "absolute", left: W * (wd.x ?? p.widgetX ?? 0.46), top: H * (p.widgetY ?? ((p.captionY ?? 0.56) + 0.09)), transform: "translateX(-50%)",
        opacity: o, filter: o < 1 ? `blur(${(1 - o) * 10 * u}px)` : undefined }}>
        <WidgetView w={wd} t={t} frame={frame} fps={fps} u={u * (p.widgetScale ?? 1.4)} pink={p.accent} /></div>);
      return;
    }
    S(e.at, e.type === "stamp" ? "stamp" : e.type === "search" ? "click" : "pop", 0.55);
    if (!live(t, e.at, e.dur)) return;
    const k = pop(frame, fps, e.at), o = outK(t, e.at, e.dur);
    if (e.type === "search") {
      const typed = [...e.query].slice(0, Math.floor(interpolate(t, [e.at + 0.2, e.at + 0.2 + e.query.length * 0.07], [0, e.query.length], clamp))).join("");
      const drop = interpolate(t, [e.at + 0.3 + e.query.length * 0.07, e.at + 0.6 + e.query.length * 0.07], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      for (let i = 0; i < e.query.length; i += 2) S(e.at + 0.2 + i * 0.07, "tick", 0.25);
      els.push(
        <div key={idx} style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 10 * u, width: W * 0.62, opacity: o, transform: `scale(${0.8 + 0.2 * k})`, transformOrigin: "left top" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 * u, background: "#FFFFFF", borderRadius: 60 * u, padding: `${22 * u}px ${30 * u}px`, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            <svg width={40 * u} height={40 * u} viewBox="0 0 24 24"><circle cx={10} cy={10} r={6.5} stroke="#555" strokeWidth={2.4} fill="none" /><path d="M15 15 L21 21" stroke="#555" strokeWidth={2.4} strokeLinecap="round" /></svg>
            <span style={{ fontFamily: FONTS.ko, fontWeight: 600, fontSize: 44 * u, color: "#222" }}>{typed}<span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span></span>
          </div>
          {e.suggestions && drop > 0 && (
            <div style={{ marginTop: 10 * u, background: "#FFFFFF", borderRadius: 24 * u, padding: `${10 * u}px 0`, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", clipPath: `inset(0 0 ${(1 - drop) * 100}% 0)` }}>
              {e.suggestions.map((s, i) => <div key={i} style={{ fontFamily: FONTS.ko, fontWeight: 500, fontSize: 34 * u, color: "#444", padding: `${10 * u}px ${30 * u}px`, display: "flex", gap: 16 * u, alignItems: "center" }}><span style={{ opacity: 0.4 }}>⌕</span>{s}</div>)}
            </div>
          )}
        </div>);
    } else if (e.type === "sticker") {
      const s = (e.size ?? 1) * u * 1.3;
      els.push(<div key={idx} style={{ position: "absolute", left: e.x * W - 120 * s, top: e.y * H - 120 * s, opacity: o, transform: `scale(${k}) rotate(${(1 - k) * -30 + Math.sin(t * 3) * 4}deg) translateY(${Math.sin(t * 2.4) * 8}px)` }}><Sticker kind={e.kind} s={s} /></div>);
    } else if (e.type === "stamp") {
      const slam = interpolate(t, [e.at, e.at + 0.12], [1.8, 1], { ...clamp, easing: Easing.in(Easing.quad) }), col = e.color ?? "#E8333A";
      els.push(<svg key={idx} width={420 * u} height={200 * u} viewBox="0 0 420 200" style={{ position: "absolute", left: e.x * W - 210 * u, top: e.y * H - 100 * u, opacity: o * (t >= e.at ? 1 : 0), transform: `scale(${slam}) rotate(-10deg)`, overflow: "visible" }}>
        <path d={wobblyRect(14, 24, 392, 152, 14, idx + 3, 3)} fill="none" stroke={col} strokeWidth={14} filter="url(#hd-marker)" />
        <text x={210} y={128} textAnchor="middle" fontFamily={FONTS.pop} fontSize={104} fill={col} filter="url(#hd-marker)">{e.text}</text>
      </svg>);
    } else if (e.type === "bubble") {
      const bw = 520 * u, bh = 190 * u;
      els.push(<div key={idx} style={{ position: "absolute", left: e.x * W - bw / 2, top: e.y * H - bh / 2, width: bw, height: bh, opacity: o, transform: `scale(${k})`, transformOrigin: "50% 100%" }}>
        <svg width={bw} height={bh + 90 * u} style={{ position: "absolute", inset: 0, overflow: "visible", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.25))" }}>
          <ellipse cx={bw / 2} cy={bh / 2} rx={bw / 2 - 6} ry={bh / 2 - 6} fill="#FFFFFF" stroke="#1E1E24" strokeWidth={6 * u} />
          {e.think ? [[0.62, 1.12, 18], [0.7, 1.32, 11]].map(([x, y, r], i) => <circle key={i} cx={bw * x} cy={bh * y} r={r * u} fill="#FFFFFF" stroke="#1E1E24" strokeWidth={5 * u} />)
            : <path d={`M${bw * 0.55} ${bh - 12} L${bw * 0.68} ${bh + 70 * u} L${bw * 0.7} ${bh - 18}`} fill="#FFFFFF" stroke="#1E1E24" strokeWidth={6 * u} strokeLinejoin="round" />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: FONTS.ko, fontWeight: 800, fontSize: 54 * u, color: "#1E1E24" }}>{e.text}</div>
      </div>);
    } else if (e.type === "burst") {
      const pts = [...Array(24)].map((_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 150 : 210; return `${Math.cos(a) * r},${Math.sin(a) * r * 0.85}`; }).join(" ");
      els.push(<svg key={idx} width={460 * u} height={420 * u} viewBox="-230 -210 460 420" style={{ position: "absolute", left: e.x * W - 230 * u, top: e.y * H - 210 * u, opacity: o, transform: `scale(${k}) rotate(${(1 - k) * 40 - 8}deg)`, overflow: "visible" }}>
        <polygon points={pts} fill="#FFE03D" stroke="#1E1E24" strokeWidth={10} strokeLinejoin="round" />
        <text x={0} y={36} textAnchor="middle" fontFamily={FONTS.pop} fontSize={120} fill="#E8333A" stroke="#1E1E24" strokeWidth={8} paintOrder="stroke">{e.text}</text>
      </svg>);
    } else if (e.type === "label") {
      els.push(<div key={idx} style={{ position: "absolute", right: SAFE.right, bottom: SAFE.bottom - 20 * u, opacity: o * k, padding: `${12 * u}px ${22 * u}px`, borderRadius: 10 * u, background: "rgba(15,15,20,0.72)", border: "1px solid rgba(255,255,255,0.25)",
        fontFamily: FONTS.ko, fontWeight: 600, fontSize: 30 * u, letterSpacing: "0.08em", color: "#FFFFFF" }}>{e.text}</div>);
    }
  });

  const likeK = lastLike !== undefined ? pop(frame, fps, lastLike, 8) : 0;
  return (
    <AbsoluteFill style={{ background: p.video ? "#000" : "transparent" }}>
      <HandDefs />
      {p.video && <OffthreadVideo src={staticFile(p.video)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: p.videoBlur ? `blur(${p.videoBlur}px) brightness(0.9)` : undefined }} />}
      {sounds}
      {(p.scrim ?? p.captionMode === "phrase") && (() => { const y0 = (p.captionY ?? 0.56) - 0.05, y1 = (p.widgetY ?? ((p.captionY ?? 0.56) + 0.09)) + 0.2;
        return <div style={{ position: "absolute", left: 0, right: 0, top: H * y0, height: H * (y1 - y0), background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.32) 25%, rgba(0,0,0,0.32) 70%, rgba(0,0,0,0) 100%)", pointerEvents: "none" }} />; })()}
      {els}
      {p.captionMode === "phrase" ? phraseEl : captions}
      {likes.length > 0 && (
        <div style={{ position: "absolute", right: SAFE.right, top: SAFE.top, display: "flex", alignItems: "center", gap: 12 * u, padding: `${10 * u}px ${20 * u}px`, borderRadius: 40 * u, background: "rgba(15,15,20,0.72)", transform: `scale(${1 + 0.15 * Math.sin(Math.min(1, likeK) * Math.PI)})` }}>
          <svg width={40 * u} height={40 * u} viewBox="-100 -100 200 200"><path d="M0 80 Q-95 15 -90 -35 Q-80 -85 -30 -80 Q-8 -78 0 -50 Q8 -78 30 -80 Q80 -85 90 -35 Q95 15 0 80 Z" fill="#FF4F7B" /></svg>
          <span style={{ fontFamily: FONTS.ko, fontWeight: 800, fontSize: 40 * u, color: "#FFF" }}>{likeCount}</span>
          <span style={{ fontFamily: FONTS.ko, fontWeight: 500, fontSize: 24 * u, color: "rgba(255,255,255,0.7)" }}>{p.counterLabel}</span>
        </div>
      )}
      {p.progress && <div style={{ position: "absolute", left: 0, bottom: 0, height: 10 * u, width: `${(frame / durationInFrames) * 100}%`, background: "#E8333A" }} />}
      {/* 얼굴 영역 표시는 렌더에 나오지 않음 (개발용으로 보고 싶으면 아래 주석 해제) */}
      {/* <div style={{ position: "absolute", left: p.face.x * W, top: p.face.y * H, width: p.face.w * W, height: p.face.h * H, border: "4px dashed red" }} /> */}
    </AbsoluteFill>
  );
};
export const talkingOverlayDuration = (p: TalkingOverlayProps, fps = 30) => Math.ceil((Math.max(p.captions[p.captions.length - 1]?.t ?? 0, ...p.events.map((e) => e.at + ("dur" in e ? e.dur : 0))) + 1.5) * fps);
