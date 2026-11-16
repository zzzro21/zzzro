# 효과 라이브러리 레시피 (Remotion 에서 쓰기)

Remotion 기본 기능(interpolate·spring)만으로 부족할 때 꺼내 쓰는 라이브러리 6개.
모든 템플릿은 `templates/` 에 있고, 1080x1920·30fps 로 **실제 렌더 테스트를 통과**했다.
(remotion 4.0.544 / matter-js 0.20.0 / roughjs 4.6.6 / pixi.js 8.23.0 + pixi-filters 6.1.5 / animejs 4.5.0 / p5.brush 3.0.0 / thinking-orbs 0.3.2)

## 0. 공통 원칙 — "같은 프레임은 언제 렌더해도 같은 그림"

Remotion 은 프레임을 **순서 없이, 여러 탭에서 동시에** 렌더한다. 그래서 라이브러리를 쓸 때는:

1. **자체 재생 루프를 끈다.** (Pixi `autoStart:false`, anime `autoplay:false`, p5 `noLoop`)
2. **랜덤은 seed 로 고정한다.** (`Math.random()` 금지. rough `seed`, p5.brush `brush.seed()`, Matter `Common._seed`)
3. **누적하지 말고 매 프레임 처음부터 계산/그리기.** 물리처럼 누적이 필요하면 0프레임부터 미리 계산해 배열로 들고 있는다.
4. **비동기 준비는 `delayRender` / `continueRender`** 로 감싼다. (Pixi `app.init`, 폰트, 이미지)
5. **WebGL 라이브러리(Pixi, p5.brush)** 는 서버에서 렌더할 때 `--gl=swangle` 을 붙인다.

## 1. 어떤 걸 쓸까

| 원하는 느낌 | 라이브러리 | 템플릿 | 설치 |
| --- | --- | --- | --- |
| 단어 카드가 떨어지고 튕기고 쌓임 | Matter.js | `PhysicsWords.tsx` | `npm i matter-js @types/matter-js` |
| 손그림 도형·화살표·빗금 다이어그램 | Rough.js | `SketchDiagram.tsx` | `npm i roughjs` |
| 글리치·글로우·볼록 왜곡·ASCII | PixiJS + pixi-filters | `PixiGlitch.tsx` | `npm i pixi.js pixi-filters` |
| 글자·도형·SVG 선을 한 타임라인으로 안무 | Anime.js v4 | `AnimeTimeline.tsx` | `npm i animejs` |
| 마커·연필·목탄 붓 자국, 수채화 얼룩 | p5.brush (standalone) | `BrushHighlight.tsx` + `p5brush.d.ts` | `npm i p5.brush` |
| AI 가 생각 중인 점 구체 (검색·풀이·작성…) | thinking-orbs | `ThinkingOrbs.tsx` | `npm i thinking-orbs` |

> 한 영상에 라이브러리는 **1~2개만**. 효과가 섞이면 싸 보인다.

## 2. 라이브러리별 핵심 패턴과 함정

### Matter.js (물리)
- `useMemo` 안에서 `Engine.update(engine, 1000/fps)` 를 duration 만큼 돌려 **모든 프레임의 위치 배열**을 만든다 → `frames[frame]` 으로 꺼내 그림.
- 바닥·벽은 안전영역(SAFE) 기준으로 놓아야 카드가 릴스 UI 아래로 안 숨는다.
- 튕김 `restitution 0.3~0.4`, 중력 `y 1.4~1.8` 이 숏폼 리듬에 맞다.
- TS 에선 `Matter.Common._seed` 가 타입에 없어서 `(Matter.Common as unknown as {_seed:number})._seed = 42`.

### Rough.js (손그림)
- `rough.generator()` + `gen.toPaths(drawable)` 로 **path 문자열만** 받아 React `<path>` 로 그린다. (DOM 직접 조작 X)
- `seed` 를 안 주면 매 프레임 선이 바뀌어 미친 듯이 떨린다. **고정 seed = 정지된 손그림**, `Math.floor(frame/4)` 로 바꾸면 **일부러 보글거리는 손그림 애니메이션**.
- 그려지는 효과: `pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}`.

