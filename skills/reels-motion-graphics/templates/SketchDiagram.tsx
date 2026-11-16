// Rough.js: 손그림 느낌 도형이 그려지는 다이어그램 (1080x1920, 30fps)
// npm i roughjs
//
// 핵심 1: rough 는 그릴 때마다 랜덤하게 흔들린다 → 반드시 seed 를 고정한다.
//         (seed 를 4프레임마다 바꾸면 일부러 '보글보글' 떨리는 손그림 애니메이션이 됨)
// 핵심 2: rough.generator().toPaths() 로 SVG path 문자열만 받아서 React 로 그린다.
//         DOM/canvas 에 직접 그리지 않으므로 렌더가 안정적이다.
import React from "react";
import rough from "roughjs";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type SketchDiagramProps = {
  steps: string[]; // 위→아래 순서로 그려질 박스
  boil: boolean; // true 면 선이 계속 미세하게 떨림
};

export const sketchDiagramDefaults: SketchDiagramProps = {
  steps: ["아이디어", "대본", "촬영", "업로드"],
  boil: true,
};

const gen = rough.generator();
const PER_STEP = 18; // 박스 하나 그리는 데 걸리는 프레임

const BOX_W = 620;
const BOX_H = 190;
const GAP = 150;

// 손그림 path 를 '그려지듯' 보여주기: pathLength=1 + dashoffset
const DrawnPath: React.FC<{
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  progress: number;
}> = ({ d, stroke, strokeWidth, fill, progress }) => (
  <path
    d={d}
    stroke={stroke}
    strokeWidth={strokeWidth}
    fill={fill ?? "none"}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - progress}
    strokeLinecap="round"
  />
);

export const SketchDiagram: React.FC<SketchDiagramProps> = ({ steps, boil }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cx = W / 2;
  // 세로(9:16)는 위→아래, 가로(16:9)는 박스를 줄여서 위→아래 유지
  const boxH = H < W ? Math.min(BOX_H, (H - SAFE.top - SAFE.bottom - (steps.length - 1) * 60) / steps.length) : BOX_H;
  const gap = H < W ? 60 : GAP;
  // boil: 4프레임마다 seed 를 바꿔서 손그림 애니메이션 느낌 (항상 1 이상이어야 고정됨)
  const seedBase = boil ? Math.floor(frame / 4) * 7 + 1 : 1;

  const x = (W - BOX_W) / 2;
  const totalH = steps.length * boxH + (steps.length - 1) * gap;
  const top = SAFE.top + (H - SAFE.top - SAFE.bottom - totalH) / 2;

  return (
    <AbsoluteFill style={{ background: "#FAF7F0", fontFamily: BRAND.font }}>
      <svg width={W} height={H}>
        {steps.map((label, i) => {
          const y = top + i * (boxH + gap);
          const start = i * PER_STEP;
          const p = interpolate(frame, [start, start + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
          });
          const isLast = i === steps.length - 1;
          const box = gen.rectangle(x, y, BOX_W, boxH, {
            seed: seedBase + i,
            roughness: 1.6,
            strokeWidth: 5,
            stroke: "#1A1A1A",
            fill: isLast ? BRAND.accent : undefined,
            fillStyle: "hachure", // 빗금 채우기
            hachureGap: 14,
            fillWeight: 3,
          });
          const arrow =
            i < steps.length - 1
              ? gen.linearPath(
                  [
                    [cx, y + boxH + 18],
                    [cx, y + boxH + gap - 22],
                  ],
                  { seed: seedBase + 50 + i, roughness: 1.4, strokeWidth: 5 },
                )
              : null;
          const head =
            i < steps.length - 1
              ? gen.linearPath(
                  [
                    [cx - 35, y + boxH + gap - 55],
                    [cx, y + boxH + gap - 20],
                    [cx + 35, y + boxH + gap - 55],
                  ],
                  { seed: seedBase + 90 + i, roughness: 1.2, strokeWidth: 5 },
                )
              : null;
          const arrowP = interpolate(frame, [start + 12, start + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const textOpacity = interpolate(frame, [start + 8, start + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <g key={i}>
              {gen.toPaths(box).map((pi, k) => (
                <DrawnPath
                  key={k}
                  d={pi.d}
                  stroke={pi.stroke === "none" ? "#1A1A1A" : pi.stroke}
                  strokeWidth={pi.strokeWidth}
                  progress={p}
                />
              ))}
              {[arrow, head].map((dr, k) =>
                dr
                  ? gen.toPaths(dr).map((pi, j) => (
                      <DrawnPath
                        key={`${k}-${j}`}
                        d={pi.d}
                        stroke="#1A1A1A"
                        strokeWidth={pi.strokeWidth}
                        progress={arrowP}
                      />
                    ))
                  : null,
              )}
              <text
                x={cx}
                y={y + boxH / 2 + 26}
                textAnchor="middle"
                fontSize={76}
                fontWeight={800}
                fill="#1A1A1A"
                opacity={textOpacity}
                style={{ letterSpacing: "-0.03em" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
