// 어린이 영어 — "내용은 하나, 스타일은 여러 개"
//
//  ① 그림(PROPS): 고양이·해·나무·공·물고기를 '부위별 도형 데이터' 로 한 번만 정의한다.
//  ② 스타일(SKINS): 같은 도형을 각자 방식으로 그린다.
//       storybook — 그림책: 차분한 시간대 색, 색연필 결, 흔들리는 갈색 손그림 선 (레퍼런스 for_kids_001)
//       doodle    — 모눈 공책 마커 낙서 + 픽셀아트 + 게임 UI (레퍼런스 for_kids_002)
//       chalk     — 칠판 분필
//       neon      — 어두운 벽 네온
//     새 스타일 = SKINS 에 객체 하나 추가 (배경·글자·하이라이트·카드·퀴즈틀·커서·칭찬).
//  ③ 템플릿(ReadAlong, StyleShowreel)은 skin 만 받아서 그린다.
import React, { useMemo } from "react";
import { FONTS } from "./fonts";
import { GrainOverlay, INK, mixHex, Paper, rnd, Scratches, wobblyCircle, wobblyPath, wobblyRect } from "./handdrawn";

/* ───────────────────────── ① 그림 데이터 ───────────────────────── */
export type PropName = "cat" | "sun" | "tree" | "ball" | "fish";
export type Role = "main" | "light" | "dark" | "accent" | "eye" | "white" | "blush";
type Part = { d: string; role: Role; stroke?: number; noOutline?: boolean };
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
const circ = (cx: number, cy: number, r: number) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`;
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;

/** viewBox -120..120 (중심 0,0 / 발바닥 y≈105). happy: 눈이 ^^ */
export function propParts(name: PropName, happy = false): Part[] {
  switch (name) {
    case "cat": return [
      { d: "M70 40 Q118 20 104 -30", role: "dark", stroke: 14 },
      ...[-62, -30, 18, 50].map((x) => ({ d: rr(x, 70, 20, 36, 6), role: "main" as Role })),
      { d: rr(-84, -10, 168, 92, 22), role: "main" },
      { d: "M-66 -86 L-50 -128 L-26 -92 Z", role: "main" }, { d: "M66 -86 L50 -128 L26 -92 Z", role: "main" },
      { d: rr(-74, -100, 148, 98, 26), role: "main" },
      { d: ell(0, 36, 40, 28), role: "light", noOutline: true },
      ...(happy
        ? [{ d: "M-42 -46 Q-30 -62 -18 -46", role: "eye" as Role, stroke: 7 }, { d: "M18 -46 Q30 -62 42 -46", role: "eye" as Role, stroke: 7 }]
        : [{ d: ell(-30, -48, 8, 11), role: "eye" as Role }, { d: ell(30, -48, 8, 11), role: "eye" as Role }]),
      { d: ell(-48, -24, 11, 7), role: "blush", noOutline: true }, { d: ell(48, -24, 11, 7), role: "blush", noOutline: true },
      { d: "M-7 -30 L7 -30 L0 -22 Z", role: "dark" },
    ];
    case "sun": return [
      ...[...Array(10)].map((_, i) => { const a = (i / 10) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        return { d: `M${c * 72 - s * 7},${s * 72 + c * 7} L${c * 100},${s * 100} L${c * 72 + s * 7},${s * 72 - c * 7} Z`, role: "accent" as Role }; }),
      { d: circ(0, 0, 62), role: "main" }, { d: circ(-18, -18, 20), role: "light", noOutline: true },
    ];
    case "tree": return [
      { d: "M-16 10 L-22 104 L22 104 L16 10 Z", role: "dark" },
      { d: circ(-44, -4, 44), role: "main" }, { d: circ(44, -4, 44), role: "main" }, { d: circ(0, -46, 62), role: "main" },
      { d: circ(-20, -60, 22), role: "light", noOutline: true },
    ];
    case "ball": return [
      { d: circ(0, 52, 52), role: "main" }, { d: "M-50 44 Q0 80 50 44", role: "white", stroke: 9 }, { d: circ(-18, 30, 12), role: "light", noOutline: true },
    ];
    case "fish": return [
      { d: "M42 30 L100 -8 L100 68 Z", role: "dark" }, { d: ell(-6, 30, 70, 46), role: "main" },
      { d: "M-6 -14 Q18 -40 40 -10", role: "dark", stroke: 10 }, { d: ell(-40, 20, 9, 10), role: "eye" }, { d: ell(10, 44, 26, 16), role: "light", noOutline: true },
    ];
  }
}

/* ───────────────────────── ② 스타일 정의 ───────────────────────── */
export type Phase = 0 | 1 | 2; // 0 읽기, 1 파닉스, 2 퀴즈
export type PropColors = Record<PropName, Partial<Record<Role, string>>>;
export type Skin = {
  id: string;
  label: string;
  font: { read: string; display: string; note: string };
  ink: string;                // 선 색
  text: { done: string; todo: string; current: string };
  accent: string;             // 하이라이트·정답
  props: PropColors;
  render: "pencil" | "pixel" | "chalk" | "neon";
  /** 배경 (phase 가중치 w: [읽기, 파닉스, 퀴즈], t 초) */
  Background: React.FC<{ W: number; H: number; w: [number, number, number]; t: number }>;
  /** 화면 위 장식/게임 UI */
  Hud?: React.FC<{ W: number; H: number; phase: Phase; t: number; wordIndex: number; words: number; correct: boolean }>;
  card: "paper" | "highlighter" | "chalkboard" | "neonbar";
  tile: "holo" | "sticky" | "chalkbox" | "neontube";
  quizFrame: "lantern" | "itembox" | "chalkring" | "neonframe";
  cursor: "firefly" | "pixelhand" | "chalkdot" | "spark";
  praise: string;
  bgmMood: "bright" | "drive";
};

const PAL_STORY: PropColors = {
  cat: { main: "#D98B5F", light: "#F3D2B0", dark: "#7A4A32", eye: "#3A2A22", blush: "#E8A2A0" },
  sun: { main: "#F2C266", accent: "#E9A94F", light: "#FBE5A8" },
  tree: { main: "#7BAF6E", light: "#A9CF94", dark: "#8A6244" },
  ball: { main: "#C8635C", white: "#F6EDE0", light: "#E59A8F" },
  fish: { main: "#7FA8C9", dark: "#5C84A6", light: "#B8D2E4", eye: "#2E2A33" },
};
const PAL_DOODLE: PropColors = {
  cat: { main: "#E8572F", light: "#F7B26A", dark: "#5A3A2A", eye: "#1E1E24", blush: "#F28AA2" },
  sun: { main: "#F6C431", accent: "#F08A24", light: "#FCE38A" },
  tree: { main: "#3FA34D", light: "#8CD17D", dark: "#8B5A2B" },
  ball: { main: "#2F6FE4", white: "#FFFFFF", light: "#8DB4F5" },
  fish: { main: "#7B4FD6", dark: "#4A2E8F", light: "#B79BF0", eye: "#1E1E24" },
};

/* 그림책 풍경: 시간대 3개 (노을 → 푸른 저녁 → 달밤) 를 색으로 섞는다 */
const SKY = [
  { top: "#7F72B8", mid: "#C9A3C9", low: "#F2C6A8", cloud: "#F6D7CB", mtnF: "#A7A0CD", mtnN: "#8F87BF", snow: "#EFE7F4", trees: "#6F9C72", lake: "#C7B2D2", line: "#F6DFE2", mTop: "#8BBA69", mLow: "#5F9A4E", leaf: "#3F7A47", vein: "#D7EBC8" },
  { top: "#5F93CC", mid: "#9CC1E4", low: "#D9E8F1", cloud: "#F5F8FB", mtnF: "#9DA9CF", mtnN: "#8693C2", snow: "#F3F5FA", trees: "#5E9468", lake: "#A9C6E0", line: "#EEF6FB", mTop: "#7EB55F", mLow: "#579448", leaf: "#3A7444", vein: "#D5EAC6" },
  { top: "#121633", mid: "#232854", low: "#3B3D6E", cloud: "#353A69", mtnF: "#3B3F6E", mtnN: "#2E325C", snow: "#8C90B9", trees: "#29464A", lake: "#283062", line: "#6C74B0", mTop: "#2D4F49", mLow: "#21403C", leaf: "#1D3D3A", vein: "#6F9A8E" },
];
type SkyKey = keyof typeof SKY[0];
const skyMix = (w: [number, number, number], k: SkyKey) => { const a = mixHex(SKY[0][k], SKY[1][k], w[1] / Math.max(1e-6, w[0] + w[1])); return w[2] > 0 ? mixHex(a, SKY[2][k], w[2]) : a; };

const StoryLandscape: Skin["Background"] = ({ W, H, w, t }) => {
  const c = (k: SkyKey) => skyMix(w, k);
  const horizon = H * 0.56, shore = H * 0.62;
  const sunY = horizon - 120 + w[1] * 160 + w[2] * 300, moonY = horizon - 40 - w[2] * 330;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${c("top")} 0%, ${c("mid")} 45%, ${c("low")} 70%)` }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* 별 (밤) */}
        <g opacity={w[2]}>{[...Array(70)].map((_, i) => <circle key={i} cx={rnd(i) * W} cy={rnd(i + 99) * horizon * 0.85} r={1 + rnd(i + 7) * 1.8} fill="#FFF8DC" opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))} />)}</g>
        {/* 해 / 달 */}
        <g filter="url(#hd-wobble)">
          <path d={wobblyCircle(W * 0.72, sunY, 54, 3)} fill="#F7C66A" opacity={1 - w[2]} />
          <g opacity={w[2]}><path d={wobblyCircle(W * 0.18, moonY, 46, 5)} fill="#F1E6C2" /><circle cx={W * 0.18 - 14} cy={moonY - 8} r={9} fill="#D9CDA6" /><circle cx={W * 0.18 + 16} cy={moonY + 12} r={6} fill="#D9CDA6" /></g>
        </g>
        {/* 구름 */}
        <g filter="url(#hd-wobble)">{[[0.12, 0.12, 1], [0.38, 0.07, 0.8], [0.62, 0.15, 0.9], [0.86, 0.09, 0.7]].map(([x, y, s], i) => {
          const cx = ((x * W + t * 14 * (0.6 + s * 0.4)) % (W + 300)) - 150, cy = y * H;
          return <g key={i} transform={`translate(${cx} ${cy}) scale(${s})`}><ellipse cx={0} cy={18} rx={130} ry={30} fill={c("cloud")} /><ellipse cx={-40} cy={2} rx={55} ry={36} fill={c("cloud")} /><ellipse cx={30} cy={-6} rx={62} ry={42} fill={c("cloud")} /><ellipse cx={0} cy={30} rx={120} ry={10} fill={c("mid")} opacity={0.35} /></g>; })}</g>
        {/* 산 (먼 산 · 가까운 산, 눈) — 높이·폭·간격을 제각각 */}
        {[[0, c("mtnF"), 0, 0.8], [1, c("mtnN"), 40, 1]].map(([layer, col, dy, op]) => (
          <g key={layer as number} filter="url(#hd-wobble)" opacity={op as number}>
            {[...Array(layer ? 5 : 7)].map((_, i) => { const L = layer as number, x = (i + rnd(i * 7 + L * 3) * 0.7) * W / (L ? 4.2 : 6) - 100, h = (L ? 120 : 200) + rnd(i * 3 + L * 11) * (L ? 140 : 190), hw = 170 + rnd(i * 5 + L) * 190, base = horizon + (dy as number) * 0.4 + 6, top = base - h, sk = (rnd(i + L * 9) - 0.5) * 60;
              const snow = h > (L ? 190 : 260);
              return <g key={i}><path d={wobblyPath([[x - hw, base], [x + sk, top], [x + hw * 0.9, base]], 3, i + 4 + L * 20, true)} fill={col as string} stroke={INK} strokeOpacity={0.3} strokeWidth={2.5} />
                <path d={wobblyPath([[x + sk - hw * 0.18, base - h * 0.42], [x + sk, base - h * 0.4], [x + hw * 0.5, base]], 2, i + 30, false)} stroke={INK} strokeOpacity={0.12} strokeWidth={10} fill="none" />
                {snow && <path d={wobblyPath([[x + sk - 40, top + 40], [x + sk, top], [x + sk + 38, top + 36], [x + sk + 14, top + 28], [x + sk - 8, top + 44]], 2, i + 9, true)} fill={c("snow")} />}</g>; })}
          </g>
        ))}
        <rect x={0} y={horizon} width={W} height={H} fill="url(#hd-hatch)" opacity={0.15} />
        {/* 나무 줄 */}
        <g filter="url(#hd-wobble)">{[...Array(26)].map((_, i) => { const x = (i / 25) * W, y = horizon + 18 + rnd(i) * 10, s = 0.6 + rnd(i + 3) * 0.6;
          return i % 3 ? <g key={i}><rect x={x - 2} y={y} width={4} height={18 * s} fill={INK} opacity={0.6} /><circle cx={x} cy={y - 4 * s} r={13 * s} fill={c("trees")} /></g>
            : <path key={i} d={`M${x - 12 * s} ${y + 16 * s} L${x} ${y - 30 * s} L${x + 12 * s} ${y + 16 * s} Z`} fill={c("trees")} />; })}</g>
        {/* 호수 + 반사 */}
        <rect x={0} y={horizon + 36} width={W} height={shore - horizon - 26} fill={c("lake")} />
        {[...Array(16)].map((_, i) => <line key={i} x1={rnd(i) * W} x2={rnd(i) * W + 40 + rnd(i + 4) * 80} y1={horizon + 50 + rnd(i + 8) * (shore - horizon - 40)} y2={horizon + 50 + rnd(i + 8) * (shore - horizon - 40)} stroke={c("line")} strokeWidth={3} strokeLinecap="round" opacity={0.7} />)}
        <rect x={W * 0.72 - 26} y={horizon + 40} width={52} height={shore - horizon - 40} fill="#F7C66A" opacity={0.25 * (1 - w[2])} />
        {/* 풀밭 */}
        <path d={wobblyPath([[-20, shore + 6], [W * 0.3, shore - 8], [W * 0.6, shore + 4], [W + 20, shore - 6], [W + 20, H + 20], [-20, H + 20]], 3, 21, true)} fill={`url(#meadow)`} />
        <defs><linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c("mTop")} /><stop offset="1" stopColor={c("mLow")} /></linearGradient></defs>
        {[...Array(140)].map((_, i) => { const x = rnd(i + 200) * W, y = shore + 20 + rnd(i + 300) * (H - shore - 20); return <path key={i} d={`M${x} ${y} q-3 -10 -7 -16 M${x} ${y} q1 -12 2 -20 M${x} ${y} q3 -8 8 -14`} stroke={c("leaf")} strokeWidth={2} fill="none" opacity={0.55} />; })}
        {/* 꽃 · 버섯 · 돌 */}
        {[...Array(22)].map((_, i) => { const x = rnd(i + 500) * W, y = shore + 40 + rnd(i + 600) * (H - shore - 70);
          return <g key={i} transform={`translate(${x} ${y})`}>{[...Array(6)].map((__, k) => <ellipse key={k} cx={Math.cos(k) * 6} cy={Math.sin(k) * 6} rx={5} ry={3} transform={`rotate(${k * 60} ${Math.cos(k) * 6} ${Math.sin(k) * 6})`} fill="#FBF6EA" opacity={1 - w[2] * 0.4} />)}<circle r={3.5} fill="#F2C14E" /></g>; })}
        {[[0.33, 0.8], [0.66, 0.84]].map(([x, y], i) => <g key={i} transform={`translate(${x * W} ${y * H})`}><path d="M-10 0 Q0 -16 10 0 Z" fill="#C9605A" stroke={INK} strokeWidth={2} /><rect x={-3} y={0} width={6} height={10} fill="#F2E6D0" stroke={INK} strokeWidth={2} /></g>)}
        {/* 반딧불 (밤) */}
        <g opacity={w[2]}>{[...Array(24)].map((_, i) => { const x = rnd(i + 900) * W + Math.sin(t * 0.8 + i) * 40, y = shore - 30 + rnd(i + 950) * (H - shore) + Math.cos(t * 0.6 + i * 2) * 25, a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
          return <g key={i} opacity={a}><circle cx={x} cy={y} r={12} fill="#FFF3A6" opacity={0.25} /><circle cx={x} cy={y} r={3.5} fill="#FFF8C9" /></g>; })}</g>
        {/* 앞쪽 큰 잎 (화면 모서리를 감싸는 액자) */}
        {[[0, 1], [W, -1]].map(([x0, s], i) => (
          <g key={i} filter="url(#hd-wobble)" transform={`translate(${x0} ${H + 20}) scale(${s} 1) rotate(${Math.sin(t * 0.9 + i) * 1.5})`}>
            {[[-10, 300, -30], [80, 360, -8], [170, 260, 18]].map(([x, h, r], k) => (
              <g key={k} transform={`translate(${x} 0) rotate(${r})`}>
                <path d={`M0 0 Q${-70} ${-h * 0.5} 0 ${-h} Q${70} ${-h * 0.5} 0 0 Z`} fill={c("leaf")} stroke={INK} strokeWidth={3} strokeOpacity={0.6} />
                <path d={`M0 0 L0 ${-h * 0.95}`} stroke={c("vein")} strokeWidth={3} opacity={0.8} />
                {[0.25, 0.45, 0.65].map((f) => <path key={f} d={`M0 ${-h * f} L${-34} ${-h * (f + 0.12)} M0 ${-h * f} L${34} ${-h * (f + 0.12)}`} stroke={c("vein")} strokeWidth={2} opacity={0.7} />)}
              </g>
            ))}
          </g>
        ))}
        {/* 위 오른쪽 늘어진 가지 */}
        <g filter="url(#hd-wobble)" transform={`rotate(${Math.sin(t * 0.7) * 1.2} ${W} 0)`}>
          <path d={`M${W + 10} 40 Q${W - 220} 60 ${W - 330} 30`} stroke="#6B4A33" strokeWidth={7} fill="none" strokeLinecap="round" />
          {[...Array(7)].map((_, i) => { const x = W - 40 - i * 44, y = 52 + Math.sin(i) * 6; return <path key={i} d={`M${x} ${y} q-16 30 0 64 q16 -34 0 -64 Z`} fill={c("leaf")} stroke={INK} strokeWidth={2.5} strokeOpacity={0.6} transform={`rotate(${-10 + i * 6 + Math.sin(t * 1.4 + i) * 4} ${x} ${y})`} />; })}
        </g>
      </svg>
      <GrainOverlay width={W} height={H} opacity={0.28} />
    </>
  );
};

