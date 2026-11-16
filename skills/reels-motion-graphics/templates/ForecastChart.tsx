// 정치·경제 전망치 그래프: 실적(실선) → 전망(점선) + 전망 범위 띠 + 기관 비교 + 마커 메모 + 출처 각주
// 채널 공통 (brand.ts 프로필로 9:16 / 16:9 자동). 효과음: synth_sfx.py, BGM: synth_bgm.py
//
// ⚠️ 데이터 규칙 (스킬 규칙과 동일)
//  - 숫자는 사용자가 준 공식 자료만. 모든 전망에 [기관 · 발표 시점] 을 화면에 표기.
//  - 실적(확정치)과 전망은 반드시 모양으로 구분: 실선 vs 점선 + 범위 띠.
//  - 정치 관련은 한 기관만 골라 보여주지 말고, 가능하면 2곳 이상 나란히. 해석 문구는 중립.
//  - 예시 데이터로 렌더할 때는 example: true → '예시 데이터' 워터마크.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, PROFILE, SAFE } from "./brand";

export type Series = { label: string; source: string; points: { x: string; y: number }[] };
export type ForecastChartProps = {
  title: string;
  unit: string; // "%", "원" ...
  actual: Series; // 확정치
  forecasts: (Series & { low?: number[]; high?: number[] })[]; // 기관별 전망 (actual 마지막 x 다음부터)
  note: string; // 손글씨 메모 한 줄
  asOf: string; // "2026년 10월 기준"
  example: boolean;
  sfx: boolean;
};

