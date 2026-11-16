// Anime.js v4: 글자·도형·SVG 선을 한 타임라인으로 '안무'하는 모션 (1080x1920, 30fps)
// npm i animejs
//
// 핵심 1: anime 는 원래 스스로 재생된다 → autoplay:false 로 멈춰 두고,
//         Remotion 프레임마다 tl.seek(ms) 로 "그 시점" 으로 점프시킨다. (재생 X, 탐색 O)
// 핵심 2: 타임라인은 한 번만 만든다(useLayoutEffect). seek 은 동기라 delayRender 필요 없음.
// 핵심 3: anime 가 움직이는 속성(transform, opacity)은 React style 에 쓰지 않는다.
//         React 가 다시 그릴 때 덮어써 버리기 때문.
// 핵심 4: utils.random() 쓰지 말 것 (렌더할 때마다 달라짐). stagger 는 OK.
import React, { useLayoutEffect, useRef } from "react";
import { createTimeline, stagger, svg, type Timeline } from "animejs";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type AnimeTimelineProps = {
  kicker: string; // 위 작은 글씨
  title: string; // 글자 단위로 등장
  tags: string[]; // 아래 알약 태그
};

export const animeTimelineDefaults: AnimeTimelineProps = {
  kicker: "오늘의 루틴",
  title: "하루 10분 기록법",
  tags: ["아침 3줄", "점심 1줄", "밤 회고"],
};

export const AnimeTimeline: React.FC<AnimeTimelineProps> = ({ kicker, title, tags }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = width > height;
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<Timeline | null>(null);

  // 1) 타임라인 한 번만 생성 (ms 단위)
  useLayoutEffect(() => {
    const $ = (sel: string) => root.current!.querySelectorAll(sel);
    const t = createTimeline({
      autoplay: false,
      defaults: { ease: "outExpo", duration: 700 },
    })
      .add($(".kicker"), { opacity: [0, 1], translateY: [20, 0] }, 0)
      .add(
        $(".ch"),
        {
          opacity: [0, 1],
          translateY: [90, 0],
          rotate: [12, 0],
          delay: stagger(35), // 글자마다 35ms 차이
        },
        150,
      )
      .add(svg.createDrawable($(".swoosh")), { draw: ["0 0", "0 1"], duration: 600, ease: "inOutQuad" }, 700)
      .add(
        $(".tag"),
        { opacity: [0, 1], scale: [0.6, 1], delay: stagger(90), ease: "outBack(2)" },
        950,
      )
      .add($(".dot"), { scale: [0, 1], delay: stagger(60, { from: "center" }) }, 1100);
    tl.current = t;
    return () => {
      t.revert();
    };
  }, [title, tags.length]);

  // 2) 매 프레임: 해당 시점으로 이동
  useLayoutEffect(() => {
    tl.current?.seek((frame / fps) * 1000);
  }, [frame, fps]);

  return (
    <AbsoluteFill ref={root} style={{ background: BRAND.bg, fontFamily: BRAND.font }}>
      <div
        style={{
          position: "absolute",
          top: landscape ? SAFE.top + 90 : SAFE.top + 380,
          left: SAFE.side,
          right: SAFE.side,
          color: BRAND.text,
        }}
      >
        <div className="kicker" style={{ fontSize: 56, fontWeight: 700, color: BRAND.accent, opacity: 0 }}>
          {kicker}
        </div>
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 20 }}>
          {[...title].map((c, i) => (
            <span key={i} className="ch" style={{ display: "inline-block", opacity: 0, whiteSpace: "pre" }}>
              {c}
            </span>
          ))}
        </div>
        <svg width={900} height={80} style={{ display: "block", marginTop: 8 }}>
          <path
            className="swoosh"
            d="M10 50 C 200 10, 400 75, 600 35 S 850 30, 890 45"
            stroke={BRAND.accent}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div style={{ display: "flex", gap: 20, marginTop: 60, flexWrap: "wrap" }}>
          {tags.map((t, i) => (
            <div
              key={i}
              className="tag"
              style={{
                opacity: 0,
                padding: "18px 34px",
                borderRadius: 999,
                border: `4px solid ${BRAND.text}`,
                fontSize: 52,
                fontWeight: 800,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: landscape ? 60 : 120, justifyContent: "center" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="dot"
              style={{ width: 26, height: 26, borderRadius: 13, background: i === 3 ? BRAND.accent : "#3A3A40", transform: "scale(0)" }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
