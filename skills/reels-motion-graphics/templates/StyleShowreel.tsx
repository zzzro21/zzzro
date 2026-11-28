// 같은 장면을 스타일만 바꿔 빠르게 컷하는 쇼릴 (레퍼런스 for_kids_003 의 "하나의 코드 → 여러 스타일")
// 컷 길이는 점점 짧아진다 (1.0s → 0.25s), 컷은 BGM 비트에 맞춘다.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ReadAlong, ReadAlongProps, readAlongDefaults, readAlongMoments } from "./ReadAlong";
import { SKINS } from "./kidsSkins";

export type StyleShowreelProps = { base: ReadAlongProps; momentSec?: number; skins: string[]; bpm: number; bgm?: string };
export const styleShowreelDefaults: StyleShowreelProps = {
  base: { ...readAlongDefaults, bgm: undefined, sfx: false },
  skins: Object.keys(SKINS),
  bpm: 120,
  bgm: "showreel_bgm.wav",
};
/** 비트 단위 컷: 2박 ×4 → 1박 ×6 → 반박 나머지 */
export function showreelCuts(totalFrames: number, fps: number, bpm: number) {
  const beat = (60 / bpm) * fps, cuts: { start: number; len: number }[] = [];
  let f = 0, i = 0;
  while (f < totalFrames) { const len = Math.round(i < 4 ? beat * 2 : i < 10 ? beat : beat / 2); cuts.push({ start: f, len: Math.min(len, totalFrames - f) }); f += len; i++; }
  return cuts;
}
export const StyleShowreel: React.FC<StyleShowreelProps> = ({ base, momentSec, skins, bpm, bgm }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cuts = showreelCuts(durationInFrames, fps, bpm);
  const idx = Math.max(0, cuts.findIndex((c) => frame >= c.start && frame < c.start + c.len));
  const c = cuts[idx], moment = Math.round((momentSec ?? readAlongMoments(base).phonicsMerged) * fps); // 기본: 파닉스 글자가 합쳐진 직후
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {bgm && <Audio src={staticFile(bgm)} />}
      {/* 지금 컷 하나만 렌더: 자식의 시간은 '보여줄 순간' 부터 흐른다 */}
      <Sequence key={idx} from={c.start - moment} durationInFrames={moment + c.len} layout="none">
        <ReadAlong {...base} skin={skins[idx % skins.length]} />
      </Sequence>
    </AbsoluteFill>
  );
};
