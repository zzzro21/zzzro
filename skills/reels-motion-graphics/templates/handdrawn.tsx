// 손그림 질감 도구 세트 — "매끈한 벡터 클립아트" 를 "그림책·공책 낙서" 로 바꾸는 공용 부품
// (사용자 레퍼런스 for_kids_001: 그림책 / for_kids_002: 모눈 공책 마커 낙서 에서 뽑은 공통 질감)
//
//  <HandDefs />            : 루트에 한 번. 필터 정의 (흔들리는 선, 색연필 결, 마커 결, 종이 그레인)
//  <Paper kind=… />        : 종이 바탕 (parchment 양피지 / grid 모눈 / plain 무지) + 얼룩 + 비네팅 + 그레인
//  wobblyPath / wobblyCircle / wobblyRect : 손으로 그은 듯 살짝 흔들리는 경로 (seed 고정 = 매번 같은 결과)
//  <Scratches />           : 도형 안의 색연필 긁힌 결 (clipPath 안에서)
//  <HandUnderline />       : 마커 밑줄 (그려지듯 등장)
//
// 원칙: 선은 검정 대신 '진한 갈색/남색 잉크', 두께 2.5~4px, 완벽한 원·직선 금지,
//       채색은 칸을 꽉 채우지 않고 결이 보이게, 화면 전체에 종이 결.
import React from "react";

export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const n1 = (x: number, seed: number) => { // 부드러운 1D 노이즈 (-1..1)
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (rnd(i + seed * 101) * 2 - 1) * (1 - u) + (rnd(i + 1 + seed * 101) * 2 - 1) * u;
};

export const INK = "#4A3326";

/** 점들을 지나는 흔들리는 손그림 경로 */
export function wobblyPath(pts: [number, number][], amp = 2.5, seed = 1, closed = false, steps = 6): string {
  const out: [number, number][] = [];
  const P = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
    const k = Math.max(2, Math.round((len / 40) * steps / 3));
    for (let j = 0; j < k; j++) {
      const t = j / k, w = n1((i * 13 + j) * 0.7, seed) * amp;
      out.push([x0 + (x1 - x0) * t + nx * w, y0 + (y1 - y0) * t + ny * w]);
    }
  }
  if (!closed) out.push(P[P.length - 1]);
  return out.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + (closed ? " Z" : "");
}
export function wobblyCircle(cx: number, cy: number, r: number, seed = 1, amp = 0.04, n = 36): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (1 + n1(i * 0.6, seed) * amp); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
}
export function wobblyRect(x: number, y: number, w: number, h: number, r = 18, seed = 1, amp = 1.8): string {
  const pts: [number, number][] = [];
  const c = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  c(x + w - r, y + r, -Math.PI / 2); c(x + w - r, y + h - r, 0); c(x + r, y + h - r, Math.PI / 2); c(x + r, y + r, Math.PI);
  return wobblyPath(pts, amp, seed, true, 3);
}

/** 루트에 한 번 렌더 */
export const HandDefs: React.FC<{ boil?: number }> = ({ boil = 0 }) => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      {/* 흔들리는 선: boil 값을 3~4프레임마다 바꾸면 손그림 애니메이션처럼 '보글' 거린다 */}
      <filter id="hd-wobble" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={3 + boil} result="w" />
        <feDisplacementMap in="SourceGraphic" in2="w" scale={4} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      {/* 색연필 결: 가로로 길쭉한 노이즈로 칠이 듬성듬성 */}
      <filter id="hd-pencil" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves={2} seed={7} result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.35" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" result="tex" />
        <feComponentTransfer in="SourceGraphic" result="base"><feFuncA type="linear" slope={0.78} /></feComponentTransfer>
        <feMerge><feMergeNode in="base" /><feMergeNode in="tex" /></feMerge>
      </filter>
      {/* 마커 결: 대각선 방향 줄무늬가 남는 칠 */}
      <filter id="hd-marker" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves={1} seed={11} result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0.35" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      {/* 종이 그레인 */}
      <filter id="hd-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} seed={5} />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.75 0" />
      </filter>
      <pattern id="hd-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <line x1="0" y1="0" x2="0" y2="10" stroke={INK} strokeWidth="1.4" opacity="0.35" />
      </pattern>
    </defs>
  </svg>
);

