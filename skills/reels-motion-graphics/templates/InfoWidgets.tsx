// 토킹 릴스용 '정보 위젯' 8종 — 자막 바로 아래에서 말에 맞춰 하나씩 (레퍼런스: 한국 크리에이터 릴스, 분홍 테마)
//   growth 상승 그래프 · pipeline 단계 노드 · connect A ✓ B · chat 요청→완성 말풍선
//   stopwatch 스톱워치 · calendar 날짜 배지 · ring 원형 카운터 · comment 댓글창 키워드 타이핑(CTA)
// TalkingOverlay 의 events 에 넣어서 쓴다. 숫자(ring·calendar)는 실제 값만.
import React from "react";
import { Easing, interpolate, spring } from "remotion";
import { FONTS } from "./fonts";

export type Widget =
  | { type: "growth"; at: number; dur: number }
  | { type: "pipeline"; at: number; dur: number; steps: { icon: Icon; label: string }[] }
  | { type: "connect"; at: number; dur: number; left: string; right: string }
  | { type: "chat"; at: number; dur: number; ask: string; reply: string }
  | { type: "stopwatch"; at: number; dur: number }
  | { type: "calendar"; at: number; dur: number; big: string; label: string }
  | { type: "ring"; at: number; dur: number; from: number; to: number; suffix?: string }
  | { type: "comment"; at: number; dur: number; keyword: string };
export type Icon = "image" | "doc" | "play" | "camera" | "spark" | "chat";
export const WIDGET_TYPES = ["growth", "pipeline", "connect", "chat", "stopwatch", "calendar", "ring", "comment"];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const IconSvg: React.FC<{ icon: Icon; size: number; color: string }> = ({ icon, size, color }) => {
  const s = { stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {icon === "image" && <><rect x={3} y={4} width={18} height={16} rx={3} {...s} /><circle cx={9} cy={10} r={2} {...s} /><path d="M3 17 L9 13 L14 16 L21 11" {...s} /></>}
      {icon === "doc" && <><rect x={5} y={3} width={14} height={18} rx={2} {...s} /><path d="M8 8 H16 M8 12 H16 M8 16 H13" {...s} /></>}
      {icon === "play" && <><rect x={3} y={5} width={18} height={14} rx={3} {...s} /><path d="M10 9 L15 12 L10 15 Z" fill={color} stroke="none" /></>}
      {icon === "camera" && <><rect x={3} y={7} width={18} height={13} rx={3} {...s} /><circle cx={12} cy={13.5} r={3.5} {...s} /><path d="M8 7 L9.5 4.5 H14.5 L16 7" {...s} /></>}
      {icon === "spark" && <path d="M12 3 Q13 11 21 12 Q13 13 12 21 Q11 13 3 12 Q11 11 12 3 Z" fill={color} stroke="none" />}
      {icon === "chat" && <path d="M4 5 H20 V16 H11 L7 20 V16 H4 Z" {...s} />}
    </svg>
  );
};

