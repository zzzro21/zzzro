// 첫 3초 훅용 키네틱 타이포그래피 템플릿 (채널별 크기·속도는 brand.ts)
// 사용: Root.tsx 에서 <Composition component={KineticHook} ... /> 로 등록
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BRAND, SAFE, PROFILE } from "./brand";
// 브랜드 색·폰트와 채널별 안전영역은 brand.ts 에서 관리 (다른 템플릿도 여기서 re-export 받아 씀)
export { BRAND, SAFE };

export type KineticHookProps = {
  lines: string[]; // 한 줄씩 등장할 문장
  highlight: string; // 강조할 단어 (lines 안에 그대로 있어야 함)
};

export const kineticHookDefaults: KineticHookProps = {
  lines: ["퇴근 후 30분으로", "팔로워 1만", "만든 방법"],
  highlight: "1만",
};

const STAGGER = PROFILE.pace.stagger; // 줄 사이 간격(프레임) — 채널별

const Line: React.FC<{ text: string; index: number; highlight: string }> = ({
  text,
  index,
  highlight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = index * STAGGER;

  // 아래에서 튀어 오르며 등장 (오버슈트 약간)
  const enter = spring({
    frame: frame - start,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.6 },
  });
  const y = interpolate(enter, [0, 1], [80, 0]);
  const opacity = interpolate(frame - start, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const parts = text.split(highlight);
  const hasHighlight = parts.length > 1;

  // 강조 박스: 줄이 다 올라온 뒤 좌→우로 채워짐
  const boxStart = start + 10;
  const box = interpolate(frame, [boxStart, boxStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        transform: `translateY(${y}px)`,
        opacity,
        fontSize: PROFILE.type.headline,
        fontWeight: 800,
        lineHeight: 1.15,
        letterSpacing: "-0.03em",
        color: BRAND.text,
        whiteSpace: "nowrap",
      }}
    >
      {hasHighlight ? (
        <>
          {parts[0]}
          <span style={{ position: "relative", display: "inline-block" }}>
            <span
              style={{
                position: "absolute",
                left: -12,
                right: -12,
                top: "12%",
                bottom: "8%",
                background: BRAND.accent,
                transformOrigin: "left center",
                transform: `scaleX(${box})`,
                borderRadius: 10,
              }}
            />
            <span style={{ position: "relative" }}>{highlight}</span>
          </span>
          {parts.slice(1).join(highlight)}
        </>
      ) : (
        text
      )}
    </div>
  );
};

export const KineticHook: React.FC<KineticHookProps> = ({ lines, highlight }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 마지막 8프레임: 위로 빠지며 퇴장
  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) },
  );

  // 전체에 아주 느린 줌 → 화면이 멈춰 보이지 않게
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.04]);

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font }}>
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          justifyContent: "center",
          transform: `scale(${drift}) translateY(${-exit * 120}px)`,
          opacity: 1 - exit,
        }}
      >
        {lines.map((t, i) => (
          <Line key={i} text={t} index={i} highlight={highlight} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