### PixiJS + pixi-filters (WebGL 효과)
- `app.init({autoStart:false, preserveDrawingBuffer:true})` 를 `delayRender` 로 기다리고, 매 프레임 값 바꾼 뒤 `app.render()` 한 번.
- ⚠️ `container.filterArea` 를 지정하면 **필터 여러 개를 겹칠 때 결과가 사라졌다**(테스트로 확인). 대신 container 안에 화면 크기 배경 `Graphics().rect(0,0,w,h).fill(bg)` 를 넣어 필터 범위를 화면 전체로 만든다.
- `GlitchFilter` 는 `seed` 를 프레임으로 정하고 `refresh()` 호출 → 같은 글리치 재현.
- 자주 쓰는 필터: `GlitchFilter`, `AdvancedBloomFilter`(글로우), `BulgePinchFilter`(볼록), `AsciiFilter`, `CrossHatchFilter`, `RGBSplitFilter`, `CRTFilter`.
- 강도는 "버스트" 로: 등장 0.3초 강하게 → 0, 문장 전환 순간에 2~3프레임만 다시.

### Anime.js v4 (안무)
- `createTimeline({autoplay:false})` 를 `useLayoutEffect` 에서 한 번 만들고, 매 프레임 `tl.seek(frame/fps*1000)`.
- anime 가 움직이는 속성(transform·opacity)은 **React style 에 쓰지 말 것**(초기값 opacity:0 정도만). React 재렌더가 덮어씀.
- `stagger(35)`, `stagger(60, {from:'center'})`, `svg.createDrawable()` + `draw:['0 0','0 1']` (선 그리기)가 핵심 무기.
- `utils.random()` 금지. 정리할 땐 `tl.revert()`.

### p5.brush (붓 질감)
- p5.js 없이 `import * as brush from "p5.brush/standalone"` (WebGL2). 타입이 없어서 `p5brush.d.ts` 한 줄 필요.
- ⚠️ standalone 좌표 **(0,0) 이 화면 가운데**다(테스트로 확인). `brush.push(); brush.translate(-w/2,-h/2)` 후 그리고 `brush.pop()`.
- 매 프레임: `brush.seed(7)` → `brush.clear(종이색)` → 처음부터 다시 그림 → `brush.render()` (필수).
- `scaleBrushes(2~3)` 로 1080 해상도에 맞게 굵기 보정. 기본 붓: `2B, HB, 2H, cpencil, pen, rotring, spray, marker, marker2, charcoal, hatch_brush`.
- 그려지는 효과: 선 끝점을 progress 만큼만 늘린다. 수채화는 `fill(색, 투명도)` + `fillBleed` + `fillTexture`.
- 글자는 브러시로 안 되니 React `<div>` 로 캔버스 위에 얹는다.

### thinking-orbs (AI 생각 중 구체)
- ⚠️ `<ThinkingOrb>` 컴포넌트는 내부가 `performance.now()`(실제 시계) 기반이라 **Remotion 에서 그대로 쓰면 안 된다.**
- 대신 `thinking-orbs/engine` 의 `resolvePreset(state, 64)` → `MODE_FRAMES[mode](64, t, opts)` → `paintFrame(ctx, frame, dark, tint)`. 시간은 `t = frame/fps × preset.speed`.
- 프리셋은 64px 기준 튜닝 → 64 로 계산하고 `ctx.setTransform(k,0,0,k,0,0)` (k = 그릴 px / 64) 로 확대. 벡터 원이라 선명함.
- 9가지 상태: `working`(궤도 입자) `searching`(지구본 스캔) `solving`(큐브처럼 섞였다 맞춰짐) `listening`(파형) `connecting`(별자리 연결) `weaving`(세 가닥 땋기) `composing`(물결 띠) `breathing`(숨쉬는 링) `shaping`(원→삼각형→사각형).
- `dark=true` 는 어두운 배경용(밝은 점). 색은 `tint {r,g,b}` 로 브랜드색 입히기 가능.
- 릴스 활용: "AI 한테 시켰더니…" 류 콘텐츠에서 AI 작업 장면, 로딩/전환 브릿지, 상태 라벨과 함께 2~4초.

## 3. 렌더 명령

```bash
npx remotion studio                                  # 미리보기
npx remotion still src/index.ts PixiGlitch out/f.png --frame=10 --gl=swangle   # 프레임 확인
npx remotion render src/index.ts PixiGlitch out/glitch.mp4 --gl=swangle
```
