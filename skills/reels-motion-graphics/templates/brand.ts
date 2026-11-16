// 채널별 스타일 프로필 — 유튜브 쇼츠 / 유튜브 롱폼 / 개인 인스타
//
// 원칙: 색·폰트·로고(BRAND_CORE)는 세 채널 모두 같다 → 어디서 봐도 같은 사람.
//       화면 크기·안전영역·글자 크기·속도·연출 강도만 채널마다 다르다.
//
// 채널 고르기 (렌더할 때):
//   npx remotion render src/index.ts KineticHook out/a.mp4 --props='{"channel":"youtube-shorts"}'
//   npx remotion render src/index.ts KineticHook out/b.mp4 --props='{"channel":"youtube-long"}'
// Studio 미리보기는 STUDIO_CHANNEL 값을 따른다.
// 자세한 스타일 규칙: skills/reels-motion-graphics/styles/<채널>.md
import { getInputProps } from "remotion";

export type ChannelId = "instagram" | "youtube-shorts" | "youtube-long" | "kids-english";

// ── 세 채널 공통 브랜드 (여기만 바꾸면 전 채널 반영) ──────────────────
export const BRAND_CORE = {
  bg: "#0E0E10",
  text: "#FFFFFF",
  accent: "#FF4D2E",
  muted: "#8A8A93",
  font: "'Pretendard', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif",
  handle: "@reelbuilder_",
};

export type Profile = {
  id: ChannelId;
  label: string;
  width: number;
  height: number;
  fps: number;
  // 플랫폼 UI 에 가리지 않는 영역 (px)
  safe: { top: number; bottom: number; left: number; right: number; side: number };
  type: { headline: number; title: number; body: number; caption: number };
  pace: {
    stagger: number; // 요소 사이 등장 간격(프레임)
    enter: number; // 등장 길이(프레임)
    sceneSec: [number, number]; // 장면 길이 권장 범위(초)
    bpm: number; // BGM 기본 템포
  };
  energy: "high" | "medium" | "calm"; // 플래시·흔들림·글리치 허용 정도
  loop: boolean; // 마지막 프레임 = 첫 프레임
  palette?: Partial<typeof BRAND_CORE> & { colors?: string[] }; // 채널 전용 색 (앱 브랜드 등)
};

export const PROFILES = {
  // 개인 인스타 릴스: 저장·공유 유도, 따뜻하고 깔끔, 프로필 그리드(3:4) 썸네일 고려
  instagram: {
    id: "instagram",
    label: "개인 인스타 (릴스)",
    width: 1080,
    height: 1920,
    fps: 30,
    safe: { top: 220, bottom: 420, left: 90, right: 150, side: 90 },
    type: { headline: 112, title: 84, body: 64, caption: 44 },
    pace: { stagger: 8, enter: 10, sceneSec: [1.8, 3], bpm: 110 },
    energy: "medium",
    loop: false,
  },
  // 유튜브 쇼츠: 가장 빠르게, 글자 크게, 오른쪽 버튼 열·아래 제목 영역 피하기, 자동 반복 → 루프
  "youtube-shorts": {
    id: "youtube-shorts",
    label: "유튜브 쇼츠",
    width: 1080,
    height: 1920,
    fps: 30,
    safe: { top: 240, bottom: 500, left: 80, right: 200, side: 90 },
    type: { headline: 128, title: 96, body: 70, caption: 48 },
    pace: { stagger: 5, enter: 7, sceneSec: [1, 2], bpm: 128 },
    energy: "high",
    loop: true,
  },
  // 유튜브 롱폼: 16:9, 차분하고 정보 밀도 높게, 챕터 카드·하단 자막바, 엔드스크린 영역 비우기
  "youtube-long": {
    id: "youtube-long",
    label: "유튜브 롱폼",
    width: 1920,
    height: 1080,
    fps: 30,
    safe: { top: 90, bottom: 110, left: 140, right: 140, side: 140 },
    type: { headline: 120, title: 84, body: 48, caption: 34 },
    pace: { stagger: 10, enter: 14, sceneSec: [3, 6], bpm: 96 },
    energy: "calm",
    loop: false,
  },
} as Record<ChannelId, Profile>;

// 어린이 영어 앱 (학습 게임·그림책 장면): 이 채널만 앱 브랜드 색을 쓴다
PROFILES["kids-english"] = {
  id: "kids-english",
  label: "어린이 영어 앱",
  width: 1920,
  height: 1080,
  fps: 30,
  safe: { top: 80, bottom: 80, left: 100, right: 100, side: 100 },
  type: { headline: 140, title: 96, body: 72, caption: 44 },
  pace: { stagger: 8, enter: 12, sceneSec: [2.5, 5], bpm: 100 },
  energy: "medium",
  loop: false,
  palette: {
    bg: "#FFF6E5",
    text: "#2B2D42",
    accent: "#FF8A3D",
    muted: "#8D8FA3",
    colors: ["#FF8A3D", "#3DA5FF", "#5CC96B", "#FFC83D", "#B07CFF"],
  },
};

// Studio 미리보기에서 볼 채널 (렌더 때는 --props 의 channel 이 우선)
export const STUDIO_CHANNEL: ChannelId = "instagram";

const fromProps = (getInputProps() as { channel?: ChannelId }).channel;
export const CHANNEL: ChannelId = fromProps && fromProps in PROFILES ? fromProps : STUDIO_CHANNEL;
export const PROFILE: Profile = PROFILES[CHANNEL];

// 기존 템플릿 호환용 (BRAND / SAFE 이름 그대로 사용)
export const BRAND = { ...BRAND_CORE, ...(PROFILE.palette ?? {}) };
export const SAFE = PROFILE.safe;
