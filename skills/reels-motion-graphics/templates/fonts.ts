// 글꼴을 프로젝트에 포함시켜 '어디서 렌더해도 같은 글꼴' 로 나오게 한다.
//   npm i pretendard @fontsource/baloo-2
// ⚠️ 이게 없으면 렌더 PC 에 글꼴이 없을 때 조용히 기본 글꼴(Inter·Noto 등)로 바뀐다 → 품질이 크게 떨어진다.
//    (실제로 초기 렌더들이 전부 Inter 로 나왔음. 2026-11 확인)
// 사용: brand.ts 가 이 파일을 import 한다. 모든 템플릿은 BRAND.font / FONTS.* 만 쓰면 된다.
import { continueRender, delayRender } from "remotion";
import "pretendard/dist/web/static/pretendard.css"; // 한글 본문·제목 (OFL)
import "@fontsource/baloo-2/600.css"; // 영어 둥근 글꼴 (아이용) (OFL)
import "@fontsource/baloo-2/800.css";

export const FONTS = {
  ko: "'Pretendard', sans-serif",
  kids: "'Baloo 2', 'Pretendard', sans-serif",
};

// 실제로 쓰는 굵기를 미리 불러오고, 다 불러올 때까지 렌더를 멈춘다 (첫 프레임 글꼴 깜빡임 방지)
const NEEDED = ["400 40px Pretendard", "700 40px Pretendard", "800 40px Pretendard", "900 40px Pretendard", "600 40px 'Baloo 2'", "800 40px 'Baloo 2'"];
if (typeof document !== "undefined") {
  const h = delayRender("Loading fonts");
  Promise.all(NEEDED.map((f) => document.fonts.load(f)))
    .then(() => document.fonts.ready)
    .then(() => continueRender(h))
    .catch((e) => { console.error("font load failed", e); continueRender(h); });
}
