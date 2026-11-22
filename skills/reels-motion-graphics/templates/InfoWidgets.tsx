// 토킹 릴스용 '정보 위젯' 8종 (v2) — 레퍼런스 릴스의 모션 문법을 그대로 학습해 반영
//   references/motion-grammar-talking.md 에 측정값과 규칙 정리
//
// 핵심 문법
//  1) 위젯은 한 '아이디어' 동안 떠 있다 (3~8초). 자막이 바뀌어도 유지.
//  2) 두 단계: 등장 = 가는 흰 선이 그려지듯 (outline) → activateAt(핵심어 순간) = 분홍으로 채워지며 빛남 + 링 펄스
//  3) 여러 위젯이 아래 줄 좌·중·우에 동시에 놓일 수 있다 (x: 0~1)
//  4) 카운터는 핵심어 순간 시작, ease-in-out 약 1초
//  5) 퇴장 = 블러 + 페이드 0.15초 (TalkingOverlay 가 처리)
import React from "react";
import { Easing, interpolate, spring } from "remotion";
import { FONTS } from "./fonts";

type Base = { at: number; dur: number; x?: number; activateAt?: number };
export type Widget =
  | (Base & { type: "growth"; tag?: string })
  | (Base & { type: "pipeline"; steps: { icon: Icon; label: string }[] })
  | (Base & { type: "connect"; left: string; right: string })
  | (Base & { type: "chat"; ask: string; reply: string })
  | (Base & { type: "stopwatch" })
  | (Base & { type: "calendar"; big: string; label: string })
  | (Base & { type: "ring"; from: number; to: number; suffix?: string })
  | (Base & { type: "comment"; keyword: string; typeAt?: number });
export type Icon = "image" | "doc" | "play" | "camera" | "spark" | "chat";
export const WIDGET_TYPES = ["growth", "pipeline", "connect", "chat", "stopwatch", "calendar", "ring", "comment"];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const WHITE = "#FFFFFF";

/** 아이콘: 선이 그려지듯 (draw 0~1) */
const IconSvg: React.FC<{ icon: Icon; size: number; color: string; draw?: number }> = ({ icon, size, color, draw = 1 }) => {
  const s = { stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {icon === "image" && <><rect x={3} y={4} width={18} height={16} rx={3} {...s} /><circle cx={9} cy={10} r={2} {...s} /><path d="M3 17 L9 13 L14 16 L21 11" {...s} /></>}
      {icon === "doc" && <><rect x={5} y={3} width={14} height={18} rx={2} {...s} /><path d="M8 8 H16 M8 12 H16 M8 16 H13" {...s} /></>}
      {icon === "play" && <><rect x={3} y={5} width={18} height={14} rx={3} {...s} /><path d="M10 9 L15 12 L10 15 Z" {...s} /></>}
      {icon === "camera" && <><rect x={3} y={7} width={18} height={13} rx={3} {...s} /><circle cx={12} cy={13.5} r={3.5} {...s} /><path d="M8 7 L9.5 4.5 H14.5 L16 7" {...s} /></>}
      {icon === "spark" && <path d="M12 3 Q13 11 21 12 Q13 13 12 21 Q11 13 3 12 Q11 11 12 3 Z" {...s} />}
      {icon === "chat" && <path d="M4 5 H20 V16 H11 L7 20 V16 H4 Z" {...s} />}
    </svg>
  );
};

/** 활성화 순간 터지는 방사형 빗금 + 작은 반짝이 */
const Burst: React.FC<{ k: number; r: number; color: string }> = ({ k, r, color }) => k <= 0 || k >= 1 ? null : (
  <svg width={r * 4} height={r * 4} viewBox="-2 -2 4 4" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", overflow: "visible", pointerEvents: "none" }}>
    {[...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2, r0 = 0.55 + 0.6 * k, r1 = r0 + 0.25 * (1 - k);
      return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={color} strokeWidth={0.06} strokeLinecap="round" opacity={1 - k} />; })}
  </svg>
);