/* 모눈 공책 낙서 + 게임 UI */
const DoodleBg: Skin["Background"] = ({ W, H, t }) => (
  <>
    <Paper kind="grid" width={W} height={H} />
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <path d={wobblyPath([[60, H * 0.8], [W * 0.5, H * 0.8 + 3], [W - 60, H * 0.8 - 2]], 2.5, 3, false, 10)} stroke="#2B2B33" strokeWidth={4} fill="none" strokeLinecap="round" />
      {[[0.1, 0.2, "read!", "#E8572F", -8], [0.82, 0.3, "cat?", "#7B4FD6", 6], [0.12, 0.62, "~ ~ ~", "#2F6FE4", 0]].map(([x, y, s, col, r], i) => (
        <text key={i} x={(x as number) * W} y={(y as number) * H + Math.sin(t * 2 + i) * 4} fontFamily={FONTS.hand} fontWeight={700} fontSize={64} fill={col as string} transform={`rotate(${r} ${(x as number) * W} ${(y as number) * H})`} opacity={0.9}>{s as string}</text>
      ))}
      {[...Array(5)].map((_, i) => { const x = W * (0.22 + i * 0.14), y = H * 0.12 + Math.sin(t * 2.2 + i) * 10; const col = ["#F28AA2", "#F08A24", "#2F6FE4", "#E8572F", "#7B4FD6"][i];
        return <g key={i} opacity={0.75} transform={`translate(${x} ${y}) rotate(${-10 + i * 5})`}><ellipse cx={0} cy={30} rx={14} ry={10} fill={col} /><path d="M12 30 V-14 Q30 -4 28 10" stroke={col} strokeWidth={6} fill="none" strokeLinecap="round" /></g>; })}
    </svg>
  </>
);
const DoodleHud: NonNullable<Skin["Hud"]> = ({ W, phase, wordIndex, words, correct, t }) => {
  const label = ["LEVEL 1-1  READ", "BONUS  SOUNDS", "BOSS  WHICH ONE?"][phase];
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONTS.pixel, color: "#2B2B33" }}>
      <div style={{ position: "absolute", left: 70, top: 46, fontSize: 40, letterSpacing: 2 }}>{label}</div>
      <div style={{ position: "absolute", right: 70, top: 46, fontSize: 40, color: "#C0392B", letterSpacing: 2 }}>WORDS {Math.max(0, wordIndex + 1)}/{words}</div>
      {phase === 2 && (
        <div style={{ position: "absolute", right: 70, top: 110, width: 420 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>BOSS HP</div>
          <div style={{ height: 28, border: "4px solid #2B2B33", background: "#fff" }}><div style={{ height: "100%", width: correct ? "0%" : "100%", background: "#C0392B", transition: "none" }} /></div>
        </div>
      )}
      <div style={{ position: "absolute", left: W / 2 - 60, bottom: 30, fontSize: 22, opacity: 0.5 }}>{Math.floor(t * 10) % 2 ? "▶ PLAY" : "  PLAY"}</div>
    </div>
  );
};

