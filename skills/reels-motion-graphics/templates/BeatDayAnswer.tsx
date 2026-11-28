// 비트 싱크 템플릿: "오늘 무슨 요일?" 같은 사소한 질문에 과하게 멋진 답 (1080x1920, 30fps, BGM 포함)
//
// 짝꿍: tools/synth_bgm.py 로 만든 public/bgm.wav (코드로 합성, 외부 음원 없음)
//   python3 synth_bgm.py --bpm 120 --seconds 12 --fps 30 --out public/bgm.wav
// 구간 계산은 synth_bgm.py 와 똑같다: 인트로 2마디 → 빌드업 2마디 → 드롭 → 마지막 1마디 엔딩.
// → 컷·플래시·슬램이 전부 비트 프레임에 떨어진다.
//
// 날짜는 props 로 받는다. new Date() 를 컴포넌트 안에서 쓰면 렌더 시점마다 바뀔 수 있으니 금지.
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, SAFE } from "./KineticHook";

export type BeatDayAnswerProps = {
  date: string; // "2026-11-16" — 만들 때 오늘 날짜를 넣는다
  question: string;
  outro: string;
  bpm: number; // synth_bgm.py 와 같은 값
  audio: string; // public/ 기준 파일명
};

export const beatDayAnswerDefaults: BeatDayAnswerProps = {
  date: "2026-11-16",
  question: "오늘 무슨 요일이지?",
  outro: "이번 주도 버텨봅시다",
  bpm: 120,
  audio: "bgm.wav",
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const BeatDayAnswer: React.FC<BeatDayAnswerProps> = ({ date, question, outro, bpm, audio }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  // ── 비트 그리드 (synth_bgm.py 와 같은 공식) ──
  const fpb = (60 / bpm) * fps; // frames per beat (120bpm@30fps = 15)
  const bar = fpb * 4;
  const BUILD = Math.round(bar * 2);
  const DROP = Math.round(bar * 4);
  const END = Math.round(durationInFrames - bar);
  const beatIdx = Math.floor(frame / fpb);
  const sinceBeat = frame - beatIdx * fpb; // 이번 비트 시작 후 몇 프레임
  const pulse = Math.exp(-sinceBeat / 4); // 비트마다 1 → 0 으로 빠르게 감소

  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayName = `${DAYS[dow]}요일`;
  const toWeekend = dow === 0 || dow === 6 ? 0 : 6 - dow;

  let scene: React.ReactNode;

  if (frame < BUILD) {
    // ① 인트로: 질문 타이핑 + 비트마다 커서 깜빡/살짝 펄스
    const chars = Math.floor(interpolate(frame, [4, BUILD - fpb], [0, question.length], clamp));
    scene = (
      <div style={{ fontSize: 96, fontWeight: 800, color: BRAND.text, transform: `scale(${1 + pulse * 0.015})` }}>
        {question.slice(0, chars)}
        <span style={{ color: BRAND.accent, opacity: beatIdx % 2 ? 0.2 : 1 }}>▍</span>
      </div>
    );
  } else if (frame < DROP) {
    // ② 빌드업: 요일 룰렛 — 점점 빨라짐 (비트 → 반박 → 4분의1박)
    const p = (frame - BUILD) / (DROP - BUILD);
    const step = p < 0.5 ? fpb : p < 0.8 ? fpb / 2 : fpb / 4;
    const idx = Math.floor((frame - BUILD) / step) % 7;
    const shake = p > 0.8 ? Math.sin(frame * 3.1) * 6 : 0;
    scene = (
      <div style={{ textAlign: "center", transform: `translateX(${shake}px)` }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#8A8A93", marginBottom: 30 }}>오늘은…</div>
        <div style={{ fontSize: 300, fontWeight: 900, color: BRAND.text, lineHeight: 1, opacity: 0.35 + 0.65 * p }}>
          {DAYS[idx]}
        </div>
      </div>
    );
  } else if (frame < END) {
    // ③ 드롭: 첫 박에 요일 슬램, 이후 2박마다 정보 카드 교체
    const local = frame - DROP;
    const slam = spring({ frame: local, fps, config: { damping: 11, stiffness: 220, mass: 0.7 } });
    const card = Math.floor(local / (fpb * 2)); // 2박마다
    const infos = [
      `${m}월 ${d}일`,
      `이번 주 ${dow === 0 ? 7 : dow}/7`,
      toWeekend === 0 ? "주말입니다" : `주말까지 ${toWeekend}일`,
      dayName,
    ];
    const info = infos[card % infos.length];
    const cardIn = interpolate(local - card * fpb * 2, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const weekP = (dow === 0 ? 7 : dow) / 7;
    scene = (
      <div style={{ textAlign: "center", width: "100%" }}>
        <div
          style={{
            fontSize: 250,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: BRAND.text,
            transform: `scale(${interpolate(slam, [0, 1], [2.4, 1]) * (1 + pulse * 0.04)})`,
          }}
        >
          {DAYS[dow]}
          <span style={{ color: BRAND.accent }}>요일</span>
        </div>
        <div style={{ height: 120, marginTop: 40, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: BRAND.text,
              opacity: cardIn,
              transform: `translateY(${(1 - cardIn) * 60}px)`,
            }}
          >
            {info}
          </div>
        </div>
        {/* 주간 진행 바: 비트마다 살짝 튐 */}
        <div style={{ margin: "40px auto 0", width: width - SAFE.side * 2 - 80, height: 18, borderRadius: 9, background: "#26262B" }}>
          <div
            style={{
              width: `${interpolate(local, [0, fpb * 2], [0, weekP], { ...clamp, easing: Easing.out(Easing.cubic) }) * 100}%`,
              height: "100%",
              borderRadius: 9,
              background: BRAND.accent,
              transform: `scaleY(${1 + pulse * 0.6})`,
            }}
          />
        </div>
      </div>
    );
  } else {
    // ④ 엔딩: 스팅 코드에 맞춰 한 줄, 끝까지 정지
    const e = spring({ frame: frame - END, fps, config: { damping: 18, stiffness: 120 } });
    scene = (
      <div style={{ textAlign: "center", opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
        <div style={{ fontSize: 92, fontWeight: 900, color: BRAND.text }}>{outro}</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: BRAND.accent, marginTop: 30 }}>
          {m}.{d} {dayName}
        </div>
      </div>
    );
  }

  // 드롭 첫 프레임 화이트 플래시 (3프레임)
  const flash = interpolate(frame, [DROP, DROP + 3], [0.9, 0], clamp) * (frame >= DROP ? 1 : 0);

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font, letterSpacing: "-0.03em" }}>
      <Audio src={staticFile(audio)} />
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px`,
          justifyContent: "center",
          alignItems: frame < BUILD ? "flex-start" : "center",
        }}
      >
        {scene}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
