# 바이럴 모션 프롬프트에서 배운 것

출처: [yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) (MIT, 프롬프트 저작권은 각 제작자)
Claude 로 만든 바이럴 영상 703개의 프롬프트 중 **모션그래픽·설명 영상 362개(전문 공개분)** 를 분석했다. (2026-11 기준)

## 숫자로 본 특징

- 프롬프트 길이 중앙값 **31단어**. 짧은 프롬프트도 많이 터졌다 → 길이보다 **"무엇을, 얼마나, 어떤 기준으로"** 가 중요.
- 자주 쓰인 기술: Canvas(121) > SVG(76) > GSAP(41) > Three.js(23) > 셰이더(19) > 오디오 합성(15).
- 자주 나온 단어: style(70) · sound(53) · music(45) · fps(44) · **beat(37)** · camera(32) · loop(29) · 1080(27) · mp4(26).
- 세로(9:16·릴스·쇼츠) 언급은 63개 → 대부분 가로로 만들어졌다. **세로 숏폼은 아직 빈 자리.**

## 패턴 9가지 (이 스킬에 반영됨)

| # | 패턴 | 프롬프트에 나온 모습 | 이 스킬에서는 |
| --- | --- | --- | --- |
| 1 | **스펙을 숫자로** | "15-second, 1920x1080, 60fps, render MP4" | 1080×1920·30fps·초 단위 길이 고정 |
| 2 | **역할 + 기준 올리기** | "show what an incredible motion designer you are, like a showreel — go all out" | 요청이 막연하면 "쇼릴 수준" 을 기본 품질 기준으로 |
| 3 | **비트에 맞춰 컷** | "every cut must land on the beat", "120 BPM grid, something happens on every beat" | BPM 이 주어지면 장면 전환을 비트 프레임에 스냅 (30fps·120BPM = 15프레임/비트) |
| 4 | **브랜드 규칙** | "three colours, one idea per shot, key objects centred, space to breathe, eased motion only" | motion-style.md + 한 장면 주인공 하나 |
| 5 | **장면 타임라인을 초 단위로** | "0.0–0.6s icon grows… 0.6–1.5s two lines reveal…" | 스토리보드 표(시간·화면·모션) 먼저 |
| 6 | **진짜 데이터, 플레이스홀더 금지** | "Real UI. Real data. No placeholders." / "Use only facts on the site" | 숫자·문구는 사용자가 준 것만. 없으면 묻는다 |
| 7 | **프레임 = 순수 함수** | "One draw(t) function. No CSS transitions, no timers, no state between frames" | Remotion `useCurrentFrame()` + seed 고정 (libraries.md) |
| 8 | **검수 후 렌더** | "First render one frame per beat as a contact sheet. Fix anything cramped. Then render." / "Build, render, inspect, refine — don't stop at a storyboard" | still 컨택트시트 → 수정 → MP4 |
| 9 | **질문 말고 만들기 (또는 처음에 한 번에 묻기)** | "Do not ask me any questions. Just build it." / `<inputs> Ask me for: …</inputs>` | 필요한 정보는 시작할 때 한 번에 묻고, 그 뒤엔 끝까지 만든다 |

## 모션 디테일 (구조화된 프롬프트에서 반복된 것)

- 스프링은 **오버슈트 아주 살짝만**.
- 컨테이너가 먼저 변하기 시작한 뒤 내용이 들어오고, 다음 변형 전에 내용이 먼저 나간다 → **글자가 겹치지 않는다.**
- 전환에 아주 짧은 블러.
- 검정에서 강조색으로 바로 페이드하지 말고, **강조색 요소가 장면 사이를 이동**하게.
- 루프 영상은 **마지막 프레임 = 첫 프레임**.
- 컷 대신 **같은 도형이 크기·모서리·색을 바꾸며 계속 이어지는** 연출이 고급스러워 보인다 ("one shape, never cut").
- 피드백 예: "too fast and bumpy" → 속도·이징 문제. 이런 말을 들으면 전체 속도 상수와 이징부터 손본다.

## 많이 재사용된 프롬프트 유형

| 유형 | 핵심 문장 | 릴스 버전으로 바꾸면 |
| --- | --- | --- |
| 쇼릴 | "N초 모션그래픽, 네가 얼마나 대단한 모션 디자이너인지 보여줘, go all out" | 내 브랜드 쇼릴 15초 9:16 |
| 제품 런칭 | "트위터에서 보는 SaaS 런칭 영상처럼, 실제 에셋으로, 기능·장점" | 내 상품/강의 런칭 릴스 |
| 5장면 설명 영상 | "문제 → 내가 하는 일 → 3단계 방법 → 증거 1개 → 이름" | 정보형 릴스 기본 구조 |
| 레시피/과정 | "빈 잔에서 완성까지, 재료와 양이 들어가는 순간을 보여줘" | 'N단계 방법' 과정 릴스 |
| 로고 → 릴 | "이 로고로 10초 릴 만들어줘, 레퍼런스처럼" | 엔딩 로고 애니메이션 |

## 사용자가 추가로 모은 사례 (2026-11)

