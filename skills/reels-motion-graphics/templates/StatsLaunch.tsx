// 실적·숫자 PV: 로고 → KPI 카운트업 → 매출 막대그래프 → 드롭에서 성장률 슬램 → 로고 도장 (1080x1920, 30fps, 12초)
//
// 짝꿍 (둘 다 tools/ 에 있음, 외부 음원 없음):
//   python3 synth_bgm.py --bpm 120 --seconds 12 --fps 30 --out public/bgm.wav
//   python3 synth_sfx.py --out public/sfx
// 장면 경계 = synth_bgm.py 구간: 0~4s 인트로, 4~8s 빌드업(그래프), 8s 드롭(슬램), 10s 엔딩(도장)
// 효과음은 '착지' 프레임에 둔다.
//
// ⚠️ 숫자는 사용자가 준 것만. 예시 값은 가상(데모)이며 화면 하단에 '※ 가상 데이터' 를 표시한다.
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type StatsLaunchProps = {
  company: string;
  kpis: { label: string; value: number; suffix: string }[];
  quarters: { label: string; value: number }[]; // 막대그래프 (단위 자유)
  chartUnit: string;
  growthText: string; // 드롭에서 쾅
  cta: string;
  fictional: boolean; // true 면 '※ 가상 데이터' 표기
  bpm: number;
};

