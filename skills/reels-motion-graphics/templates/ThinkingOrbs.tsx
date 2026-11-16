// thinking-orbs: 'AI 가 생각 중' 점 구체 애니메이션 — 상태가 바뀌며 라벨도 바뀜 (1080x1920, 30fps)
// npm i thinking-orbs
//
// 핵심 1: <ThinkingOrb> 컴포넌트를 그대로 쓰면 안 된다. 내부가 performance.now()(실제 시계)로
//         돌아서 렌더할 때마다 다른 그림이 나온다.
// 핵심 2: 대신 'thinking-orbs/engine' 의 순수 함수 MODE_FRAMES[mode](size, t, opts) 에
//         t = (frame / fps) × 프리셋속도 를 넣어 직접 그린다. → 같은 프레임 = 같은 그림.
// 핵심 3: 프리셋은 64px 용으로 튜닝돼 있다 → 64 로 계산하고 캔버스를 확대(scale)해서 크게 그린다.
//         (점은 벡터 원이라 확대해도 선명함)
import React, { useLayoutEffect, useRef } from "react";
import { MODE_FRAMES, paintFrame, resolvePreset, type OrbState } from "thinking-orbs/engine";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type ThinkingOrbsProps = {
  // 순서대로 바뀌는 상태 + 아래 표시할 문구
  steps: { state: OrbState; label: string }[];
  framesPerStep: number;
  orbPx: number; // 화면에 그릴 구체 지름(px)
};

export const thinkingOrbsDefaults: ThinkingOrbsProps = {
  steps: [
    { state: "searching", label: "자료 찾는 중" },
    { state: "solving", label: "문제 푸는 중" },
    { state: "composing", label: "대본 쓰는 중" },
  ],
  framesPerStep: 40,
  orbPx: 560,
};

const BASE = 64; // 프리셋이 튜닝된 크기

// hex → {r,g,b} (paintFrame 의 tint 용)
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const Orb: React.FC<{ state: OrbState; px: number; opacity: number; scale: number }> = ({
  state,
  px,
  opacity,
  scale,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { mode, speed, opts } = resolvePreset(state, BASE);
    const t = (frame / fps) * speed; // ← 시계 대신 프레임으로 시간 계산
    const k = px / BASE;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, BASE, BASE);
    // dark=true: 어두운 배경용(밝은 점). 흰 점 대신 브랜드 색을 원하면 tint 사용
    paintFrame(ctx, MODE_FRAMES[mode](BASE, t, opts), true, hexToRgb(BRAND.text));
  }, [frame, fps, state, px]);

  return (
    <canvas
      ref={ref}
      width={px}
      height={px}
      style={{
        position: "absolute",
        inset: 0,
        margin: "auto",
        opacity,
        transform: `scale(${scale})`,
      }}
    />
  );
};

export const ThinkingOrbs: React.FC<ThinkingOrbsProps> = ({ steps, framesPerStep, orbPx: orbPxProp }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const landscape = width > height;
  const orbPx = landscape ? Math.min(orbPxProp, Math.round(height * 0.5)) : orbPxProp; // 16:9 에선 줄임
  const FADE = 8; // 상태 전환 겹치는 프레임

  const orbTop = landscape ? Math.round((height - orbPx - 230) / 2) : SAFE.top + 260;

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font }}>
      {/* 구체 영역 */}
      <div style={{ position: "absolute", top: orbTop, left: 0, right: 0, height: orbPx }}>
        {steps.map((s, i) => {
          const start = i * framesPerStep;
          const end = start + framesPerStep;
          const isLast = i === steps.length - 1;
          const fadeIn = i === 0 ? 1 : interpolate(frame, [start - FADE / 2, start + FADE / 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const fadeOut = isLast ? 1 : interpolate(frame, [end - FADE / 2, end + FADE / 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const o = Math.min(fadeIn, fadeOut);
          if (o <= 0) return null;
          // 첫 등장: 작게 → 커지며 나타남
          const pop = i === 0 ? interpolate(frame, [0, 12], [0.6, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)) }) : 1;
          return <Orb key={i} state={s.state} px={orbPx} opacity={o} scale={pop} />;
        })}
      </div>

      {/* 상태 라벨: 아래에서 올라오며 교체 */}
      <div style={{ position: "absolute", top: orbTop + orbPx + 90, left: SAFE.side, right: SAFE.side, height: 140, overflow: "hidden" }}>
        {steps.map((s, i) => {
          const start = i * framesPerStep;
          const end = start + framesPerStep;
          const isLast = i === steps.length - 1;
          const y =
            interpolate(frame, [start, start + 10], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) +
            (isLast ? 0 : interpolate(frame, [end - 6, end + 2], [0, -100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }));
          const visible = frame >= start - 1 && (isLast || frame < end + 3);
          if (!visible) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                textAlign: "center",
                transform: `translateY(${y}%)`,
                fontSize: 84,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: BRAND.text,
              }}
            >
              {s.label}
              <span style={{ color: BRAND.accent }}>{".".repeat(1 + (Math.floor(frame / 8) % 3))}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
