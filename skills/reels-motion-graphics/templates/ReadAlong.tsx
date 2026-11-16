// 어린이 영어: 그림책 한 장면 읽어주기 → 핵심 단어 파닉스 → 그림 고르기 퀴즈
// 그림·소리 모두 코드로 (이미지 에셋 없음). 채널: --props='{"channel":"kids-english"}' (1920x1080, 앱 색)
//
// 단계
//  ① 장면: 코드로 그린 그림(해·언덕·고양이…) + 문장. 읽는 단어가 순서대로 하이라이트,
//          그림 속 해당 사물이 그 단어에서 통통 반응 (단어 ↔ 그림 연결 = 학습 포인트)
//  ② 파닉스: 핵심 단어를 소리 단위로 쪼개 색을 다르게 하나씩 → 합쳐서 한 단어로
//  ③ 퀴즈: "Which one is the cat?" 그림 3개 → 정답에 동그라미 + 띵
//
// 내레이션: TTS(OpenAI·ElevenLabs 등)가 연결돼 있으면 words[].at(초) 에 실제 단어 시각을 넣는다.
//          없으면 at 을 비워두면 단어 길이로 자동 배분 (자막만으로도 동작).
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, PROFILE, SAFE } from "./brand";

type PropName = "cat" | "sun" | "tree" | "ball" | "fish";
export type ReadAlongProps = {
  words: { text: string; prop?: PropName; at?: number }[]; // prop: 이 단어에서 반응할 그림
  scene: PropName[]; // 장면에 놓을 그림
  vocab: { word: string; sounds: string[]; prop: PropName };
  quiz: { question: string; choices: PropName[]; answer: PropName };
  narration?: string; // public/ 기준 TTS 파일 (선택)
  sfx: boolean;
};

export const readAlongDefaults: ReadAlongProps = {
  words: [
    { text: "The" }, { text: "little" }, { text: "cat", prop: "cat" }, { text: "plays" },
    { text: "with" }, { text: "a" }, { text: "red" }, { text: "ball", prop: "ball" }, { text: "under" },
    { text: "the" }, { text: "big" }, { text: "sun.", prop: "sun" },
  ],
  scene: ["sun", "tree", "cat", "ball"],
  vocab: { word: "cat", sounds: ["c", "a", "t"], prop: "cat" },
  quiz: { question: "Which one is the cat?", choices: ["fish", "cat", "tree"], answer: "cat" },
  sfx: true,
};