/** 종이 바탕 */
export const Paper: React.FC<{ kind: "parchment" | "grid" | "plain"; width: number; height: number; tint?: string; grain?: number }> =
  ({ kind, width, height, tint, grain = 0.35 }) => {
    const base = tint ?? (kind === "parchment" ? "#EADDC3" : kind === "grid" ? "#EFE9DD" : "#F3EEE4");
    return (
      <>
        <div style={{ position: "absolute", inset: 0, background: base }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 25%, rgba(255,252,240,0.55), rgba(255,252,240,0) 55%), radial-gradient(ellipse at 75% 85%, rgba(140,100,50,0.14), rgba(140,100,50,0) 45%)" }} />
        {kind === "grid" && (
          <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
            <defs><pattern id="hd-grid" width={44} height={44} patternUnits="userSpaceOnUse"><path d="M44 0 H0 V44" fill="none" stroke="#9FB3C8" strokeWidth={1.2} opacity={0.45} /></pattern></defs>
            <rect width={width} height={height} fill="url(#hd-grid)" />
          </svg>
        )}
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", opacity: grain, pointerEvents: "none" }}>
          <rect width={width} height={height} filter="url(#hd-grain)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(70,45,20,0.20) 100%)", pointerEvents: "none" }} />
      </>
    );
  };

/** 화면 맨 위에 덮는 종이 결 (일러스트 위에도 질감) */
export const GrainOverlay: React.FC<{ width: number; height: number; opacity?: number }> = ({ width, height, opacity = 0.22 }) => (
  <svg width={width} height={height} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", opacity, pointerEvents: "none" }}>
    <rect width={width} height={height} filter="url(#hd-grain)" />
  </svg>
);

/** 도형 안의 긁힌 결: clipPath 로 도형 안에만 */
export const Scratches: React.FC<{ id: string; clip: string; x: number; y: number; w: number; h: number; count?: number; color?: string; seed?: number; angle?: number; opacity?: number }> =
  ({ id, clip, x, y, w, h, count = 40, color = INK, seed = 1, angle = -25, opacity = 0.22 }) => {
    const a = (angle * Math.PI) / 180;
    return (
      <g>
        <clipPath id={id}><path d={clip} /></clipPath>
        <g clipPath={`url(#${id})`} opacity={opacity}>
          {[...Array(count)].map((_, i) => {
            const cx = x + rnd(i + seed * 31) * w, cy = y + rnd(i + seed * 57) * h, L = 14 + rnd(i + seed * 13) * 40;
            return <line key={i} x1={cx - Math.cos(a) * L / 2} y1={cy - Math.sin(a) * L / 2} x2={cx + Math.cos(a) * L / 2} y2={cy + Math.sin(a) * L / 2} stroke={color} strokeWidth={1.6 + rnd(i) * 1.6} strokeLinecap="round" />;
          })}
        </g>
      </g>
    );
  };

/** 마커 밑줄: progress 0→1 로 그려진다 */
export const HandUnderline: React.FC<{ x: number; y: number; w: number; progress: number; color: string; seed?: number; thick?: number }> =
  ({ x, y, w, progress, color, seed = 1, thick = 9 }) => (
    <path d={wobblyPath([[x, y], [x + w * 0.5, y + 3], [x + w, y - 2]], 2.2, seed, false, 8)} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, progress))} opacity={0.9} />
  );

/** 두 색을 섞는다 (시간대 전환 등) */
export function mixHex(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b), t = Math.max(0, Math.min(1, k));
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
