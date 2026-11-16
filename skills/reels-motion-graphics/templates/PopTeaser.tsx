// 팝 티저 (본편 예고 릴스) — 레퍼런스 instagram_001 형식
// 9:16, 컷 약 1.5초(3박 @120BPM), 컷마다 배경색+무늬가 바뀌고, 굵은 외곽선 글자가 한 글자씩 튀어나옴.
// 구성 요소: 망점/사선 배경 · 외곽선+그림자 키네틱 타이틀(핵심어 색) · 기울어진 본편 썸네일 카드 · 아이콘 타일
//           · 원 링 · 반짝이 · 사선 와이프 전환 · (선택) 내 캐릭터 포즈 이미지 · 마지막 "본편은 ○○에서"
//
// 캐릭터: 직접 만든(소유한) 일러스트만. public/character/*.png 를 scenes[].pose 로 지정. 없으면 생략.
// 준비: python3 tools/synth_bgm.py --bpm 120 --seconds 12 --out public/teaser_bgm.wav ; python3 tools/synth_sfx.py --out public/sfx
import React, { useLayoutEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "./fonts";
import { SAFE } from "./brand";

type Line = { text: string; hl?: string; size?: number };
export type TeaserScene = {
  lines: Line[];
  bg: string;                       // 배경색
  pattern: "dots" | "stripes" | "plain";
  card?: string;                    // public/ 기준 이미지 (본편 썸네일·화면 캡처)
  icons?: boolean;                  // 그래프 아이콘 타일
  ring?: boolean;                   // 글자 뒤 원 링
  wipe?: boolean;                   // 사선 와이프로 들어오기
  pose?: string;                    // public/ 기준 캐릭터 이미지
  beats?: number;                   // 길이(박), 기본 3
};
export type PopTeaserProps = { scenes: TeaserScene[]; bpm: number; bgm?: string; ink: string; hlColors: string[]; sfx: boolean };

export const popTeaserDefaults: PopTeaserProps = {
  bpm: 120, bgm: "teaser_bgm.wav", ink: "#23213A", hlColors: ["#FFD84D", "#FF5C9A", "#7BE0C3"], sfx: true,
  scenes: [
    { lines: [{ text: "이 영상", hl: "영상" }], bg: "#FF6FA3", pattern: "dots", card: "teaser/thumb.png" },
    { lines: [{ text: "AI가", hl: "AI", size: 260 }, { text: "만들었다!" }], bg: "#FFD84D", pattern: "stripes" },
    { lines: [{ text: "편집 프로그램", size: 120 }, { text: "0개", hl: "0개", size: 240 }], bg: "#2A2745", pattern: "dots", ring: true },
    { lines: [{ text: "그래프도", hl: "그래프" }, { text: "자동으로" }], bg: "#7BE0C3", pattern: "dots", icons: true },
    { lines: [{ text: "전환까지", hl: "전환" }, { text: "전부!" }], bg: "#2A2745", pattern: "plain", wipe: true },
    { lines: [{ text: "방법은", size: 120 }, { text: "무료자료로", hl: "무료자료" }], bg: "#B9A4F2", pattern: "dots", card: "teaser/thumb.png", beats: 6 },
  ],
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const back = Easing.out(Easing.back(2.2));

const Pattern: React.FC<{ kind: TeaserScene["pattern"]; t: number; W: number; H: number }> = ({ kind, t, W, H }) => {
  if (kind === "plain") return null;
  if (kind === "dots") return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.22 }}>
      <defs><pattern id="pt-dots" width={34} height={34} patternUnits="userSpaceOnUse" patternTransform={`translate(${t * 20} ${t * 20})`}><circle cx={17} cy={17} r={5} fill="#FFFFFF" /></pattern></defs>
      <rect width={W} height={H} fill="url(#pt-dots)" />
    </svg>
  );
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
      <defs><pattern id="pt-str" width={120} height={120} patternUnits="userSpaceOnUse" patternTransform={`rotate(35) translate(${t * 60} 0)`}><rect width={60} height={120} fill="#FFFFFF" /></pattern></defs>
      <rect width={W} height={H} fill="url(#pt-str)" />
    </svg>
  );
};

