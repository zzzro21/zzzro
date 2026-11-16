// 사람은 그대로, 배경만 바꾸거나 글자가 사람 '뒤로' 지나가게 (레퍼런스 original_45 의 B 유형)
//
// 준비: python3 tools/person_matte.py my_clip.mp4 --out public/cut   → public/cut/person.webm (사람만, 투명)
// 레이어 (아래 → 위):
//   ① 배경: 원래 영상 그대로 / 코드로 만든 새 배경 (sunburst · speed · popart · dusk · grid)
//   ② 사람 뒤 글자: 큰 글자가 가로로 흐르고, 사람이 그 앞을 가린다
//   ③ 사람 (누끼 영상) + 선택: 흰 스티커 테두리, 흑백/만화 톤
//   ④ 앞 그래픽: TalkingOverlay (자막·스티커·말풍선·카운터) — 얼굴은 비워둠
import React from "react";
import { AbsoluteFill, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "./fonts";
import { TalkingOverlay, TalkingOverlayProps, talkingOverlayDefaults } from "./TalkingOverlay";

type Bg = "original" | "sunburst" | "speed" | "popart" | "dusk" | "grid";
export type CutScene = { from: number; to: number; bg: Bg; behindText?: string; behindY?: number /* 0~1, 뒤쪽 사람 얼굴을 덮지 않는 높이로 */; outline?: boolean; tone?: "none" | "mono" | "comic"; label?: string };
export type CutoutStageProps = {
  original: string;        // public/ 기준 원본 촬영본
  person: string;          // public/ 기준 person.webm (person_matte.py 결과)
  clipSec: number;         // 원본 길이 (짧으면 반복)
  scenes: CutScene[];
  overlay?: Partial<TalkingOverlayProps>;
};

export const cutoutStageDefaults: CutoutStageProps = {
  original: "preview/clip_a.mp4", person: "preview/cut/person.webm", clipSec: 2.3,
  scenes: [
    { from: 0, to: 2.3, bg: "original", behindText: "조회수 조회수 조회수" },
    { from: 2.3, to: 4.6, bg: "sunburst", outline: true, behindText: "VIRAL!" },
    { from: 4.6, to: 6.9, bg: "speed", tone: "mono", outline: true },
  ],
  overlay: {
    captionArea: "lower", progress: true,
    captions: [{ t: 0.3, text: "배경을" }, { t: 0.6, text: "*바꾸면*" }, { t: 1.3, text: "느낌이" }, { t: 1.6, text: "확" }, { t: 1.9, text: "달라져요." },
      { t: 2.5, text: "사람은" }, { t: 2.8, text: "*그대로*" }, { t: 3.6, text: "배경만" }, { t: 4.0, text: "교체!" }, { t: 4.8, text: "만화" }, { t: 5.1, text: "*느낌도*" }],
    events: [
      { type: "label", at: 0.1, dur: 6.8, text: "IDEA 01 · 배경 교체" },
      { type: "like", at: 1.0 }, { type: "like", at: 3.0 }, { type: "like", at: 5.0 },
      { type: "sticker", at: 2.5, dur: 2.0, kind: "star", x: 0.84, y: 0.18 },
      { type: "bubble", at: 5.0, dur: 1.8, text: "진짜 쉬워요!", x: 0.24, y: 0.17 },
      { type: "burst", at: 5.6, dur: 1.3, text: "팍!", x: 0.82, y: 0.4 },
    ],
  },
};

const BgLayer: React.FC<{ kind: Bg; t: number; W: number; H: number }> = ({ kind, t, W, H }) => {
  if (kind === "sunburst") return (
    <AbsoluteFill style={{ background: "#7CC8FF" }}>
      <div style={{ position: "absolute", left: "50%", top: "42%", width: H * 2, height: H * 2, marginLeft: -H, marginTop: -H, transform: `rotate(${t * 12}deg)`,
        background: "repeating-conic-gradient(from 0deg, #FFE27A 0deg 10deg, #A9DCFF 10deg 20deg)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%)" }} />
      {[[0.15, 0.82, 1.2], [0.85, 0.86, 1], [0.5, 0.95, 1.6]].map(([x, y, s], i) => <div key={i} style={{ position: "absolute", left: x * W - 200 * s, top: y * H - 90 * s, width: 400 * s, height: 180 * s, borderRadius: 999, background: "#FFFFFF", boxShadow: "0 -30px 0 20px #FFFFFF" }} />)}
    </AbsoluteFill>
  );
  if (kind === "speed") return (
    <AbsoluteFill style={{ background: "#F4F4F0" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {[...Array(90)].map((_, i) => { const a = (i / 90) * Math.PI * 2 + Math.sin(i * 7.1) * 0.03, r0 = 260 + ((i * 53 + Math.floor(t * 12) * 17) % 140), r1 = Math.hypot(W, H);
          const cx = W / 2, cy = H * 0.38, w = 2 + (i % 5) * 2.4;
          return <path key={i} d={`M${cx + Math.cos(a - 0.004 * w) * r0} ${cy + Math.sin(a - 0.004 * w) * r0} L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L${cx + Math.cos(a + 0.004 * w) * r0} ${cy + Math.sin(a + 0.004 * w) * r0} Z`} fill="#141414" />; })}
      </svg>
    </AbsoluteFill>
  );
  if (kind === "popart") return (
    <AbsoluteFill style={{ background: "#FFD23D" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><defs><pattern id="ht" width={30} height={30} patternUnits="userSpaceOnUse"><circle cx={15} cy={15} r={8} fill="#E8333A" /></pattern></defs><rect width={W} height={H} fill="url(#ht)" opacity={0.85} /></svg>
    </AbsoluteFill>
  );
  if (kind === "dusk") return <AbsoluteFill style={{ background: "linear-gradient(180deg, #6E6BC4 0%, #E79AC0 50%, #FFC79A 80%)" }} />;
  if (kind === "grid") return (
    <AbsoluteFill style={{ background: "linear-gradient(#1A0B2E, #3A1458)" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{[...Array(24)].map((_, i) => <line key={i} x1={(i / 23) * W * 3 - W} y1={H} x2={W / 2} y2={H * 0.55} stroke="#FF4FD8" strokeWidth={2} opacity={0.6} />)}
        {[...Array(10)].map((_, i) => { const y = H * 0.55 + Math.pow(((i + (t * 2) % 1) / 10), 2) * H * 0.45; return <line key={`h${i}`} x1={0} x2={W} y1={y} y2={y} stroke="#FF4FD8" strokeWidth={2} opacity={0.6} />; })}</svg>
    </AbsoluteFill>
  );
  return null;
};

export const CutoutStage: React.FC<CutoutStageProps> = ({ original, person, clipSec, scenes, overlay }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps, clipF = Math.round(clipSec * fps);
  const sc = scenes.find((s) => t >= s.from && t < s.to) ?? scenes[scenes.length - 1];
  const local = t - sc.from;
  const flash = interpolate(local, [0, 0.12], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (sc.from > 0 ? 1 : 0);
  // 흰 스티커 테두리 = drop-shadow 를 여러 방향으로 겹치기
  const outline = sc.outline ? [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `drop-shadow(${(Math.cos((a * Math.PI) / 180) * 7).toFixed(1)}px ${(Math.sin((a * Math.PI) / 180) * 7).toFixed(1)}px 0 #FFFFFF)`).join(" ") : "";
  const tone = sc.tone === "mono" ? "grayscale(1) contrast(1.35)" : sc.tone === "comic" ? "saturate(1.6) contrast(1.3)" : "";
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* ① 배경 */}
      {sc.bg === "original"
        ? <Loop durationInFrames={clipF}><OffthreadVideo src={staticFile(original)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></Loop>
        : <BgLayer kind={sc.bg} t={t} W={W} H={H} />}
      {/* ② 사람 뒤 글자 */}
      {sc.behindText && (
        <div style={{ position: "absolute", top: H * (sc.behindY ?? 0.2), left: 0, whiteSpace: "nowrap", transform: `translateX(${W * 0.3 - local * 520}px) rotate(-4deg)`,
          fontFamily: FONTS.pop, fontSize: 340, lineHeight: 1, color: sc.bg === "original" ? "#FFE03D" : "#FFFFFF", WebkitTextStroke: "14px #1E1E24", paintOrder: "stroke fill",
          textShadow: "0 18px 0 #1E1E24", opacity: interpolate(local, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }) }}>
          {sc.behindText} {sc.behindText}
        </div>
      )}
      {/* ③ 사람 (누끼) */}
      <Loop durationInFrames={clipF}>
        <OffthreadVideo src={staticFile(person)} transparent muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `${tone} ${outline}`.trim() || undefined }} />
      </Loop>
      {/* 원본 소리는 한 번만 */}
      <Loop durationInFrames={clipF}><OffthreadVideo src={staticFile(original)} style={{ display: "none" }} /></Loop>
      {/* ④ 앞 그래픽 */}
      <Sequence layout="none"><TalkingOverlay {...talkingOverlayDefaults} {...overlay} video={undefined} /></Sequence>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
export const cutoutStageDuration = (p: CutoutStageProps, fps = 30) => Math.round(Math.max(...p.scenes.map((s) => s.to)) * fps);