const COLORS = (BRAND as { colors?: string[] }).colors ?? ["#FF8A3D", "#3DA5FF", "#5CC96B", "#FFC83D", "#B07CFF"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── 코드로 그린 그림들 (단순한 도형 = 아이들이 알아보기 쉬움) ──
const Prop: React.FC<{ name: PropName; size: number; t: number; bounce?: number }> = ({ name, size, t, bounce = 0 }) => {
  const s = size / 200;
  const squash = 1 - bounce * 0.12, stretch = 1 + bounce * 0.12;
  const ink = "#2B2D42";
  const body = (() => {
    switch (name) {
      case "sun":
        return (
          <g>
            {[...Array(12)].map((_, i) => (
              <rect key={i} x={-7} y={-98} width={14} height={30} rx={7} fill="#FFC83D" transform={`rotate(${i * 30 + t * 20})`} />
            ))}
            <circle r={58} fill="#FFC83D" stroke={ink} strokeWidth={6} />
            <circle cx={-18} cy={-8} r={6} fill={ink} /><circle cx={18} cy={-8} r={6} fill={ink} />
            <path d="M-20 14 Q0 32 20 14" stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" />
          </g>
        );
      case "tree":
        return (
          <g>
            <rect x={-16} y={10} width={32} height={80} rx={8} fill="#A86B3C" stroke={ink} strokeWidth={6} />
            <circle cx={0} cy={-30} r={62} fill="#5CC96B" stroke={ink} strokeWidth={6} />
            <circle cx={-40} cy={0} r={40} fill="#5CC96B" stroke={ink} strokeWidth={6} />
            <circle cx={40} cy={0} r={40} fill="#5CC96B" stroke={ink} strokeWidth={6} />
            <circle cx={0} cy={-10} r={45} fill="#5CC96B" />
          </g>
        );
      case "cat":
        return (
          <g>
            <ellipse cx={0} cy={40} rx={62} ry={46} fill="#FF8A3D" stroke={ink} strokeWidth={6} />
            <path d={`M60 50 Q${100 + Math.sin(t * 6) * 12} 10 80 -20`} stroke={ink} strokeWidth={12} fill="none" strokeLinecap="round" />
            <path d={`M60 50 Q${100 + Math.sin(t * 6) * 12} 10 80 -20`} stroke="#FF8A3D" strokeWidth={6} fill="none" strokeLinecap="round" />
            <polygon points="-52,-38 -38,-92 -12,-52" fill="#FF8A3D" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
            <polygon points="52,-38 38,-92 12,-52" fill="#FF8A3D" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
            <circle cx={0} cy={-30} r={52} fill="#FF8A3D" stroke={ink} strokeWidth={6} />
            {/* 눈 깜빡임: 3초마다 4프레임 */}
            {(Math.floor(t * 30) % 90) < 4
              ? <><path d="M-26 -36 h16" stroke={ink} strokeWidth={6} strokeLinecap="round" /><path d="M10 -36 h16" stroke={ink} strokeWidth={6} strokeLinecap="round" /></>
              : <><circle cx={-18} cy={-36} r={8} fill={ink} /><circle cx={18} cy={-36} r={8} fill={ink} /></>}
            <path d="M-6 -18 L0 -12 L6 -18" stroke={ink} strokeWidth={5} fill="#FF5A7A" strokeLinejoin="round" />
            {[-1, 1].map((d) => <path key={d} d={`M${d * 14} -14 L${d * 54} -22 M${d * 14} -8 L${d * 54} -4`} stroke={ink} strokeWidth={3} />)}
          </g>
        );
      case "ball":
        return (
          <g>
            <circle r={48} fill="#FF5A5A" stroke={ink} strokeWidth={6} />
            <path d="M-48 0 Q0 30 48 0" stroke="#FFF" strokeWidth={8} fill="none" />
            <circle cx={-16} cy={-18} r={9} fill="#FFFFFF" opacity={0.8} />
          </g>
        );
      case "fish":
        return (
          <g>
            <polygon points="40,0 90,-36 90,36" fill="#3DA5FF" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
            <ellipse cx={-10} cy={0} rx={64} ry={40} fill="#3DA5FF" stroke={ink} strokeWidth={6} />
            <circle cx={-40} cy={-8} r={8} fill={ink} />
          </g>
        );
    }
  })();
  return (
    <svg width={size} height={size} viewBox="-110 -110 220 220" style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${bounce * -30}) scale(${stretch * s / s} ${squash * s / s})`}>{body}</g>
    </svg>
  );
};

export const ReadAlong: React.FC<ReadAlongProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const land = width > height;
  const fs = PROFILE.type;

  // ── 단어 시각: TTS 시각이 있으면 사용, 없으면 글자 수로 자동 (+문장부호 쉼) ──
  const start = 0.8;
  const auto: number[] = [];
  let acc = start;
  p.words.forEach((w) => { auto.push(acc); acc += 0.22 + w.text.replace(/[^a-z]/gi, "").length * 0.06 + (/[.,!?]$/.test(w.text) ? 0.35 : 0); });
  const at = p.words.map((w, i) => w.at ?? auto[i]);
  const readEnd = acc + 0.4;
  const phonicsStart = readEnd + 0.4, phonicsEnd = phonicsStart + 1.0 + p.vocab.sounds.length * 0.7 + 1.4;
  const quizStart = phonicsEnd + 0.2, reveal = quizStart + 2.6;

  const cur = at.reduce((k, a, i) => (t >= a ? i : k), -1);
  const lastHit: Partial<Record<PropName, number>> = {};
  p.words.forEach((w, i) => { if (w.prop && t >= at[i]) lastHit[w.prop] = at[i]; });
  const bounceOf = (n: PropName) => { const h = lastHit[n]; if (h === undefined) return 0; const k = t - h; return k < 0.6 ? Math.sin(k / 0.6 * Math.PI) * Math.exp(-k * 2) : 0; };

  const sfx: React.ReactNode[] = [];
  const S = (sec: number, n: string, v = 0.6) => p.sfx && sfx.push(<Sequence key={`${n}${sec}`} from={Math.round(sec * fps)} durationInFrames={45} layout="none"><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>);
  p.words.forEach((w, i) => w.prop && S(at[i], "pop", 0.5));

  // ── ① 장면 ──
  const sceneOut = interpolate(t, [readEnd, readEnd + 0.4], [1, 0], clamp);
  const groundY = height * (land ? 0.68 : 0.62);
  const slots: Record<PropName, [number, number, number]> = {
    sun: [0.80, 0.20, land ? 260 : 300], tree: [0.16, 0.48, land ? 320 : 360], cat: [0.45, 0.56, land ? 260 : 300],
    ball: [0.62, 0.62, land ? 140 : 170], fish: [0.30, 0.6, 200],
  };
  const sceneEl = sceneOut > 0 && (
    <AbsoluteFill style={{ opacity: sceneOut }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d={`M0 ${groundY} Q ${width * 0.3} ${groundY - 90} ${width * 0.6} ${groundY - 20} T ${width} ${groundY - 40} V ${height} H 0 Z`} fill="#BDE8A6" />
        <path d={`M0 ${groundY + 60} Q ${width * 0.5} ${groundY + 10} ${width} ${groundY + 70} V ${height} H 0 Z`} fill="#9ED68A" />
      </svg>
      {p.scene.map((n, i) => {
        const [x, y, sz] = slots[n];
        const enter = spring({ frame: frame - i * PROFILE.pace.stagger, fps, config: { damping: 12, stiffness: 140 } });
        return (
          <div key={n} style={{ position: "absolute", left: x * width - sz / 2, top: y * height - sz / 2, transform: `scale(${enter})` }}>
            <Prop name={n} size={sz} t={t} bounce={bounceOf(n)} />
          </div>
        );
      })}
      {/* 읽기 문장: 단어 하이라이트 */}
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom + (land ? 10 : 260), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 18px",
        background: "rgba(255,255,255,0.92)", borderRadius: 36, padding: "26px 36px", boxShadow: "0 8px 0 rgba(43,45,66,0.12)" }}>
        {p.words.map((w, i) => {
          const on = i === cur, done = i < cur;
          const pop = on ? 1 + 0.12 * Math.exp(-(t - at[i]) * 8) : 1;
          return (
            <span key={i} style={{ fontSize: fs.body, fontWeight: 800, color: on ? "#FFFFFF" : done ? BRAND.text : BRAND.muted,
              background: on ? (w.prop ? COLORS[i % COLORS.length] : BRAND.accent) : "transparent", borderRadius: 18, padding: "2px 14px",
              transform: `scale(${pop})`, display: "inline-block", fontFamily: "'Nunito', 'Arial Rounded MT Bold', " + BRAND.font, letterSpacing: 0 }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  // ── ② 파닉스 ──
  const ph = t >= phonicsStart && t < quizStart;
  const pIn = interpolate(t, [phonicsStart, phonicsStart + 0.4], [0, 1], clamp);
  const pOut = interpolate(t, [phonicsEnd - 0.3, phonicsEnd], [1, 0], clamp);
  const joinT = phonicsStart + 1.0 + p.vocab.sounds.length * 0.7;
  const join = interpolate(t, [joinT, joinT + 0.35], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  p.vocab.sounds.forEach((_, i) => S(phonicsStart + 1.0 + i * 0.7, "tick", 0.5));
  S(joinT + 0.35, "ding", 0.5);
  const phonEl = ph && (
    <AbsoluteFill style={{ opacity: Math.min(pIn, pOut), alignItems: "center", justifyContent: "center", flexDirection: land ? "row" : "column", gap: 60 }}>
      <div style={{ transform: `scale(${pIn})` }}><Prop name={p.vocab.prop} size={land ? 380 : 420} t={t} bounce={join > 0.99 ? Math.max(0, Math.sin((t - joinT - 0.35) * 8)) * Math.exp(-(t - joinT) * 2) : 0} /></div>
      <div style={{ display: "flex", gap: (1 - join) * 40, fontFamily: "'Nunito', 'Arial Rounded MT Bold', " + BRAND.font, letterSpacing: 0 }}>
        {p.vocab.sounds.map((snd, i) => {
          const st = phonicsStart + 1.0 + i * 0.7;
          const e = spring({ frame: frame - Math.round(st * fps), fps, config: { damping: 10, stiffness: 180 } });
          return (
            <div key={i} style={{ fontSize: fs.headline * 1.4, fontWeight: 900, color: join > 0.99 ? BRAND.text : COLORS[i % COLORS.length], transform: `translateY(${(1 - e) * 80}px) scale(${0.6 + 0.4 * e})`, opacity: e,
              borderBottom: join > 0.99 ? "none" : `10px solid ${COLORS[i % COLORS.length]}`, padding: "0 6px" }}>
              {snd}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  // ── ③ 퀴즈 ──
  const qz = t >= quizStart;
  const qIn = interpolate(t, [quizStart, quizStart + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ring = interpolate(t, [reveal, reveal + 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  S(reveal + 0.5, "ding", 0.6);
  const quizEl = qz && (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50, flexDirection: "column", opacity: qIn }}>
      <div style={{ fontSize: fs.title, fontWeight: 900, color: BRAND.text, fontFamily: "'Nunito', 'Arial Rounded MT Bold', " + BRAND.font, letterSpacing: 0 }}>{p.quiz.question}</div>
      <div style={{ display: "flex", gap: land ? 80 : 30, flexDirection: land ? "row" : "column" }}>
        {p.quiz.choices.map((c, i) => {
          const e = spring({ frame: frame - Math.round((quizStart + 0.2 + i * 0.15) * fps), fps, config: { damping: 12, stiffness: 150 } });
          const correct = c === p.quiz.answer;
          const dim = ring > 0 && !correct ? 0.35 : 1;
          const box = land ? 300 : 260;
          return (
            <div key={c} style={{ width: box, height: box, borderRadius: 40, background: "#FFFFFF", position: "relative", display: "grid", placeItems: "center",
              transform: `scale(${e * (correct && ring > 0.99 ? 1 + 0.05 * Math.sin((t - reveal) * 10) * Math.exp(-(t - reveal - 0.5) * 2) : 1)})`, opacity: dim, boxShadow: "0 10px 0 rgba(43,45,66,0.12)" }}>
              <Prop name={c} size={box * 0.72} t={t} bounce={0} />
              {correct && ring > 0 && (
                <svg width={box + 60} height={box + 60} style={{ position: "absolute", left: -30, top: -30 }}>
                  <circle cx={(box + 60) / 2} cy={(box + 60) / 2} r={box / 2 + 18} fill="none" stroke="#5CC96B" strokeWidth={14} strokeLinecap="round"
                    pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} transform={`rotate(-90 ${(box + 60) / 2} ${(box + 60) / 2})`} />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font }}>
      {p.narration && <Audio src={staticFile(p.narration)} />}
      {sfx}
      {sceneEl}
      {phonEl}
      {quizEl}
      {/* 진행 점: 장면 / 소리 / 퀴즈 */}
      <div style={{ position: "absolute", top: SAFE.top, right: SAFE.right, display: "flex", gap: 12 }}>
        {[0, phonicsStart, quizStart].map((s0, i) => (
          <div key={i} style={{ width: t >= s0 ? 40 : 18, height: 18, borderRadius: 9, background: t >= s0 ? BRAND.accent : "#E3DCCB" }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// 길이 계산 도우미: Root 에서 durationInFrames 로 사용
export const readAlongDuration = (p: ReadAlongProps, fps = 30) => {
  let acc = 0.8;
  p.words.forEach((w) => { acc += 0.22 + w.text.replace(/[^a-z]/gi, "").length * 0.06 + (/[.,!?]$/.test(w.text) ? 0.35 : 0); });
  const last = p.words[p.words.length - 1].at;
  const readEnd = (last !== undefined ? last + 0.6 : acc) + 0.4;
  return Math.ceil((readEnd + 0.4 + 1.0 + p.vocab.sounds.length * 0.7 + 1.4 + 0.2 + 2.6 + 2.0) * fps);
};