export const WidgetView: React.FC<{ w: Widget; t: number; frame: number; fps: number; u: number; pink: string; tick?: (at: number) => void }> = ({ w, t, frame, fps, u, pink }) => {
  const k = spring({ frame: frame - Math.round(w.at * fps), fps, config: { damping: 13, stiffness: 190 } });
  const lt = t - w.at;
  const glow = `drop-shadow(0 0 ${8 * u}px ${pink}) drop-shadow(0 0 ${18 * u}px ${pink}88)`;
  const base: React.CSSProperties = { transform: `translateY(${(1 - k) * 40 * u}px) scale(${0.85 + 0.15 * k})`, opacity: Math.min(1, k * 1.4) };
  switch (w.type) {
    case "growth": {
      const d = interpolate(lt, [0.1, 1.1], [0, 1], { ...clamp, easing: ease });
      const pts = [[0, 120], [90, 100], [170, 104], [250, 70], [330, 40], [400, 0]];
      const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
      return (
        <svg width={440 * u} height={170 * u} viewBox="-20 -25 440 170" style={{ ...base, overflow: "visible", filter: glow }}>
          <path d={path} stroke={pink} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} />
          {[[170, 104, 0.45], [400, 0, 0.95]].map(([x, y, at], i) => d > (at as number) && (
            <g key={i} transform={`translate(${x} ${y}) scale(${spring({ frame: frame - Math.round((w.at + 0.1 + (at as number)) * fps), fps, config: { damping: 9, stiffness: 220 } })})`}>
              <circle r={22} fill="#FFFFFF" /><circle r={18} fill={pink} /><text y={7} textAnchor="middle" fontFamily={FONTS.ko} fontWeight={900} fontSize={20} fill="#FFFFFF">₩</text>
            </g>))}
        </svg>
      );
    }
    case "pipeline": {
      const n = w.steps.length, gap = 150 * u, R = 46 * u;
      const fill = interpolate(lt, [0.2, 0.2 + n * 0.35], [0, 1], clamp);
      return (
        <div style={{ ...base, position: "relative", padding: `${14 * u}px ${26 * u}px`, borderRadius: 999, border: `${3 * u}px solid ${pink}`, background: "rgba(20,10,20,0.35)", boxShadow: `0 0 ${24 * u}px ${pink}88` }}>
          <div style={{ position: "relative", width: (n - 1) * gap + R * 2, height: R * 2 }}>
            <div style={{ position: "absolute", left: R, right: R, top: R - 3 * u, height: 6 * u, background: "rgba(255,255,255,0.35)", borderRadius: 3 }} />
            <div style={{ position: "absolute", left: R, width: ((n - 1) * gap) * fill, top: R - 3 * u, height: 6 * u, background: pink, borderRadius: 3, boxShadow: `0 0 ${10 * u}px ${pink}` }} />
            {w.steps.map((s, i) => { const on = fill * (n - 1) >= i - 0.01; const p = spring({ frame: frame - Math.round((w.at + 0.2 + i * 0.35) * fps), fps, config: { damping: 9, stiffness: 220 } });
              return (
                <div key={i} style={{ position: "absolute", left: i * gap, top: 0, width: R * 2, height: R * 2, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: on ? pink : "rgba(255,255,255,0.15)", border: `${3 * u}px solid #FFFFFF`, transform: `scale(${on ? 0.9 + 0.1 * p : 0.9})`, boxShadow: on ? `0 0 ${16 * u}px ${pink}` : "none" }}>
                  <IconSvg icon={s.icon} size={44 * u} color="#FFFFFF" />
                  <div style={{ position: "absolute", top: R * 2 + 12 * u, width: 160 * u, left: R - 80 * u, textAlign: "center", fontFamily: FONTS.ko, fontWeight: 700, fontSize: 24 * u, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>{s.label}</div>
                </div>); })}
          </div>
        </div>
      );
    }
    case "connect": {
      const d = interpolate(lt, [0.15, 0.6], [0, 1], { ...clamp, easing: ease });
      const c = spring({ frame: frame - Math.round((w.at + 0.55) * fps), fps, config: { damping: 8, stiffness: 240 } });
      const txt: React.CSSProperties = { fontFamily: FONTS.story, fontWeight: 600, fontSize: 52 * u, color: "#FFFFFF", textShadow: "0 2px 10px rgba(0,0,0,0.6)", whiteSpace: "nowrap" };
      return (
        <div style={{ ...base, display: "flex", alignItems: "center", gap: 18 * u }}>
          <span style={txt}>✳ {w.left}</span>
          <svg width={160 * u} height={70 * u} viewBox="0 0 160 70" style={{ overflow: "visible" }}>
            <line x1={0} y1={35} x2={160} y2={35} stroke={pink} strokeWidth={4} strokeDasharray="6 8" pathLength={1} strokeDashoffset={0} opacity={d} />
            <g transform={`translate(80 35) scale(${c})`} style={{ filter: glow }}><circle r={30} fill={pink} /><path d="M-13 0 L-4 10 L14 -10" stroke="#FFF" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
          </svg>
          <span style={txt}>{w.right}</span>
        </div>
      );
    }
    case "chat": {
      const typed = [...w.ask].slice(0, Math.floor(interpolate(lt, [0.15, 0.15 + w.ask.length * 0.045], [0, w.ask.length], clamp))).join("");
      const r = spring({ frame: frame - Math.round((w.at + 0.35 + w.ask.length * 0.045) * fps), fps, config: { damping: 10, stiffness: 200 } });
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * u }}>
          <div style={{ padding: `${14 * u}px ${30 * u}px`, borderRadius: 999, background: pink, color: "#FFFFFF", fontFamily: FONTS.ko, fontWeight: 700, fontSize: 30 * u, boxShadow: `0 0 ${18 * u}px ${pink}aa`, whiteSpace: "nowrap" }}>
            {typed}<span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>
          </div>
          {r > 0.01 && <div style={{ alignSelf: "flex-start", marginLeft: 10 * u, padding: `${12 * u}px ${26 * u}px`, borderRadius: 999, background: "#FFFFFF", color: "#222", fontFamily: FONTS.ko, fontWeight: 800, fontSize: 28 * u, transform: `scale(${r})`, transformOrigin: "left center", boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }}>{w.reply}</div>}
        </div>
      );
    }
    case "stopwatch": {
      const a = interpolate(lt, [0.1, w.dur - 0.2], [0, 330], clamp), R = 62;
      const end = [Math.sin((a * Math.PI) / 180) * R, -Math.cos((a * Math.PI) / 180) * R];
      return (
        <svg width={170 * u} height={190 * u} viewBox="-85 -105 170 190" style={{ ...base, overflow: "visible", filter: `drop-shadow(0 0 ${6 * u}px rgba(255,255,255,0.6))` }}>
          <path d={`M0 0 L0 ${-R} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${end[0]} ${end[1]} Z`} fill={pink} opacity={0.85} />
          <circle r={74} fill="none" stroke="#FFFFFF" strokeWidth={6} /><rect x={-14} y={-100} width={28} height={16} rx={4} fill="#FFFFFF" /><rect x={-4} y={-86} width={8} height={10} fill="#FFFFFF" />
          {[...Array(12)].map((_, i) => <line key={i} x1={0} y1={-64} x2={0} y2={-56} stroke="#FFFFFF" strokeWidth={3} transform={`rotate(${i * 30})`} />)}
          <line x1={0} y1={0} x2={end[0] * 0.9} y2={end[1] * 0.9} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" /><circle r={6} fill="#FFFFFF" />
        </svg>
      );
    }
    case "calendar":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * u }}>
          <div style={{ width: 120 * u, height: 112 * u, borderRadius: 18 * u, background: "#FFFFFF", overflow: "hidden", boxShadow: `0 0 ${16 * u}px ${pink}aa` }}>
            <div style={{ height: 30 * u, background: pink }} />
            <div style={{ textAlign: "center", fontFamily: FONTS.pop, fontSize: 54 * u, lineHeight: `${80 * u}px`, color: "#222" }}>{w.big}</div>
          </div>
          <div style={{ fontFamily: FONTS.ko, fontWeight: 800, fontSize: 26 * u, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>{w.label}</div>
        </div>
      );
    case "ring": {
      const v = interpolate(lt, [0.15, Math.min(w.dur - 0.3, 1.6)], [w.from, w.to], { ...clamp, easing: ease }), R = 54;
      return (
        <svg width={150 * u} height={150 * u} viewBox="-75 -75 150 150" style={{ ...base, overflow: "visible" }}>
          <circle r={R} fill="rgba(20,10,20,0.45)" stroke="rgba(255,255,255,0.35)" strokeWidth={12} />
          <circle r={R} fill="none" stroke={pink} strokeWidth={12} strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} transform="rotate(-90)" style={{ filter: glow }} />
          <text y={12} textAnchor="middle" fontFamily={FONTS.pop} fontSize={40} fill="#FFFFFF">{Math.round(v)}<tspan fontSize={22}>{w.suffix ?? "%"}</tspan></text>
        </svg>
      );
    }
    case "comment": {
      const typed = [...w.keyword].slice(0, Math.floor(interpolate(lt, [0.4, 0.4 + w.keyword.length * 0.12], [0, w.keyword.length], clamp))).join("");
      const sentAt = 0.6 + w.keyword.length * 0.12, sent = lt > sentAt;
      const pulse = sent ? spring({ frame: frame - Math.round((w.at + sentAt) * fps), fps, config: { damping: 7, stiffness: 260 } }) : 0;
      return (
        <div style={{ ...base, position: "relative", width: 700 * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 * u, padding: `${12 * u}px ${14 * u}px ${12 * u}px ${16 * u}px`, borderRadius: 999, border: `${3 * u}px solid #FFFFFF`, background: "rgba(20,10,20,0.35)", boxShadow: `0 0 ${18 * u}px ${pink}66` }}>
            <div style={{ width: 52 * u, height: 52 * u, borderRadius: "50%", background: pink, display: "grid", placeItems: "center" }}><svg width={30 * u} height={30 * u} viewBox="0 0 24 24"><circle cx={12} cy={9} r={4} fill="#FFF" /><path d="M4 21 Q12 12 20 21 Z" fill="#FFF" /></svg></div>
            <div style={{ flex: 1, fontFamily: FONTS.ko, fontWeight: typed ? 800 : 500, fontSize: 34 * u, color: typed ? "#FFFFFF" : "rgba(255,255,255,0.6)" }}>{typed || "댓글 달기..."}{typed && !sent && <span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>}</div>
            <div style={{ width: 60 * u, height: 60 * u, borderRadius: "50%", background: sent ? pink : "rgba(255,255,255,0.85)", display: "grid", placeItems: "center", transform: `scale(${1 + 0.25 * Math.sin(Math.min(1, pulse) * Math.PI)})`, boxShadow: sent ? `0 0 ${20 * u}px ${pink}` : "none" }}>
              <svg width={28 * u} height={28 * u} viewBox="0 0 24 24"><path d="M5 4 L20 12 L5 20 L8 12 Z" fill={sent ? "#FFF" : "#333"} /></svg>
            </div>
          </div>
          {sent && [...Array(6)].map((_, i) => { const kk = lt - sentAt - i * 0.12; if (kk < 0 || kk > 1.4) return null;
            return <div key={i} style={{ position: "absolute", right: (30 + (i % 3) * 22) * u, bottom: (70 + kk * 260) * u, fontSize: (26 + (i % 2) * 10) * u, color: i % 2 ? "#FFFFFF" : pink, opacity: 1 - kk / 1.4, transform: `translateX(${Math.sin(kk * 6 + i) * 14 * u}px)` }}>♥</div>; })}
        </div>
      );
    }
  }
};