/** 외곽선 + 떨어지는 그림자 글자, 한 글자씩 튀어나옴 */
const PopLine: React.FC<{ line: Line; start: number; ink: string; hl: string; fps: number; frame: number; maxW: number }> = ({ line, start, ink, hl, fps, frame, maxW }) => {
  const chars = [...line.text];
  // 한 줄이 화면 폭을 넘지 않게 자동 축소 (한글 한 글자 ≈ 0.98em, 공백 ≈ 0.3em, 외곽선 여유 포함)
  const em = chars.reduce((a, c) => a + (c === " " ? 0.3 : /[A-Za-z0-9!?]/.test(c) ? 0.62 : 0.98), 0) + 0.25;
  const size = Math.min(line.size ?? 190, maxW / em);
  const hlStart = line.hl ? line.text.indexOf(line.hl) : -1, hlEnd = hlStart + (line.hl?.length ?? 0);
  return (
    <div style={{ display: "flex", justifyContent: "center", lineHeight: 1.05, whiteSpace: "pre" }}>
      {chars.map((ch, i) => {
        const s = spring({ frame: frame - start - i * 2, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
        const isHl = i >= hlStart && i < hlEnd;
        return (
          <span key={i} style={{ display: "inline-block", fontFamily: FONTS.pop, fontSize: size, color: isHl ? hl : "#FFFFFF",
            WebkitTextStroke: `${Math.round(size * 0.075)}px ${ink}`, paintOrder: "stroke fill",
            textShadow: `0 ${Math.round(size * 0.06)}px 0 ${ink}`, transform: `translateY(${(1 - s) * 60}px) scale(${s}) rotate(${(1 - s) * -14}deg)`, opacity: s > 0.01 ? 1 : 0 }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const Sparkle: React.FC<{ x: number; y: number; s: number; c: string }> = ({ x, y, s, c }) => (
  <svg style={{ position: "absolute", left: x - 30 * s, top: y - 30 * s }} width={60 * s} height={60 * s} viewBox="-30 -30 60 60">
    <path d="M0 -28 Q4 -4 28 0 Q4 4 0 28 Q-4 4 -28 0 Q-4 -4 0 -28 Z" fill={c} stroke="#23213A" strokeWidth={3} />
  </svg>
);

export const PopTeaser: React.FC<PopTeaserProps> = ({ scenes, bpm, bgm, ink, hlColors, sfx }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps, beat = (60 / bpm) * fps;
  // 한글 글꼴은 글자 범위별로 나뉘어 있어서, 실제 쓰는 글자로 미리 불러와야 한다
  const [handle] = useState(() => delayRender("pop font"));
  useLayoutEffect(() => { document.fonts.load(`400 100px 'Black Han Sans'`, scenes.flatMap((s) => s.lines.map((l) => l.text)).join("")).finally(() => continueRender(handle)); }, [handle, scenes]);

  const starts: number[] = []; let acc = 0;
  scenes.forEach((s) => { starts.push(acc); acc += Math.round((s.beats ?? 3) * beat); });
  const idx = Math.max(0, starts.findLastIndex((s) => frame >= s));
  const sc = scenes[idx], st = starts[idx], local = frame - st, len = Math.round((sc.beats ?? 3) * beat);
  const hl = hlColors[idx % hlColors.length];

  const enter = interpolate(local, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const wipe = sc.wipe ? interpolate(local, [0, 7], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
  const exitZoom = interpolate(local, [len - 4, len], [1, 1.08], clamp);

  const sounds: React.ReactNode[] = [];
  if (sfx) starts.forEach((s, i) => {
    sounds.push(<Sequence key={`w${i}`} from={s} durationInFrames={20} layout="none"><Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} /></Sequence>);
    sounds.push(<Sequence key={`p${i}`} from={s + 4} durationInFrames={20} layout="none"><Audio src={staticFile("sfx/pop.wav")} volume={0.6} /></Sequence>);
  });

  // 글자 블록 위치: 카드가 있으면 아래쪽, 없으면 가운데
  const hasPose = !!sc.pose; // 캐릭터가 없으면 글자를 키우고 가운데로 (아래가 비지 않게)
  const textTop = sc.card ? H * (hasPose ? 0.42 : 0.47) : sc.icons ? H * (hasPose ? 0.36 : 0.42) : H * (hasPose ? 0.28 : 0.34);
  const grow = hasPose ? 1 : 1.18;
  let lineStart = 3;
  const cardIn = spring({ frame: local - 1, fps, config: { damping: 13, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ background: ink, overflow: "hidden" }}>
      {bgm && <Audio src={staticFile(bgm)} volume={0.5} />}
      {sounds}
      <AbsoluteFill style={{ background: sc.bg, clipPath: sc.wipe ? `polygon(0 0, ${wipe * 140}% 0, ${wipe * 140 - 40}% 100%, 0 100%)` : undefined, transform: `scale(${(1.06 - 0.06 * enter) * exitZoom})` }}>
        <Pattern kind={sc.pattern} t={t} W={W} H={H} />
        {sc.wipe && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe * 140 - 40}%`, width: 60, background: "#FFD84D", transform: "skewX(-20deg)", opacity: wipe < 1 ? 1 : 0 }} />}
        {sc.ring && (() => { const r = spring({ frame: local - 2, fps, config: { damping: 15, stiffness: 120 } });
          return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><circle cx={W / 2} cy={H * 0.4} r={330} fill="none" stroke={hl} strokeWidth={26} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - r} transform={`rotate(-90 ${W / 2} ${H * 0.4})`} opacity={0.9} /></svg>; })()}
        {sc.card && (
          <div style={{ position: "absolute", left: W * 0.08, top: SAFE.top - 40, width: W * 0.84, transform: `translateY(${(1 - cardIn) * -500}px) rotate(${-5 + (1 - cardIn) * -10}deg)`,
            border: `14px solid #FFFFFF`, outline: `6px solid ${ink}`, boxShadow: `18px 22px 0 ${ink}`, background: "#FFFFFF" }}>
            <Img src={staticFile(sc.card)} style={{ width: "100%", display: "block" }} />
          </div>
        )}
        {sc.icons && (
          <div style={{ position: "absolute", top: SAFE.top + 10, width: "100%", display: "flex", justifyContent: "center", gap: 34 }}>
            {[0, 1, 2].map((i) => { const s = spring({ frame: local - 2 - i * 3, fps, config: { damping: 10, stiffness: 200 } });
              return (
                <div key={i} style={{ width: 230, height: 230, borderRadius: 34, background: ["#FFF2B8", "#BFE4FF", "#FFC6D8"][i], border: `7px solid ${ink}`, boxShadow: `8px 10px 0 ${ink}`, transform: `scale(${s}) rotate(${(i - 1) * 4}deg)`, display: "grid", placeItems: "center" }}>
                  <svg width={150} height={150} viewBox="0 0 150 150">
                    {i === 0 && [30, 70, 50, 110, 90].map((h, k) => <rect key={k} x={12 + k * 26} y={140 - h * Math.min(1, s * 1.2)} width={18} height={h * Math.min(1, s * 1.2)} fill={["#FF5C9A", "#FFB23D", "#3DA5FF", "#7B4FD6", "#2BB673"][k]} stroke={ink} strokeWidth={3} />)}
                    {i === 1 && <><circle cx={75} cy={75} r={58} fill="none" stroke="#3DA5FF" strokeWidth={30} /><circle cx={75} cy={75} r={58} fill="none" stroke="#FF5C9A" strokeWidth={30} pathLength={1} strokeDasharray={`${0.38 * s} 1`} transform="rotate(-90 75 75)" /><circle cx={75} cy={75} r={73} fill="none" stroke={ink} strokeWidth={4} /><circle cx={75} cy={75} r={43} fill="#FFF" stroke={ink} strokeWidth={4} /></>}
                    {i === 2 && <><path d="M30 110 L75 40 L120 95" stroke={ink} strokeWidth={6} fill="none" /><circle cx={30} cy={110} r={16} fill="#3DA5FF" stroke={ink} strokeWidth={4} /><circle cx={75} cy={40} r={16} fill="#FF5C9A" stroke={ink} strokeWidth={4} /><circle cx={120} cy={95} r={16} fill="#2BB673" stroke={ink} strokeWidth={4} /></>}
                  </svg>
                </div>
              ); })}
          </div>
        )}
        <div style={{ position: "absolute", left: 40, right: 40, top: textTop }}>
          {sc.lines.map((ln, i) => { const s0 = lineStart; lineStart += [...ln.text].length * 2 + 2;
            return <PopLine key={`${idx}-${i}`} line={{ ...ln, size: (ln.size ?? 190) * grow }} start={s0} ink={ink} hl={hl} fps={fps} frame={local} maxW={W - 120} />; })}
        </div>
        {[[0.16, 0.24, 1.2], [0.86, 0.3, 0.9], [0.8, 0.62, 1.4]].map(([x, y, s], i) => { const k = spring({ frame: local - 6 - i * 3, fps, config: { damping: 8, stiffness: 200 } });
          return <div key={i} style={{ transform: `rotate(${t * 90 + i * 30}deg)`, transformOrigin: `${x * W}px ${y * H}px` }}><Sparkle x={x * W} y={y * H} s={s * k} c={["#FFFFFF", hl, "#FFFFFF"][i]} /></div>; })}
        {sc.pose && <Img src={staticFile(sc.pose)} style={{ position: "absolute", left: 30, bottom: 0, height: H * 0.36, transform: `translateY(${(1 - enter) * 80}px)` }} />}
      </AbsoluteFill>
      {/* 진행 점 */}
      <div style={{ position: "absolute", bottom: SAFE.bottom - 120, width: "100%", display: "flex", justifyContent: "center", gap: 12 }}>
        {scenes.map((_, i) => <div key={i} style={{ width: i === idx ? 44 : 14, height: 14, borderRadius: 7, background: i <= idx ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: `3px solid ${ink}` }} />)}
      </div>
    </AbsoluteFill>
  );
};
export const popTeaserDuration = (p: PopTeaserProps, fps = 30) => Math.round(p.scenes.reduce((a, s) => a + (s.beats ?? 3), 0) * (60 / p.bpm) * fps);
