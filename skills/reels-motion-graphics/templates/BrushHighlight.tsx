// p5.brush (standalone): 마커 밑줄·연필 동그라미·수채화 얼룩으로 손으로 칠한 듯한 강조 (1080x1920, 30fps)
// npm i p5.brush        ← p5.js 없이 쓰는 standalone 빌드 사용 (WebGL2 필요)
//
// 핵심 1: 붓 자국은 랜덤 → 매 프레임 brush.seed(고정값) 후 '처음부터 다시' 그린다.
//         (이전 프레임 위에 덧칠하면 렌더 순서에 따라 결과가 달라짐)
// 핵심 2: "그려지는" 느낌은 선의 끝점을 progress 만큼만 늘려서 낸다.
// 핵심 3: 글자는 브러시로 못 쓰므로 React <div> 로 캔버스 위에 얹는다.
// 핵심 4: 그린 뒤 brush.render() 를 꼭 호출해야 화면에 반영된다.
// 핵심 5: 좌표 (0,0) 이 화면 "가운데" 다 → translate(-w/2, -h/2) 로 왼쪽 위 기준으로 바꿔 쓴다.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as brush from "p5.brush/standalone";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type BrushHighlightProps = {
  line1: string;
  line2: string; // 이 줄에 마커 밑줄 + 동그라미
  paper: string;
  ink: string;
};

export const brushHighlightDefaults: BrushHighlightProps = {
  line1: "저장해두면",
  line2: "무조건 써먹는 팁",
  paper: "#F4EFE6",
  ink: "#1F1B16",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const BrushHighlight: React.FC<BrushHighlightProps> = ({ line1, line2, paper, ink }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const [initHandle] = useState(() => delayRender("p5.brush 초기화"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const canvas = brush.createCanvas(width, height, { parent: hostRef.current });
    brush.scaleBrushes(2.4); // 1080 해상도에 맞게 붓 두께 키우기
    setReady(true);
    continueRender(initHandle);
    return () => canvas.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textTop = SAFE.top + 520;
  const lineY = textTop + 300; // 두 번째 줄 아래
  const cx = width / 2;

  useLayoutEffect(() => {
    if (!ready) return;
    const handle = delayRender(`brush frame ${frame}`);

    brush.seed(7); // ← 매 프레임 같은 seed: 같은 붓 자국
    brush.noiseSeed(7);
    brush.clear(paper);
    brush.push();
    brush.translate(-width / 2, -height / 2); // 이제부터 (0,0) = 왼쪽 위

    // ① 수채화 얼룩 (0~18프레임에 퍼짐)
    const wash = interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    if (wash > 0) {
      brush.noStroke();
      brush.fill(BRAND.accent, 70 * wash);
      brush.fillBleed(0.25);
      brush.fillTexture(0.6, 0.4);
      brush.circle(cx + 260, textTop - 40, 60 + 170 * wash);
      brush.noFill();
    }

    // ② 마커 밑줄 (14~30프레임, 왼→오 그어짐)
    const u = interpolate(frame, [14, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    if (u > 0.01) {
      brush.set("marker", BRAND.accent, 5);
      const x0 = SAFE.side + 20;
      const x1 = width - SAFE.side - 20;
      brush.line(x0, lineY, x0 + (x1 - x0) * u, lineY - 14 * u);
    }

    // ③ 연필 강조 표시 — 첫 줄 옆에 체크 (32~44프레임)
    const c = interpolate(frame, [32, 44], [0, 1], clamp);
    if (c > 0.01) {
      brush.set("2B", ink, 3);
      const a: [number, number] = [cx + 300, textTop + 40];
      const b: [number, number] = [cx + 340, textTop + 90];
      const d: [number, number] = [cx + 420, textTop - 30];
      const p1 = Math.min(1, c * 2.5);
      brush.line(a[0], a[1], a[0] + (b[0] - a[0]) * p1, a[1] + (b[1] - a[1]) * p1);
      if (c > 0.4) {
        const p2 = (c - 0.4) / 0.6;
        brush.line(b[0], b[1], b[0] + (d[0] - b[0]) * p2, b[1] + (d[1] - b[1]) * p2);
      }
    }

    brush.pop();
    brush.render(); // ← 필수
    continueRender(handle);
  }, [frame, ready, paper, ink, cx, textTop, lineY, width]);

  const textIn = (start: number) => ({
    opacity: interpolate(frame, [start, start + 8], [0, 1], clamp),
    transform: `translateY(${interpolate(frame, [start, start + 10], [30, 0], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    })}px)`,
  });

  return (
    <AbsoluteFill style={{ background: paper }}>
      <AbsoluteFill ref={hostRef} />
      <AbsoluteFill
        style={{
          top: textTop,
          left: SAFE.side,
          right: SAFE.side,
          height: "auto",
          fontFamily: BRAND.font,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: ink,
          lineHeight: 1.2,
        }}
      >
        <div style={{ fontSize: 110, ...textIn(2) }}>{line1}</div>
        <div style={{ fontSize: 110, ...textIn(8) }}>{line2}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