/* 칠판 */
const ChalkBg: Skin["Background"] = ({ W, H }) => (
  <>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 40% 40%, #2F5446 0%, #24443A 60%, #1B352D 100%)" }} />
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
      {[...Array(10)].map((_, i) => <path key={i} d={wobblyPath([[rnd(i) * W, rnd(i + 3) * H], [rnd(i + 5) * W, rnd(i + 7) * H]], 30, i)} stroke="#DDE7E1" strokeWidth={60 + rnd(i) * 80} opacity={0.06} fill="none" strokeLinecap="round" />)}
    </svg>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, background: "linear-gradient(#8A6A4A, #5E4630)" }} />
    <GrainOverlay width={W} height={H} opacity={0.4} />
  </>
);

/* 네온 */
const NeonBg: Skin["Background"] = ({ W, H, t }) => (
  <>
    <div style={{ position: "absolute", inset: 0, background: "#16121C" }} />
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
      <defs><pattern id="brick" width="120" height="60" patternUnits="userSpaceOnUse"><rect width="120" height="60" fill="#1F1824" /><path d="M0 0 H120 M0 30 H120 M60 0 V30 M0 30 V60 M120 30 V60" stroke="#2C2233" strokeWidth={4} /></pattern></defs>
      <rect width={W} height={H} fill="url(#brick)" />
    </svg>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, rgba(255,60,170,${0.16 + 0.03 * Math.sin(t * 9)}), rgba(0,0,0,0) 60%)` }} />
    <GrainOverlay width={W} height={H} opacity={0.18} />
  </>
);

export const SKINS: Record<string, Skin> = {
  storybook: {
    id: "storybook", label: "Storybook", font: { read: FONTS.read, display: FONTS.story, note: FONTS.hand }, ink: INK,
    text: { done: "#3E2F27", todo: "#A0928A", current: "#3E2F27" }, accent: "#E07A5F", props: PAL_STORY, render: "pencil",
    Background: StoryLandscape, card: "paper", tile: "holo", quizFrame: "lantern", cursor: "firefly", praise: "Well done.", bgmMood: "bright",
  },
  doodle: {
    id: "doodle", label: "Doodle quest", font: { read: FONTS.read, display: FONTS.pixel, note: FONTS.hand }, ink: "#2B2B33",
    text: { done: "#2B2B33", todo: "#9AA0AA", current: "#2B2B33" }, accent: "#3FA34D", props: PAL_DOODLE, render: "pixel",
    Background: DoodleBg, Hud: DoodleHud, card: "highlighter", tile: "sticky", quizFrame: "itembox", cursor: "pixelhand", praise: "CORRECT! +100", bgmMood: "drive",
  },
  chalk: {
    id: "chalk", label: "Chalkboard", font: { read: FONTS.read, display: FONTS.hand, note: FONTS.hand }, ink: "#EEF3EE",
    text: { done: "#F3F6F2", todo: "#8FA89C", current: "#FFE58A" }, accent: "#FFE58A",
    props: Object.fromEntries((["cat", "sun", "tree", "ball", "fish"] as PropName[]).map((k) => [k, { main: "#F3F6F2", light: "#F3F6F2", dark: "#F3F6F2", accent: "#FFE58A", eye: "#F3F6F2", white: "#F3F6F2", blush: "#F6B3C2" }])) as PropColors,
    render: "chalk", Background: ChalkBg, card: "chalkboard", tile: "chalkbox", quizFrame: "chalkring", cursor: "chalkdot", praise: "Great!", bgmMood: "bright",
  },
  neon: {
    id: "neon", label: "Neon", font: { read: FONTS.read, display: FONTS.read, note: FONTS.hand }, ink: "#FF4FD8",
    text: { done: "#FFE3F7", todo: "#6E5A78", current: "#FFFFFF" }, accent: "#3DF2FF",
    props: { cat: { main: "#FF7A3D", light: "#FF7A3D", dark: "#FF7A3D", eye: "#3DF2FF", blush: "#FF4FD8" }, sun: { main: "#FFD23D", accent: "#FF9A3D", light: "#FFD23D" },
      tree: { main: "#4DFF8A", light: "#4DFF8A", dark: "#3DF2FF" }, ball: { main: "#FF4FD8", white: "#FFFFFF", light: "#FF4FD8" }, fish: { main: "#3DF2FF", dark: "#3DF2FF", light: "#3DF2FF", eye: "#FFFFFF" } },
    render: "neon", Background: NeonBg, card: "neonbar", tile: "neontube", quizFrame: "neonframe", cursor: "spark", praise: "YES!", bgmMood: "drive",
  },
};

/* ───────────────────────── ③ 그림 렌더러 (같은 도형, 4가지 그리기) ───────────────────────── */
export type Pose = { y: number; sx: number; sy: number };
const PIX = 22; // 픽셀아트 해상도 (22x22 칸)

export const PropView: React.FC<{ skin: Skin; name: PropName; size: number; pose?: Pose; happy?: boolean; seed?: number; shadow?: boolean }> =
  ({ skin, name, size, pose = { y: 0, sx: 1, sy: 1 }, happy = false, seed = 1, shadow = true }) => {
    const parts = useMemo(() => propParts(name, happy), [name, happy]);
    const pal = skin.props[name];
    const col = (r: Role) => pal[r] ?? pal.main ?? "#888";
    const footY = name === "sun" ? 0 : 106;
    const uid = `${skin.id}-${name}-${seed}-${happy ? 1 : 0}`;

    // 픽셀아트: 각 칸 중심이 어느 부위 안에 있는지 Path2D 로 판정 (화면을 읽지 않으므로 결정적)
    const cells = useMemo(() => {
      if (skin.render !== "pixel" || typeof document === "undefined") return null;
      const ctx = document.createElement("canvas").getContext("2d")!;
      const out: { x: number; y: number; c: string }[] = [];
      const paths = parts.map((p) => ({ p, path: new Path2D(p.d) }));
      for (let iy = 0; iy < PIX; iy++) for (let ix = 0; ix < PIX; ix++) {
        const x = -120 + (ix + 0.5) * (240 / PIX), y = -120 + (iy + 0.5) * (240 / PIX);
        for (let k = paths.length - 1; k >= 0; k--) {
          const { p, path } = paths[k];
          if (p.stroke) { ctx.lineWidth = p.stroke * 1.6; if (ctx.isPointInStroke(path, x, y)) { out.push({ x: ix, y: iy, c: col(p.role) }); break; } }
          else if (ctx.isPointInPath(path, x, y)) { out.push({ x: ix, y: iy, c: col(p.role) }); break; }
        }
      }
      return out;
    }, [skin.render, parts, name]);

    const body = (() => {
      if (skin.render === "pixel" && cells) {
        const cs = 240 / PIX;
        return (
          <g>
            {cells.map((c, i) => <rect key={i} x={-120 + c.x * cs + 0.6} y={-120 + c.y * cs + 0.6} width={cs - 1.2} height={cs - 1.2} fill={c.c} filter="url(#hd-marker)" />)}
            {cells.map((c, i) => <rect key={`o${i}`} x={-120 + c.x * cs} y={-120 + c.y * cs} width={cs} height={cs} fill="none" stroke="#2B2B33" strokeOpacity={0.25} strokeWidth={1} />)}
          </g>
        );
      }
      if (skin.render === "neon") {
        return (
          <g style={{ filter: `drop-shadow(0 0 6px ${col("main")}) drop-shadow(0 0 16px ${col("main")})` }}>
            {parts.filter((p) => !p.noOutline || p.role === "eye").map((p, i) => <path key={i} d={p.d} fill="none" stroke={col(p.role)} strokeWidth={p.stroke ? p.stroke * 0.6 : 5} strokeLinecap="round" strokeLinejoin="round" />)}
          </g>
        );
      }
      if (skin.render === "chalk") {
        return (
          <g filter="url(#hd-wobble)" opacity={0.92}>
            {parts.map((p, i) => p.stroke
              ? <path key={i} d={p.d} fill="none" stroke={col(p.role)} strokeWidth={p.stroke * 0.7} strokeLinecap="round" filter="url(#hd-pencil)" />
              : <g key={i}><path d={p.d} fill={p.role === "blush" ? col("blush") : "none"} opacity={p.role === "blush" ? 0.5 : 1} stroke={col(p.role)} strokeWidth={p.noOutline ? 0 : 5} filter="url(#hd-pencil)" />
                {p.role === "main" && <Scratches id={`${uid}-s${i}`} clip={p.d} x={-120} y={-120} w={240} h={240} count={18} color="#F3F6F2" seed={i + seed} opacity={0.35} />}</g>)}
          </g>
        );
      }
      // pencil (그림책)
      return (
        <g filter="url(#hd-wobble)">
          {parts.map((p, i) => p.stroke
            ? <path key={i} d={p.d} fill="none" stroke={col(p.role)} strokeWidth={p.stroke} strokeLinecap="round" />
            : <g key={i}>
                <path d={p.d} fill={col(p.role)} filter="url(#hd-pencil)" />
                {p.role === "main" && <Scratches id={`${uid}-s${i}`} clip={p.d} x={-120} y={-130} w={240} h={250} count={34} color={mixHex(col("main"), "#3a2418", 0.45)} seed={i + seed} opacity={0.32} />}
                {!p.noOutline && <path d={p.d} fill="none" stroke={skin.ink} strokeWidth={3.2} strokeLinejoin="round" />}
              </g>)}
        </g>
      );
    })();

    return (
      <svg width={size} height={size} viewBox="-130 -130 260 260" style={{ overflow: "visible" }}>
        {shadow && name !== "sun" && skin.render !== "neon" && (
          <ellipse cx={0} cy={footY + 8} rx={70 * (1 + pose.y / 500)} ry={12} fill={skin.render === "chalk" ? "#F3F6F2" : "#000"} opacity={(skin.render === "chalk" ? 0.12 : 0.18) * (1 + pose.y / 400)} />
        )}
        <g transform={`translate(0 ${pose.y}) translate(0 ${footY}) scale(${pose.sx} ${pose.sy}) translate(0 ${-footY})`}>{body}</g>
      </svg>
    );
  };

/** 하이라이트(현재 단어 표시) — 스타일마다 다르게 */
export const WordMark: React.FC<{ skin: Skin; x: number; y: number; w: number; h: number; k: number; seed: number }> = ({ skin, x, y, w, h, k, seed }) => {
  switch (skin.card) {
    case "paper": return <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}><path d={wobblyPath([[x - 6, y + h - 16], [x + w * 0.5, y + h - 13], [x + w + 6, y + h - 18]], 2, seed, false, 8)} stroke={skin.accent} strokeWidth={10} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} opacity={0.85} /></svg>;
    case "highlighter": return <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}><path d={wobblyRect(x - 12, y + 14, (w + 24) * Math.max(0.05, k), h - 26, 6, seed, 2.5)} fill="#FFE45C" opacity={0.85} filter="url(#hd-marker)" /></svg>;
    case "chalkboard": return <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}><path d={wobblyCircle(x + w / 2, y + h / 2 + 2, Math.max(w, h) * 0.62, seed, 0.08)} transform={`translate(${x + w / 2} ${y + h / 2}) scale(1 0.55) translate(${-(x + w / 2)} ${-(y + h / 2)})`} stroke={skin.accent} strokeWidth={5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} filter="url(#hd-pencil)" /></svg>;
    case "neonbar": return <div style={{ position: "absolute", left: x - 10, top: y + h - 14, width: (w + 20) * k, height: 6, borderRadius: 3, background: skin.accent, boxShadow: `0 0 10px ${skin.accent}, 0 0 24px ${skin.accent}` }} />;
  }
};