export const WidgetView: React.FC<{ w: Widget; t: number; frame: number; fps: number; u: number; pink: string }> = ({ w, t, frame, fps, u, pink }) => {
  const lt = t - w.at;
  const act = w.activateAt ?? w.at;                       // 활성화(분홍) 순간
  const aK = interpolate(t, [act, act + 0.25], [0, 1], { ...clamp, easing: easeOut });   // 0 = 선만, 1 = 채움
  const aPop = spring({ frame: frame - Math.round(act * fps), fps, config: { damping: 8, stiffness: 240 } });
  const burstK = interpolate(t, [act, act + 0.5], [0, 1], clamp);
  const draw = interpolate(lt, [0, 0.7], [0, 1], { ...clamp, easing: easeInOut });     // 선 그리기
  const k = spring({ frame: frame - Math.round(w.at * fps), fps, config: { damping: 14, stiffness: 180 } });
  const glow = (a: number) => `drop-shadow(0 0 ${8 * u * a}px ${pink}) drop-shadow(0 0 ${20 * u * a}px ${pink}88)`;
  const base: React.CSSProperties = { opacity: Math.min(1, k * 1.6), transform: `translateY(${(1 - k) * 16 * u}px)` };

  switch (w.type) {
    case "growth": {
      const d = interpolate(lt, [0.05, 1.0], [0, 1], { ...clamp, easing: easeOut });
      const pts: [number, number][] = [[0, 130], [70, 118], [150, 112], [220, 86], [300, 52], [380, 0]];
      const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
      const tip = pts[Math.min(pts.length - 1, Math.floor(d * (pts.length - 1)))];
      const tagK = spring({ frame: frame - Math.round(act * fps), fps, config: { damping: 12, stiffness: 200 } });
      return (
        <div style={{ ...base, position: "relative" }}>
          <svg width={420 * u} height={180 * u} viewBox="-20 -30 420 180" style={{ overflow: "visible", filter: glow(1) }}>
            <path d={`${path} L380 150 L0 150 Z`} fill={pink} opacity={0.18 * d} />
            <path d={path} stroke={pink} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} />
            <circle cx={tip[0]} cy={tip[1]} r={8} fill={WHITE} />
            {[[150, 112, 0.35], [380, 0, 0.95]].map(([x, y, at], i) => d > at && (
              <g key={i} transform={`translate(${x} ${y}) scale(${spring({ frame: frame - Math.round((w.at + 0.05 + at) * fps), fps, config: { damping: 9, stiffness: 220 } })})`}>
                <circle r={22} fill={WHITE} /><circle r={18} fill={pink} /><text y={7} textAnchor="middle" fontFamily={FONTS.ko} fontWeight={900} fontSize={20} fill={WHITE}>₩</text>
              </g>))}
          </svg>
          {w.tag && tagK > 0.01 && (
            <div style={{ position: "absolute", right: 70 * u, top: -6 * u, transform: `scale(${tagK})`, transformOrigin: "right center", padding: `${6 * u}px ${16 * u}px`, borderRadius: 999,
              background: pink, color: WHITE, fontFamily: FONTS.ko, fontWeight: 800, fontSize: 22 * u, whiteSpace: "nowrap", boxShadow: `0 0 ${14 * u}px ${pink}` }}>{w.tag} ↑</div>
          )}
          <div style={{ position: "absolute", right: 0, top: 0, width: 40 * u, height: 40 * u }}><Burst k={burstK} r={40 * u} color={WHITE} /></div>
        </div>
      );
    }
    case "pipeline": {
      const n = w.steps.length, gap = 150 * u, R = 44 * u;
      const fill = interpolate(t, [act, act + 0.2 + n * 0.25], [0, 1], { ...clamp, easing: easeInOut });
      return (
        <div style={{ ...base, position: "relative", padding: `${12 * u}px ${24 * u}px`, borderRadius: 999,
          border: `${2.5 * u}px solid ${aK > 0 ? pink : "rgba(255,255,255,0)"}`, background: `rgba(30,10,25,${0.35 * aK})`, boxShadow: aK > 0 ? `0 0 ${24 * u * aK}px ${pink}88` : "none" }}>
          <div style={{ position: "relative", width: (n - 1) * gap + R * 2, height: R * 2 }}>
            {/* 연결선: 전 = 흰 점선, 후 = 분홍 실선이 왼→오로 채워짐 */}
            <svg width={(n - 1) * gap} height={8 * u} style={{ position: "absolute", left: R, top: R - 4 * u, overflow: "visible" }}>
              <line x1={0} y1={4 * u} x2={(n - 1) * gap * draw} y2={4 * u} stroke={WHITE} strokeWidth={2.5 * u} strokeDasharray={`${3 * u} ${7 * u}`} opacity={0.8} />
              <line x1={0} y1={4 * u} x2={(n - 1) * gap * fill} y2={4 * u} stroke={pink} strokeWidth={6 * u} strokeLinecap="round" style={{ filter: glow(1) }} />
            </svg>
            {w.steps.map((s, i) => {
              const iDraw = interpolate(lt, [0.1 + i * 0.15, 0.7 + i * 0.15], [0, 1], { ...clamp, easing: easeInOut });
              const on = t >= act && fill * (n - 1) >= i - 0.02;
              const p = on ? spring({ frame: frame - Math.round((act + 0.1 + i * 0.25) * fps), fps, config: { damping: 8, stiffness: 240 } }) : 0;
              return (
                <div key={i} style={{ position: "absolute", left: i * gap, top: 0, width: R * 2, height: R * 2 }}>
                  <svg width={R * 2} height={R * 2} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                    <circle cx={R} cy={R} r={R - 2 * u} fill={on ? pink : "rgba(255,255,255,0)"} stroke={WHITE} strokeWidth={2.5 * u} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - iDraw} transform={`rotate(-90 ${R} ${R})`} style={on ? { filter: glow(1) } : undefined} />
                    {on && p < 1 && <circle cx={R} cy={R} r={(R - 2 * u) * (1 + 0.6 * p)} fill="none" stroke={pink} strokeWidth={3 * u} opacity={1 - p} />}
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", transform: `scale(${on ? 0.92 + 0.08 * p : 1})` }}><IconSvg icon={s.icon} size={40 * u} color={WHITE} draw={iDraw} /></div>
                  <div style={{ position: "absolute", top: R * 2 + 10 * u, width: 160 * u, left: R - 80 * u, textAlign: "center", fontFamily: FONTS.ko, fontWeight: 700, fontSize: 22 * u, color: WHITE, opacity: iDraw, textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>{s.label}</div>
                </div>);
            })}
          </div>
        </div>
      );
    }
    case "connect": {
      const lK = interpolate(lt, [0, 0.35], [0, 1], { ...clamp, easing: easeOut }), rK = interpolate(lt, [0.5, 0.85], [0, 1], { ...clamp, easing: easeOut });
      const lineK = interpolate(lt, [0.85, 1.4], [0, 1], { ...clamp, easing: easeInOut });
      const txt: React.CSSProperties = { fontFamily: FONTS.story, fontWeight: 600, fontSize: 46 * u, color: WHITE, textShadow: "0 2px 10px rgba(0,0,0,0.6)", whiteSpace: "nowrap" };
      return (
        <div style={{ ...base, display: "flex", alignItems: "center", gap: 14 * u }}>
          <span style={{ ...txt, clipPath: `inset(0 ${(1 - lK) * 100}% 0 0)` }}><span style={{ color: "#E8875A" }}>✳</span> {w.left}</span>
          <div style={{ position: "relative", width: 170 * u, height: 70 * u }}>
            <svg width={170 * u} height={70 * u} viewBox="0 0 170 70" style={{ overflow: "visible" }}>
              <line x1={0} y1={35} x2={170 * lineK} y2={35} stroke={aK > 0 ? pink : WHITE} strokeWidth={3} strokeDasharray="4 7" opacity={0.9} />
              {aK > 0 && <g transform={`translate(85 35) scale(${aPop})`} style={{ filter: glow(1) }}><circle r={28} fill={pink} /><path d="M-12 0 L-4 9 L13 -9" stroke={WHITE} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>}
            </svg>
            <div style={{ position: "absolute", left: 85 * u, top: 35 * u, width: 1, height: 1 }}><Burst k={burstK} r={45 * u} color={pink} /></div>
          </div>
          <span style={{ ...txt, fontFamily: FONTS.ko, fontWeight: 800, fontSize: 38 * u, clipPath: `inset(0 ${(1 - rK) * 100}% 0 0)` }}>{w.right}</span>
        </div>
      );
    }
    case "chat": {
      const typed = [...w.ask].slice(0, Math.floor(interpolate(lt, [0.1, 0.1 + w.ask.length * 0.04], [0, w.ask.length], clamp))).join("");
      const r = spring({ frame: frame - Math.round(Math.max(act, w.at + 0.3 + w.ask.length * 0.04) * fps), fps, config: { damping: 10, stiffness: 200 } });
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u }}>
          <div style={{ padding: `${12 * u}px ${28 * u}px`, borderRadius: 999, background: pink, color: WHITE, fontFamily: FONTS.ko, fontWeight: 700, fontSize: 26 * u, boxShadow: `0 0 ${16 * u}px ${pink}aa`, whiteSpace: "nowrap" }}>
            {typed}<span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>
          </div>
          {r > 0.01 && <div style={{ alignSelf: "flex-start", marginLeft: 6 * u, padding: `${10 * u}px ${22 * u}px`, borderRadius: 999, background: WHITE, color: "#222", fontFamily: FONTS.ko, fontWeight: 800, fontSize: 24 * u, transform: `scale(${r})`, transformOrigin: "left center", boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }}>{w.reply}</div>}
        </div>
      );
    }
    case "stopwatch": {
      const d = interpolate(lt, [0, 0.5], [0, 1], { ...clamp, easing: easeInOut });
      const a = interpolate(t, [act, w.at + w.dur - 0.2], [0, 340], { ...clamp, easing: Easing.in(Easing.quad) }), R = 62;
      const end = [Math.sin((a * Math.PI) / 180) * R, -Math.cos((a * Math.PI) / 180) * R];
      const speed = a > 30 ? 1 : 0; // 빨라지면 옆에 스피드 선
      return (
        <svg width={190 * u} height={200 * u} viewBox="-95 -108 190 200" style={{ ...base, overflow: "visible" }}>
          {a > 0 && <path d={`M0 0 L0 ${-R} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${end[0]} ${end[1]} Z`} fill={pink} opacity={0.85} style={{ filter: glow(0.8) }} />}
          <circle r={74} fill="none" stroke={WHITE} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} transform="rotate(-90)" />
          <g opacity={d}><rect x={-14} y={-102} width={28} height={14} rx={4} fill={WHITE} /><rect x={-4} y={-88} width={8} height={12} fill={WHITE} /></g>
          {[...Array(12)].map((_, i) => <line key={i} x1={0} y1={-64} x2={0} y2={-57} stroke={WHITE} strokeWidth={3} opacity={d} transform={`rotate(${i * 30})`} />)}
          <line x1={0} y1={0} x2={end[0] * 0.9} y2={end[1] * 0.9} stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={d} /><circle r={6} fill={WHITE} opacity={d} />
          {speed > 0 && [-20, 0, 20].map((y, i) => <line key={i} x1={-120 - i * 8} y1={y} x2={-92} y2={y} stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(t * 20 + i)} />)}
        </svg>
      );
    }
    case "calendar": {
      const pop = spring({ frame: frame - Math.round(w.at * fps), fps, config: { damping: 9, stiffness: 230 } });
      return (
        <div style={{ opacity: Math.min(1, pop * 2), transform: `scale(${pop}) rotate(${(1 - pop) * -12}deg)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 * u }}>
          <div style={{ width: 110 * u, height: 104 * u, borderRadius: 18 * u, background: WHITE, overflow: "hidden", boxShadow: `0 0 ${16 * u}px ${pink}aa`, position: "relative" }}>
            <div style={{ height: 28 * u, background: pink }} />
            {[0.3, 0.7].map((x) => <div key={x} style={{ position: "absolute", top: -6 * u, left: `${x * 100}%`, width: 8 * u, height: 20 * u, borderRadius: 4 * u, background: "#C2185B", transform: "translateX(-50%)" }} />)}
            <div style={{ textAlign: "center", fontFamily: FONTS.pop, fontSize: 48 * u, lineHeight: `${76 * u}px`, color: "#222" }}>{w.big}</div>
          </div>
          <div style={{ fontFamily: FONTS.ko, fontWeight: 800, fontSize: 22 * u, color: WHITE, textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>{w.label}</div>
        </div>
      );
    }
    case "ring": {
      // 레퍼런스 측정: 0,2,6,14,27,43,54,61,64,65 (10fps) → 약 1초 ease-in-out
      const v = interpolate(t, [act, act + 1.0], [w.from, w.to], { ...clamp, easing: easeInOut }), R = 54;
      const done = t > act + 1.0 ? spring({ frame: frame - Math.round((act + 1.0) * fps), fps, config: { damping: 8, stiffness: 260 } }) : 0;
      return (
        <svg width={150 * u} height={150 * u} viewBox="-75 -75 150 150" style={{ ...base, overflow: "visible", transform: `${base.transform} scale(${1 + 0.06 * Math.sin(Math.min(1, done) * Math.PI)})` }}>
          <circle r={R} fill="rgba(20,10,20,0.4)" stroke="rgba(255,255,255,0.3)" strokeWidth={11} />
          <circle r={R} fill="none" stroke={pink} strokeWidth={11} strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} transform="rotate(-90)" style={{ filter: glow(1) }} />
          {v > 1 && (() => { const a = (v / 100) * Math.PI * 2 - Math.PI / 2; return <circle cx={Math.cos(a) * R} cy={Math.sin(a) * R} r={7} fill={WHITE} />; })()}
          <text y={12} textAnchor="middle" fontFamily={FONTS.pop} fontSize={38} fill={WHITE}>{Math.round(v)}<tspan fontSize={20}>{w.suffix ?? "%"}</tspan></text>
          {done > 0 && done < 1 && <path d="M58 -58 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill={WHITE} opacity={1 - done} />}
        </svg>
      );
    }
    case "comment": {
      const bar = interpolate(lt, [0, 0.5], [0, 1], { ...clamp, easing: easeInOut });       // 입력창 선이 왼→오
      const typeAt = w.typeAt ?? act;
      const typed = [...w.keyword].slice(0, Math.floor(interpolate(t, [typeAt, typeAt + w.keyword.length * 0.22], [0, w.keyword.length], clamp))).join("");
      const sentAt = typeAt + w.keyword.length * 0.22 + 0.35, sent = t > sentAt;
      const pulse = sent ? spring({ frame: frame - Math.round(sentAt * fps), fps, config: { damping: 7, stiffness: 260 } }) : 0;
      const plane = interpolate(t, [sentAt, sentAt + 0.5], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
      const Wd = 700 * u;
      return (
        <div style={{ position: "relative", width: Wd, opacity: Math.min(1, lt * 6) }}>
          <svg width={Wd} height={84 * u} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <rect x={1} y={1} width={Wd - 2} height={82 * u} rx={41 * u} fill={`rgba(30,10,25,${0.3 * bar})`} stroke={WHITE} strokeWidth={2.5 * u} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - bar} />
          </svg>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 * u, height: 84 * u, padding: `0 ${12 * u}px 0 ${14 * u}px`, opacity: bar }}>
            <div style={{ width: 52 * u, height: 52 * u, borderRadius: "50%", background: pink, display: "grid", placeItems: "center" }}><svg width={30 * u} height={30 * u} viewBox="0 0 24 24"><circle cx={12} cy={9} r={4} fill={WHITE} /><path d="M4 21 Q12 12 20 21 Z" fill={WHITE} /></svg></div>
            <div style={{ flex: 1, fontFamily: FONTS.ko, fontWeight: typed ? 800 : 500, fontSize: 32 * u, color: typed ? WHITE : "rgba(255,255,255,0.6)" }}>{typed || "댓글 달기..."}{typed && <span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>}</div>
            <div style={{ position: "relative", width: 60 * u, height: 60 * u, borderRadius: "50%", background: sent ? pink : "rgba(255,255,255,0.85)", display: "grid", placeItems: "center", transform: `scale(${1 + 0.2 * Math.sin(Math.min(1, pulse) * Math.PI)})`, boxShadow: sent ? `0 0 ${20 * u}px ${pink}` : "none" }}>
              <svg width={26 * u} height={26 * u} viewBox="0 0 24 24"><path d="M5 4 L20 12 L5 20 L8 12 Z" fill={sent ? WHITE : "#333"} /></svg>
              {sent && pulse < 1 && <div style={{ position: "absolute", inset: -14 * u * pulse, borderRadius: "50%", border: `${3 * u}px solid ${pink}`, opacity: 1 - pulse }} />}
            </div>
          </div>
          {plane > 0 && plane < 1 && <svg width={36 * u} height={36 * u} viewBox="0 0 24 24" style={{ position: "absolute", right: (30 - plane * 60) * u, top: (10 - plane * 140) * u, transform: `rotate(-25deg)`, opacity: 1 - plane }}><path d="M3 11 L21 3 L13 21 L11 13 Z" fill={WHITE} /></svg>}
          {sent && [...Array(7)].map((_, i) => { const kk = t - sentAt - 0.2 - i * 0.1; if (kk < 0 || kk > 1.5) return null;
            return <div key={i} style={{ position: "absolute", right: (40 + (i % 3) * 26) * u, bottom: (80 + kk * 240) * u, fontSize: (22 + (i % 3) * 8) * u, color: i % 2 ? WHITE : pink, opacity: 1 - kk / 1.5, transform: `translateX(${Math.sin(kk * 6 + i) * 14 * u}px) scale(${Math.min(1, kk * 5)})` }}>♥</div>; })}
        </div>
      );
    }
  }
};
