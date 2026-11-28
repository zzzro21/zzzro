// Matter.js: 단어 카드가 위에서 떨어져 바닥에 쌓이는 모션 (1080x1920, 30fps)
// npm i matter-js @types/matter-js
//
// 핵심: 물리 시뮬레이션을 "매 프레임 실시간"으로 돌리면 렌더할 때마다 결과가 달라진다.
// → 0프레임부터 끝까지 고정 간격(1000/fps ms)으로 한 번에 미리 계산해 두고,
//   현재 프레임의 위치만 꺼내 그린다. (Math.random 금지, 시드 고정)
import React, { useMemo } from "react";
import Matter from "matter-js";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type PhysicsWordsProps = {
  words: string[];
  title: string;
};

export const physicsWordsDefaults: PhysicsWordsProps = {
  title: "릴스가 안 터지는 이유",
  words: ["훅 없음", "길이 김", "자막 없음", "타깃 불명", "업로드 불규칙", "CTA 없음"],
};

const CARD_H = 130;
const DROP_EVERY = 7; // 카드 사이 간격(프레임)

type Pose = { x: number; y: number; angle: number; visible: boolean };

// 단어 길이로 카드 폭 대충 추정 (한글 1글자 ≈ 0.95em)
const cardWidth = (w: string) => Math.max(260, w.length * 62 + 90);

// 0..duration 프레임의 모든 카드 위치를 미리 계산
const simulate = (
  words: string[],
  duration: number,
  fps: number,
  width: number,
  height: number,
): Pose[][] => {
  (Matter.Common as unknown as { _seed: number })._seed = 42; // 내부 랜덤도 고정
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.6 } });
  const floorY = height - SAFE.bottom;
  const wall = { isStatic: true };
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(width / 2, floorY + 50, width, 100, wall),
    Matter.Bodies.rectangle(SAFE.side - 50, height / 2, 100, height * 2, wall),
    Matter.Bodies.rectangle(width - SAFE.side + 50, height / 2, 100, height * 2, wall),
  ]);

  const bodies: (Matter.Body | null)[] = words.map(() => null);
  const frames: Pose[][] = [];

  for (let f = 0; f < duration; f++) {
    words.forEach((w, i) => {
      if (f === i * DROP_EVERY + 12) {
        // 좌우 위치·기울기를 인덱스로 결정 → 매번 같은 결과
        const x = width / 2 + ((i % 3) - 1) * 160;
        const b = Matter.Bodies.rectangle(x, SAFE.top + 260, cardWidth(w), CARD_H, {
          angle: ((i % 2 ? 1 : -1) * (6 + i * 2) * Math.PI) / 180,
          restitution: 0.35, // 통통 튀는 정도
          friction: 0.6,
          chamfer: { radius: 24 },
        });
        bodies[i] = b;
        Matter.Composite.add(engine.world, b);
      }
    });
    Matter.Engine.update(engine, 1000 / fps);
    frames.push(
      bodies.map((b) =>
        b
          ? { x: b.position.x, y: b.position.y, angle: b.angle, visible: true }
          : { x: 0, y: 0, angle: 0, visible: false },
      ),
    );
  }
  return frames;
};

export const PhysicsWords: React.FC<PhysicsWordsProps> = ({ words, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  const frames = useMemo(
    () => simulate(words, durationInFrames, fps, width, height),
    [words, durationInFrames, fps, width, height],
  );
  const poses = frames[Math.min(frame, frames.length - 1)];

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font }}>
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          left: SAFE.side,
          right: SAFE.side,
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: BRAND.text,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      {words.map((w, i) => {
        const p = poses[i];
        if (!p.visible) return null;
        const cw = cardWidth(w);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x - cw / 2,
              top: p.y - CARD_H / 2,
              width: cw,
              height: CARD_H,
              transform: `rotate(${p.angle}rad)`,
              borderRadius: 24,
              background: i === words.length - 1 ? BRAND.accent : "#FFFFFF",
              color: i === words.length - 1 ? "#FFFFFF" : BRAND.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {w}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
