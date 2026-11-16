// PixiJS + pixi-filters: 글리치·글로우·볼록(벌지) 효과 타이틀 (1080x1920, 30fps)
// npm i pixi.js pixi-filters
//
// 핵심 1: Pixi 는 스스로 계속 돌아가는 루프(ticker)가 있다 → autoStart:false 로 끄고,
//         Remotion 프레임이 바뀔 때마다 직접 app.render() 를 한 번씩 호출한다.
// 핵심 2: Pixi v8 의 app.init() 은 비동기 → delayRender 로 준비될 때까지 렌더를 멈춘다.
// 핵심 3: GlitchFilter 의 seed 를 frame 으로 정해야 렌더할 때마다 똑같은 글리치가 나온다.
// 핵심 4: WebGL 이라 화면 없는 서버에서는 `--gl=swangle` 로 렌더한다. (내 PC 에선 기본값으로 OK)
import React, { useEffect, useRef, useState } from "react";
import { Application, Text, Container, Graphics } from "pixi.js";
import { GlitchFilter, AdvancedBloomFilter, BulgePinchFilter } from "pixi-filters";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "./KineticHook";

export type PixiGlitchProps = {
  text: string;
  sub: string;
};

export const pixiGlitchDefaults: PixiGlitchProps = {
  text: "AI 시대",
  sub: "살아남는 3가지",
};

type Scene = {
  app: Application;
  title: Text;
  glitch: GlitchFilter;
  bloom: AdvancedBloomFilter;
  bulge: BulgePinchFilter;
};

export const PixiGlitch: React.FC<PixiGlitchProps> = ({ text, sub }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [initHandle] = useState(() => delayRender("Pixi 초기화"));
  const [ready, setReady] = useState(false);

  // 1) 한 번만: Pixi 앱 + 필터 생성
  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    app
      .init({
        width,
        height,
        background: BRAND.bg,
        antialias: true,
        autoStart: false, // Pixi 자체 루프 끔
        preference: "webgl",
        preserveDrawingBuffer: true, // 스크린샷에 캔버스가 찍히도록
      })
      .then(() => {
        if (cancelled) return;
        hostRef.current?.appendChild(app.canvas);

        const root = new Container();
        app.stage.addChild(root);
        // 화면 전체 배경을 root 안에 넣어야 필터가 글자 박스가 아닌 화면 전체에 걸린다
        root.addChild(new Graphics().rect(0, 0, width, height).fill(BRAND.bg));

        const title = new Text({
          text,
          style: {
            fontFamily: BRAND.font,
            fontSize: 210,
            fontWeight: "900",
            fill: BRAND.text,
            letterSpacing: -6,
          },
        });
        title.anchor.set(0.5);
        title.position.set(width / 2, height / 2 - 60);

        const subText = new Text({
          text: sub,
          style: { fontFamily: BRAND.font, fontSize: 84, fontWeight: "800", fill: BRAND.accent },
        });
        subText.anchor.set(0.5);
        subText.position.set(width / 2, height / 2 + 140);
        root.addChild(title, subText);

        const glitch = new GlitchFilter({
          slices: 12,
          offset: 60,
          red: { x: 8, y: 0 },
          blue: { x: -8, y: 0 },
          fillMode: 0,
        });
        const bloom = new AdvancedBloomFilter({ threshold: 0.4, bloomScale: 1.2, blur: 10 });
        const bulge = new BulgePinchFilter({
          center: { x: 0.5, y: 0.47 },
          radius: 520,
          strength: 0,
        });
        // 주의: root.filterArea 를 지정하면 필터 여러 개를 겹칠 때 결과가 사라진다(테스트로 확인)
        root.filters = [bulge, glitch, bloom];

        sceneRef.current = { app, title, glitch, bloom, bulge };
        setReady(true);
        continueRender(initHandle);
      });
    return () => {
      cancelled = true;
      sceneRef.current = null;
      app.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 매 프레임: 값만 바꾸고 한 번 그림
  useEffect(() => {
    const s = sceneRef.current;
    if (!ready || !s) return;
    const handle = delayRender(`Pixi frame ${frame}`);

    // 0~10프레임 강한 글리치 → 잦아듦, 45프레임에 한 번 더 '툭'
    const burst =
      interpolate(frame, [0, 12], [1, 0], { extrapolateRight: "clamp" }) +
      interpolate(frame, [44, 46, 52], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    s.glitch.enabled = burst > 0.02;
    s.glitch.seed = ((frame * 9301 + 49297) % 233280) / 233280; // 프레임마다 고정된 seed
    s.glitch.offset = 45 * burst;
    s.glitch.red = { x: 10 * burst, y: 0 };
    s.glitch.blue = { x: -10 * burst, y: 0 };
    s.glitch.refresh();

    // 등장할 때 화면이 볼록 → 평평하게
    s.bulge.strength = interpolate(frame, [0, 14], [0.6, 0], { extrapolateRight: "clamp" });
    s.bloom.bloomScale = 0.8 + 0.6 * burst;
    s.title.scale.set(interpolate(frame, [0, 10], [1.25, 1], { extrapolateRight: "clamp" }));

    s.app.render();
    requestAnimationFrame(() => continueRender(handle));
  }, [frame, ready]);

  return <AbsoluteFill ref={hostRef} style={{ background: BRAND.bg }} />;
};
