// 유튜브 롱폼 전용 키트 (1920x1080): 챕터 카드 + 하단 자막바(로워서드)
// 롱폼은 '반복해서 쓰는 장치' 가 브랜딩이다 → 영상마다 같은 모양으로 계속 재사용.
//   ChapterCard  : 챕터 바뀔 때 2~3초. 번호 + 제목 + 진행 점
//   LowerThird   : 화면 아래 왼쪽 이름/설명 바. 투명 배경 → 촬영 영상 위에 얹기 (ProRes 4444 로 렌더)
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, PROFILE, SAFE } from "./brand";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ───────────────────────── 챕터 카드 ─────────────────────────
export type ChapterCardProps = { index: number; total: number; title: string; kicker: string };
export const chapterCardDefaults: ChapterCardProps = {
  index: 2,
  total: 5,
  title: "알고리즘이 좋아하는 첫 3초",
  kicker: "CHAPTER",
};

export const ChapterCard: React.FC<ChapterCardProps> = ({ index, total, title, kicker }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = PROFILE.pace.enter;
  const line = interpolate(frame, [0, enter + 6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const num = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 120 } });
  const t = interpolate(frame, [8, 8 + enter], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: BRAND.font, letterSpacing: "-0.03em", opacity: out }}>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: "50%", transform: "translateY(-50%)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28, color: BRAND.accent }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "0.2em", opacity: num }}>{kicker}</span>
          <span style={{ fontSize: 160, fontWeight: 900, lineHeight: 1, transform: `translateY(${(1 - num) * 40}px)`, display: "inline-block", opacity: num }}>
            {String(index).padStart(2, "0")}
          </span>
        </div>
        <div style={{ height: 6, background: BRAND.accent, margin: "28px 0 36px", width: `${line * 100}%`, borderRadius: 3 }} />
        <div style={{ fontSize: PROFILE.type.headline * 0.75, fontWeight: 900, color: BRAND.text, opacity: t, transform: `translateY(${(1 - t) * 30}px)` }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 50 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: i + 1 === index ? 56 : 16, height: 16, borderRadius: 8, background: i + 1 <= index ? BRAND.accent : "#33333A", opacity: t }} />
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", right: SAFE.right, bottom: SAFE.bottom, fontSize: 30, fontWeight: 700, color: BRAND.muted, opacity: t }}>
        {BRAND.handle}
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── 하단 자막바 ─────────────────────────
export type LowerThirdProps = { name: string; role: string; transparent: boolean };
export const lowerThirdDefaults: LowerThirdProps = {
  name: "이현",
  role: "퍼스널 브랜딩 빌더",
  transparent: false, // 미리보기용 배경. 실제 사용은 true + ProRes 4444
};

export const LowerThird: React.FC<LowerThirdProps> = ({ name, role, transparent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const bar = spring({ frame, fps, config: { damping: 20, stiffness: 140 } });
  const txt = interpolate(frame, [6, 6 + PROFILE.pace.enter], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const reveal = Math.min(bar, 1 - out);

  return (
    <AbsoluteFill style={{ background: transparent ? "transparent" : "linear-gradient(135deg,#3a3f47,#1d2025)", fontFamily: BRAND.font }}>
      <div style={{ position: "absolute", left: SAFE.left, bottom: SAFE.bottom + 40, display: "flex", alignItems: "stretch", clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)` }}>
        <div style={{ width: 12, background: BRAND.accent }} />
        <div style={{ background: "rgba(14,14,16,0.88)", padding: "22px 40px 24px 30px" }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: BRAND.text, letterSpacing: "-0.02em", opacity: txt }}>{name}</div>
          <div style={{ fontSize: PROFILE.type.caption, fontWeight: 600, color: BRAND.muted, marginTop: 6, opacity: txt }}>{role}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
