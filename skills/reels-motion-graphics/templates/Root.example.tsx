import { Composition } from "remotion";
import { PROFILE } from "./brand";
import { KineticHook, kineticHookDefaults } from "./KineticHook";
import { PhysicsWords, physicsWordsDefaults } from "./PhysicsWords";
import { SketchDiagram, sketchDiagramDefaults } from "./SketchDiagram";
import { AnimeTimeline, animeTimelineDefaults } from "./AnimeTimeline";
import { BrushHighlight, brushHighlightDefaults } from "./BrushHighlight";
import { ThinkingOrbs, thinkingOrbsDefaults } from "./ThinkingOrbs";
import { BeatDayAnswer, beatDayAnswerDefaults } from "./BeatDayAnswer";
import { StatsLaunch, statsLaunchDefaults } from "./StatsLaunch";
import { PixiGlitch, pixiGlitchDefaults } from "./PixiGlitch";
import { ForecastChart, forecastChartDefaults } from "./ForecastChart";
import { ReadAlong, readAlongDefaults, readAlongDuration } from "./ReadAlong";
import { StyleShowreel, styleShowreelDefaults } from "./StyleShowreel";
import { PopTeaser, popTeaserDefaults, popTeaserDuration } from "./PopTeaser";
import { TalkingOverlay, talkingOverlayDefaults, talkingOverlayDuration } from "./TalkingOverlay";
import { CutoutStage, cutoutStageDefaults, cutoutStageDuration } from "./CutoutStage";
import { ChapterCard, chapterCardDefaults, LowerThird, lowerThirdDefaults } from "./LongformKit";
// 채널(brand.ts)에 따라 크기가 자동으로 바뀜
const v = { fps: PROFILE.fps, width: PROFILE.width, height: PROFILE.height };
export const RemotionRoot = () => (<>
  <Composition id="KineticHook" component={KineticHook} durationInFrames={90} {...v} defaultProps={kineticHookDefaults} />
  <Composition id="PhysicsWords" component={PhysicsWords} durationInFrames={120} {...v} defaultProps={physicsWordsDefaults} />
  <Composition id="SketchDiagram" component={SketchDiagram} durationInFrames={90} {...v} defaultProps={sketchDiagramDefaults} />
  <Composition id="PixiGlitch" component={PixiGlitch} durationInFrames={75} {...v} defaultProps={pixiGlitchDefaults} />
  <Composition id="AnimeTimeline" component={AnimeTimeline} durationInFrames={75} {...v} defaultProps={animeTimelineDefaults} />
  <Composition id="BrushHighlight" component={BrushHighlight} durationInFrames={60} {...v} defaultProps={brushHighlightDefaults} />
  <Composition id="ThinkingOrbs" component={ThinkingOrbs} durationInFrames={120} {...v} defaultProps={thinkingOrbsDefaults} />
  <Composition id="BeatDayAnswer" component={BeatDayAnswer} durationInFrames={360} {...v} defaultProps={beatDayAnswerDefaults} />
  <Composition id="StatsLaunch" component={StatsLaunch} durationInFrames={360} {...v} defaultProps={statsLaunchDefaults} />
  <Composition id="ChapterCard" component={ChapterCard} durationInFrames={75} {...v} defaultProps={chapterCardDefaults} />
  <Composition id="LowerThird" component={LowerThird} durationInFrames={120} {...v} defaultProps={lowerThirdDefaults} />
  <Composition id="ForecastChart" component={ForecastChart} durationInFrames={150} {...v} defaultProps={forecastChartDefaults} />
  <Composition id="ReadAlong" component={ReadAlong} durationInFrames={readAlongDuration(readAlongDefaults)} {...v} defaultProps={readAlongDefaults} />
  <Composition id="StyleShowreel" component={StyleShowreel} durationInFrames={240} {...v} defaultProps={styleShowreelDefaults} />
  <Composition id="PopTeaser" component={PopTeaser} durationInFrames={popTeaserDuration(popTeaserDefaults)} {...v} defaultProps={popTeaserDefaults} />
  <Composition id="TalkingOverlay" component={TalkingOverlay} durationInFrames={talkingOverlayDuration(talkingOverlayDefaults)} {...v} defaultProps={talkingOverlayDefaults} />
  <Composition id="CutoutStage" component={CutoutStage} durationInFrames={cutoutStageDuration(cutoutStageDefaults)} {...v} defaultProps={cutoutStageDefaults} calculateMetadata={({ props }) => ({ durationInFrames: cutoutStageDuration(props) })} />
</>);
