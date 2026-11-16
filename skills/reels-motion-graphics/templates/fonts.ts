// 글꼴을 프로젝트에 포함시켜 '어디서 렌더해도 같은 글꼴' 로 나오게 한다.
//   npm i pretendard @fontsource/baloo-2 @fontsource/lexend @fontsource/fraunces @fontsource/caveat @fontsource/silkscreen
// ⚠️ 이게 없으면 렌더 PC 에 글꼴이 없을 때 조용히 기본 글꼴(Inter·Noto 등)로 바뀐다 → 품질이 크게 떨어진다.
//    (실제로 초기 렌더들이 전부 Inter 로 나왔음. 2026-11 확인)
// 모든 글꼴 SIL OFL.
import { continueRender, delayRender } from "remotion";
import "pretendard/dist/web/static/pretendard.css"; // 한글
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/lexend/500.css"; // 읽기용 (아이 읽기 유창성을 위해 설계된 글꼴)
import "@fontsource/lexend/600.css";
import "@fontsource/lexend/700.css";
import "@fontsource/fraunces/600.css"; // 그림책·도록풍 세리프
import "@fontsource/fraunces/600-italic.css";
import "@fontsource/caveat/600.css"; // 손글씨 메모
import "@fontsource/caveat/700.css";
import "@fontsource/silkscreen/400.css"; // 픽셀 게임 UI
import "@fontsource/silkscreen/700.css";

export const FONTS = {
  ko: "'Pretendard', sans-serif",
  kids: "'Baloo 2', 'Pretendard', sans-serif",
  read: "'Lexend', 'Pretendard', sans-serif",
  story: "'Fraunces', Georgia, serif",
  hand: "'Caveat', 'Pretendard', cursive",
  pixel: "'Silkscreen', monospace",
};

// 실제로 쓰는 굵기를 미리 불러오고, 다 불러올 때까지 렌더를 멈춘다 (첫 프레임 글꼴 깜빡임 방지)
const NEEDED = [
  "400 40px Pretendard", "700 40px Pretendard", "800 40px Pretendard", "900 40px Pretendard",
  "600 40px 'Baloo 2'", "800 40px 'Baloo 2'", "500 40px Lexend", "600 40px Lexend", "700 40px Lexend",
  "600 40px Fraunces", "italic 600 40px Fraunces", "600 40px Caveat", "700 40px Caveat", "400 40px Silkscreen", "700 40px Silkscreen",
];
if (typeof document !== "undefined") {
  const h = delayRender("Loading fonts");
  Promise.all(NEEDED.map((f) => document.fonts.load(f)))
    .then(() => document.fonts.ready)
    .then(() => continueRender(h))
    .catch((e) => { console.error("font load failed", e); continueRender(h); });
}