export const forecastChartDefaults: ForecastChartProps = {
  title: "경제성장률 전망",
  unit: "%",
  actual: { label: "실적", source: "통계청", points: [{ x: "2022", y: 2.7 }, { x: "2023", y: 1.4 }, { x: "2024", y: 2.0 }, { x: "2025", y: 1.0 }] },
  forecasts: [
    { label: "기관 A", source: "기관 A · 2026.10", points: [{ x: "2026", y: 1.8 }, { x: "2027", y: 2.1 }], low: [1.5, 1.6], high: [2.1, 2.6] },
    { label: "기관 B", source: "기관 B · 2026.09", points: [{ x: "2026", y: 1.6 }, { x: "2027", y: 1.9 }] },
  ],
  note: "반등은 하지만 2%대 초반",
  asOf: "2026년 10월 기준",
  example: true,
  sfx: true,
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ACC = [BRAND.accent, "#4DA3FF", "#F2C94C"];

export const ForecastChart: React.FC<ForecastChartProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const land = width > height;
  const paper = "#F6F3EC", ink = "#16181D"; // 종이 캔버스 (밝은 배경)

  // ── 레이아웃 ──
  const L = SAFE.left + (land ? 90 : 70), R = width - SAFE.right - (land ? 40 : 10);
  const T = SAFE.top + (land ? 190 : 330), B = height - SAFE.bottom - (land ? 120 : 220);
  const xs = [...p.actual.points.map((d) => d.x), ...p.forecasts[0].points.map((d) => d.x)];
  const allY = [...p.actual.points.map((d) => d.y), ...p.forecasts.flatMap((f) => [...f.points.map((d) => d.y), ...(f.high ?? []), ...(f.low ?? [])])];
  const yMin = Math.min(0, Math.floor(Math.min(...allY)));
  const rawStep = (Math.max(...allY) * 1.15 - yMin) / 5, mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((v) => v >= rawStep)!; // 깔끔한 눈금 간격
  const yMax = yMin + Math.ceil((Math.max(...allY) * 1.15 - yMin) / step) * step;
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) }, (_, i) => yMin + step * (i + 1));
  const X = (i: number) => L + (i / (xs.length - 1)) * (R - L);
  const Y = (v: number) => B - ((v - yMin) / (yMax - yMin)) * (B - T);
  const nA = p.actual.points.length;

  // ── 타이밍 (프로필 속도 반영) ──
  const sp = PROFILE.pace.enter / 10;
  const tAxis = 6, tActual = 14, dActual = Math.round(28 * sp), tSplit = tActual + dActual + 6;
  const tFc = tSplit + 12, dFc = Math.round(24 * sp), tNote = tFc + dFc + 10, tSrc = tNote + 20;

  const axisP = interpolate(frame, [tAxis, tAxis + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const actP = interpolate(frame, [tActual, tActual + dActual], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const splitP = spring({ frame: frame - tSplit, fps, config: { damping: 16, stiffness: 160 } });
  const fcP = interpolate(frame, [tFc, tFc + dFc], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const noteP = interpolate(frame, [tNote, tNote + 18], [0, 1], clamp);
  const srcP = interpolate(frame, [tSrc, tSrc + 10], [0, 1], clamp);

  const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const actPts: [number, number][] = p.actual.points.map((d, i) => [X(i), Y(d.y)]);
  const lastA = actPts[nA - 1];
  const fs = PROFILE.type;

  const sfx: React.ReactNode[] = [];
  const S = (at: number, n: string, v = 0.7) => p.sfx && sfx.push(<Sequence key={`${n}${at}`} from={Math.round(at)} durationInFrames={40} layout="none"><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>);
  S(tAxis, "whoosh", 0.4); p.actual.points.forEach((_, i) => S(tActual + (dActual * i) / Math.max(1, nA - 1), "pop", 0.5));
  S(tSplit, "hit", 0.8); S(tFc + dFc, "pop"); S(tNote, "click", 0.6); S(tSrc, "tick", 0.4);

  return (
    <AbsoluteFill style={{ background: paper, fontFamily: BRAND.font, color: ink, letterSpacing: "-0.02em" }}>
      {sfx}
      {/* 제목 */}
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: SAFE.top, fontSize: fs.title, fontWeight: 900, opacity: axisP }}>
        {p.title}
        <div style={{ fontSize: fs.caption, fontWeight: 700, color: "#6B6F78", marginTop: 8 }}>{p.asOf} · 단위 {p.unit}</div>
      </div>

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {/* 축 + 눈금 */}
        <line x1={L} x2={L + (R - L) * axisP} y1={Y(0)} y2={Y(0)} stroke={ink} strokeWidth={3} />
        {ticks.map((v, i) => {
          return (
            <g key={i} opacity={axisP * 0.9}>
              <line x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke="#D9D4C8" strokeWidth={2} />
              <text x={L - 14} y={Y(v) + 10} textAnchor="end" fontSize={fs.caption} fill="#6B6F78">{step < 1 ? v.toFixed(1) : v.toFixed(0)}</text>
            </g>
          );
        })}
        {xs.map((x, i) => (
          <text key={x} x={X(i)} y={Y(0) + fs.caption + 14} textAnchor="middle" fontSize={fs.caption} fontWeight={700} fill={i < nA ? ink : "#6B6F78"} opacity={axisP}>{x}</text>
        ))}

        {/* 실적/전망 경계: 세로 점선 + '전망' 라벨 */}
        <g opacity={splitP}>
          <line x1={lastA[0]} x2={lastA[0]} y1={T - 20} y2={Y(0)} stroke="#6B6F78" strokeWidth={2} strokeDasharray="8 8" />
          <text x={lastA[0] + 14} y={Y(0) - 18} fontSize={fs.caption} fontWeight={800} fill="#6B6F78" transform={`translate(0 ${(1 - splitP) * -30})`}>전망 →</text>
        </g>

        {/* 전망 범위 띠 (첫 기관) */}
        {p.forecasts[0].low && p.forecasts[0].high && (() => {
          const f = p.forecasts[0];
          const up: [number, number][] = [lastA, ...f.high!.map((v, i) => [X(nA + i), Y(v)] as [number, number])];
          const dn: [number, number][] = [...f.low!.map((v, i) => [X(nA + i), Y(v)] as [number, number])].reverse();
          return <path d={`${path(up)} ${dn.map(([x, y]) => `L${x},${y}`).join(" ")} L${lastA[0]},${lastA[1]} Z`} fill={ACC[0]} opacity={0.14 * fcP} />;
        })()}

        {/* 실적 실선 (그려지듯) */}
        <path d={path(actPts)} fill="none" stroke={ink} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - actP} />
        {actPts.map(([x, y], i) => {
          const on = actP >= i / Math.max(1, nA - 1) - 0.001;
          return on ? (
            <g key={i}>
              <circle cx={x} cy={y} r={11} fill={ink} />
              <text x={x} y={y - 24} textAnchor="middle" fontSize={fs.caption} fontWeight={800} fill={ink}>{p.actual.points[i].y.toFixed(1)}</text>
            </g>
          ) : null;
        })}

        {/* 기관별 전망 점선 */}
        {p.forecasts.map((f, k) => {
          const pts: [number, number][] = [lastA, ...f.points.map((d, i) => [X(nA + i), Y(d.y)] as [number, number])];
          const vis = Math.max(0, Math.min(1, fcP * (p.forecasts.length) - k * 0.6));
          const end = pts[pts.length - 1];
          return (
            <g key={k} opacity={vis > 0 ? 1 : 0}>
              <path d={path(pts)} fill="none" stroke={ACC[k % 3]} strokeWidth={7} strokeDasharray="16 12" strokeLinecap="round"
                style={{ clipPath: `inset(0 ${(1 - vis) * 100}% 0 0)` }} />
              {vis > 0.95 && (
                <>
                  <circle cx={end[0]} cy={end[1]} r={11} fill={paper} stroke={ACC[k % 3]} strokeWidth={5} />
                  <text x={end[0] + (land ? 20 : -16)} y={end[1] + (land ? 10 : k ? 44 : -26)} textAnchor={land ? "start" : "end"} fontSize={fs.caption} fontWeight={800} fill={ACC[k % 3]}>
                    {f.label} {f.points[f.points.length - 1].y.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* 손글씨 메모 (마커 느낌, 그려지듯 clip) */}
      <div style={{ position: "absolute", left: land ? X(nA - 1) - 40 : SAFE.left, top: land ? T - 80 : B + 70, fontSize: fs.body, fontWeight: 800, color: ACC[0],
        transform: "rotate(-3deg)", clipPath: `inset(0 ${(1 - noteP) * 100}% 0 0)`, whiteSpace: "nowrap" }}>
        <span style={{ borderBottom: `6px solid ${ACC[0]}`, paddingBottom: 4 }}>{p.note}</span>
      </div>

      {/* 출처 각주 — 반드시 표기 */}
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom - (land ? 70 : 120), fontSize: Math.max(26, fs.caption * 0.75), color: "#6B6F78", opacity: srcP, lineHeight: 1.4 }}>
        출처: {p.actual.source}(실적) · {p.forecasts.map((f) => f.source).join(" · ")} {p.forecasts[0].low ? "· 음영은 전망 범위" : ""}
      </div>
      {p.example && (
        <div style={{ position: "absolute", right: SAFE.right, top: land ? SAFE.top : SAFE.top + fs.title + 90, fontSize: fs.caption, fontWeight: 800, color: "#B4332A", border: "3px solid #B4332A", padding: "4px 12px", borderRadius: 8, transform: "rotate(4deg)" }}>
          예시 데이터
        </div>
      )}
    </AbsoluteFill>
  );
};