| 사례 | 배울 점 |
| --- | --- |
| 「오늘 무슨 요일? BGM 넣은 30초 멋진 모션그래픽으로 알려줘 (전력으로)」 — Opus 5.5, HyperFrames, BGM 은 Python 으로 즉석 합성, 생성 약 11분 | **사소한 질문 × 과한 연출** 의 갭이 웃음 포인트. BGM 도 코드로 합성 가능 → `tools/synth_bgm.py`, `templates/BeatDayAnswer.tsx` |
| "LinkedIn 이 너무 싫어서 런칭 영상을 만들었다" — Opus 5.5 + Remotion | **패러디 런칭 영상**: 진지한 SaaS 런칭 문법(기능 소개·숫자·로고 엔딩)에 농담 내용을 넣으면 밈이 된다 |
| "두 문장 프롬프트로 만들었다" — Opus 5.5 + Remotion | 짧아도 된다. 대신 **무엇을 + 기준(전력으로/쇼릴처럼)** 두 가지는 꼭 들어간다 |

| "레퍼런스 영상 하나 줬더니 시네마틱 런칭 영상이 나왔다" — Opus 5.5 + Remotion, 편집기·타임라인 없음 | **레퍼런스 1개 + 프롬프트** 가 가장 강한 조합 → `tools/analyze_reference.py` 로 컷·색·리듬을 숫자와 시트로 뽑아 따라간다 |
| 작성자 메모: "extra effort, HeyGen·Remotion 스킬, Node·ffmpeg·python, 아주 자세한 프롬프트, 40분" | 노력 수준을 높이고, 스킬을 미리 설치하고, 프롬프트를 자세히 쓸수록 결과가 좋다. 40분~1시간이 현실적인 제작 시간 |
| 「15초, 문자·실적 숫자·매출 그래프를 움직임. 구성과 움직임 지시를 넘겨 MP4로」 ※회사·수치는 가상 | **실적 PV** 수요가 크다 → `templates/StatsLaunch.tsx`. 가상 수치면 반드시 화면에 표기 |
| 「화려한 PV 만들어줘」 통째로 맡김 → 실제 리플레이 녹화 + 박자에 맞춰 자막 겹침, 일·영 2편 하룻밤 | 실제 화면 녹화(게임·앱)를 소재로 쓰고 **비트에 자막을 얹는다**. 다국어 버전은 문구만 props 로 바꿔 재렌더 |
| 「○○식 PV 만들어줘」만 요청 — 영상: HyperFrames, BGM: Lyria 생성, 효과음: **박자를 분석해 착지·도장 순간에 맞춤**. "클로드는 소리를 못 듣는데 파형을 숫자로 분석해서 음에 맞춘다" | 효과음은 착지 프레임에 → `tools/synth_sfx.py` + `analyze_reference.py` 의 `hits/beats` |
| Opus 5.5 + Remotion + Gemini TTS, 1시간에 제품 광고 2편, "외주였으면 10만엔 이상" | 내레이션은 TTS(외부 API 키 필요)로 붙일 수 있다. 이 스킬은 TTS 를 내장하지 않으므로 사용자가 음성 파일을 주면 `<Audio>` 로 얹고 analyze 로 문장 시작 시각을 맞춘다 |
| "Claude Code 마스코트 >>" | 캐릭터를 주인공으로 세우면 반응이 좋다. 단, **남의 캐릭터·로고는 그대로 쓰지 말고** 사용자 소유 캐릭터만 |

| 「캐릭터는 예전에 Midjourney 로 만든 것, ElevenLabs 연결해두니 '나레이션 만들게요', '효과음도 만들까요?' 하며 자동 생성」 — Opus 5.5 + Remotion | **내 캐릭터 + 음성 API 연결** 이면 클로드가 나레이션·효과음까지 제안한다 → `styles/instagram.md` 캐릭터 숏폼 규칙 |
| "$3,000 견적 받은 런칭 영상" — Opus 5.5(medium), HyperFrames + GSAP, 구조화된 한 번짜리 프롬프트 (스타일·카피·규칙·크래프트·음악·마스터링 섹션) | 프롬프트를 **섹션(STYLE/COPY/RULES/CRAFT/MUSIC)** 으로 나누고 "지어낸 결과 금지", "-14 LUFS 재측정" 같은 검수 기준까지 넣으면 한 번에 나온다 → 전망치 그래프용으로 바꾼 버전: `forecast-film-prompt.md` |

### 도구 메모: Remotion vs HyperFrames

| | Remotion (이 스킬 기본) | HyperFrames (HeyGen, 오픈소스) |
| --- | --- | --- |
| 작성 방식 | React 컴포넌트, `useCurrentFrame()` | 일반 HTML + 탐색 가능한(seekable) 애니메이션 |
| 렌더 | headless Chrome → MP4 | headless Chrome + FFmpeg → MP4 |
| 장점 | 생태계·문서·공식 에이전트 스킬, 템플릿 재사용 | HTML 만 알면 됨, 에이전트용 CLI |
| 라이선스 | 개인·소규모 무료, 일정 규모 이상 회사는 유료 | Apache 2.0 |

이 스킬은 Remotion 기준이다. 사용자가 HyperFrames 를 원하면 같은 원칙(프레임=순수 함수, seed 고정, 비트 그리드, 컨택트시트 검수)을 그대로 적용한다.