export const statsLaunchDefaults: StatsLaunchProps = {
  company: "NOVA LAB",
  kpis: [
    { label: "누적 고객", value: 12800, suffix: "명" },
    { label: "재구매율", value: 68, suffix: "%" },
    { label: "평균 별점", value: 4.9, suffix: "" },
  ],
  quarters: [
    { label: "1Q", value: 1.2 },
    { label: "2Q", value: 2.1 },
    { label: "3Q", value: 3.4 },
    { label: "4Q", value: 4.9 },
  ],
  chartUnit: "억원",
  growthText: "+308%",
  cta: "2027, 더 크게.",
  fictional: true,
  bpm: 120,
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

const Sfx: React.FC<{ at: number; name: string; volume?: number }> = ({ at, name, volume = 0.8 }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={45} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

const fmt = (v: number, target: number) =>
  Number.isInteger(target) ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(1);

export const StatsLaunch: React.FC<StatsLaunchProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const fpb = (60 / p.bpm) * fps;
  const bar = fpb * 4;
  const KPI = Math.round(bar * 1); // 2s
  const CHART = Math.round(bar * 2); // 4s (빌드업)
  const DROP = Math.round(bar * 4); // 8s
  const END = Math.round(bar * 5); // 10s
  const W = width - SAFE.side * 2;

  // ── 장면별 그림 ──
  let scene: React.ReactNode = null;
  const sfx: React.ReactNode[] = [];

  // 0) 로고
  if (frame < KPI) {
    const s = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 170 } });
    const out = interpolate(frame, [KPI - 6, KPI], [1, 0], clamp);
    scene = (
      <div style={{ textAlign: "center", opacity: out }}>
        <div style={{ width: 150, height: 150, margin: "0 auto 40px", borderRadius: 40, background: BRAND.accent, transform: `scale(${s}) rotate(${(1 - s) * -90}deg)` }} />
        <div style={{ fontSize: 110, fontWeight: 900, color: BRAND.text, letterSpacing: "0.04em", opacity: s }}>{p.company}</div>
      </div>
    );
  }
  sfx.push(<Sfx key="w0" at={2} name="whoosh" volume={0.5} />, <Sfx key="p0" at={14} name="pop" />);

  // 1) KPI 카운트업 (2~4s) — 카드마다 1박 간격, 카운트 20프레임 후 착지 pop
  if (frame >= KPI && frame < CHART) {
    scene = (
      <div style={{ width: W }}>
        {p.kpis.map((k, i) => {
          const st = KPI + i * (fpb / 2);
          const inP = interpolate(frame, [st, st + 8], [0, 1], { ...clamp, easing: easeOut });
          const v = interpolate(frame, [st, st + 20], [0, k.value], { ...clamp, easing: Easing.out(Easing.quad) });
          const land = frame - (st + 20);
          const bump = land >= 0 ? 1 + 0.06 * Math.exp(-land / 3) : 1;
          const out = interpolate(frame, [CHART - 6, CHART], [1, 0], clamp);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "34px 0", borderBottom: "3px solid #2A2A30", opacity: inP * out, transform: `translateX(${(1 - inP) * -60}px)` }}>
              <div style={{ fontSize: 54, fontWeight: 700, color: "#9A9AA3" }}>{k.label}</div>
              <div style={{ fontSize: 120, fontWeight: 900, color: i === 0 ? BRAND.accent : BRAND.text, transform: `scale(${bump})`, transformOrigin: "right center" }}>
                {fmt(v, k.value)}
                <span style={{ fontSize: 60 }}>{k.suffix}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  p.kpis.forEach((_, i) => {
    const st = KPI + i * (fpb / 2);
    for (let t = 0; t < 20; t += 4) sfx.push(<Sfx key={`t${i}-${t}`} at={st + t} name="tick" volume={0.4} />);
    sfx.push(<Sfx key={`kp${i}`} at={st + 20} name="pop" />);
  });

  // 2) 매출 막대그래프 (4~8s, 빌드업) — 막대 1박에 하나씩, 착지 pop / 마지막 막대만 강조색
  const maxV = Math.max(...p.quarters.map((q) => q.value));
  const chartH = 760;
  if (frame >= CHART && frame < DROP) {
    const title = interpolate(frame, [CHART, CHART + 8], [0, 1], { ...clamp, easing: easeOut });
    const barW = (W - (p.quarters.length - 1) * 40) / p.quarters.length;
    scene = (
      <div style={{ width: W }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: BRAND.text, opacity: title, marginBottom: 60 }}>
          분기별 매출 <span style={{ color: "#8A8A93", fontSize: 44 }}>({p.chartUnit})</span>
        </div>
        <div style={{ position: "relative", height: chartH, display: "flex", alignItems: "flex-end", gap: 40, borderBottom: "4px solid #3A3A40" }}>
          {p.quarters.map((q, i) => {
            const st = CHART + fpb * (i + 1);
            const g = spring({ frame: frame - st, fps, config: { damping: 15, stiffness: 140 } });
            const h = (q.value / maxV) * (chartH - 120) * g;
            const last = i === p.quarters.length - 1;
            return (
              <div key={i} style={{ width: barW, position: "relative", height: h, background: last ? BRAND.accent : "#E8E8EC", borderRadius: "18px 18px 0 0" }}>
                <div style={{ position: "absolute", top: -78, width: "100%", textAlign: "center", fontSize: 54, fontWeight: 900, color: last ? BRAND.accent : BRAND.text, opacity: g }}>
                  {q.value}
                </div>
                <div style={{ position: "absolute", bottom: -70, width: "100%", textAlign: "center", fontSize: 44, fontWeight: 700, color: "#8A8A93" }}>{q.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  sfx.push(<Sfx key="wc" at={CHART - 4} name="whoosh" volume={0.5} />);
  p.quarters.forEach((_, i) => sfx.push(<Sfx key={`qb${i}`} at={CHART + fpb * (i + 1) + 6} name="pop" />));

  // 3) 드롭: 성장률 슬램 (8~10s)
  if (frame >= DROP && frame < END) {
    const s = spring({ frame: frame - DROP, fps, config: { damping: 10, stiffness: 230, mass: 0.8 } });
    const shake = frame - DROP < 6 ? Math.sin((frame - DROP) * 4) * (6 - (frame - DROP)) * 3 : 0;
    scene = (
      <div style={{ textAlign: "center", transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#9A9AA3", marginBottom: 20, opacity: s }}>전년 대비 매출</div>
        <div style={{ fontSize: 260, fontWeight: 900, letterSpacing: "-0.05em", color: BRAND.accent, transform: `scale(${interpolate(s, [0, 1], [2.6, 1])})` }}>{p.growthText}</div>
      </div>
    );
  }
  sfx.push(<Sfx key="hit" at={DROP} name="hit" volume={1} />);

  // 4) 엔딩: 로고 도장 + CTA
  if (frame >= END) {
    const st = spring({ frame: frame - END, fps, config: { damping: 9, stiffness: 260, mass: 0.9 } });
    const cta = interpolate(frame, [END + fpb, END + fpb + 10], [0, 1], { ...clamp, easing: easeOut });
    scene = (
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-block", padding: "26px 56px", border: `10px solid ${BRAND.accent}`, borderRadius: 24, transform: `scale(${interpolate(st, [0, 1], [1.8, 1])}) rotate(-6deg)`, opacity: Math.min(1, st * 1.5) }}>
          <div style={{ fontSize: 110, fontWeight: 900, color: BRAND.accent, letterSpacing: "0.04em" }}>{p.company}</div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, color: BRAND.text, marginTop: 70, opacity: cta, transform: `translateY(${(1 - cta) * 30}px)` }}>{p.cta}</div>
      </div>
    );
  }
  sfx.push(<Sfx key="stamp" at={END + 4} name="stamp" volume={1} />, <Sfx key="ding" at={END + fpb + 6} name="ding" volume={0.5} />);

  const flash = frame >= DROP ? interpolate(frame, [DROP, DROP + 3], [0.8, 0], clamp) : 0;

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font, letterSpacing: "-0.03em" }}>
      <Audio src={staticFile("bgm.wav")} volume={0.7} />
      {sfx}
      <AbsoluteFill style={{ padding: `${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px`, justifyContent: "center", alignItems: "center" }}>
        {scene}
      </AbsoluteFill>
      {p.fictional && (
        <div style={{ position: "absolute", bottom: SAFE.bottom - 80, width: "100%", textAlign: "center", fontSize: 30, color: "#6A6A72" }}>
          ※ 회사·수치는 가상 데이터입니다
        </div>
      )}
      <AbsoluteFill style={{ background: "#FFF", opacity: flash }} />
    </AbsoluteFill>
  );
};
