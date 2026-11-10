import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { T } from "./theme";
import { KangaBand } from "./components/Kanga";

/** YouTube thumbnail: the promise in four words, the ring with the lit turn, the wordmark. Readable at 320 px. */
export const Thumbnail: React.FC = () => {
  const seats = 6, R = 210, cx = 1450, cy = 540;
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: T.paper }}>
     <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${width / 1920})`, transformOrigin: "0 0" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}><KangaBand height={40} drift={false} /></div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}><KangaBand height={40} drift={false} /></div>
      <div style={{ position: "absolute", left: 90, top: 150, width: 980 }}>
        <div style={{ fontFamily: T.display, fontSize: 210, lineHeight: 0.86, color: T.ink, textTransform: "uppercase" }}>
          Paid straight to <span style={{ color: T.leaf }}>M-Pesa</span>
        </div>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 96, letterSpacing: -4, color: T.ink }}>zamu</div>
          <div style={{ fontFamily: T.font, fontWeight: 600, fontSize: 40, color: T.ink2 }}>· your chama, no treasurer</div>
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: seats }, (_, i) => {
          const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
          if (i === 0) return null;
          return <line key={`l${i}`} x1={x} y1={y} x2={cx} y2={cy - R} stroke={T.leaf} strokeWidth={8} opacity={0.6} />;
        })}
        {Array.from({ length: seats }, (_, i) => {
          const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
          const on = i === 0;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={on ? 92 : 62} fill={on ? T.sun : T.leafBg} stroke={on ? T.ink : T.leaf} strokeWidth={on ? 12 : 8} />
              {!on && <path d={`M${x - 22} ${y} l14 14 l28 -30`} stroke={T.leaf} strokeWidth={11} fill="none" strokeLinecap="round" />}
            </g>
          );
        })}
        <rect x={cx - 220} y={cy - 62} width={440} height={130} rx={20} fill={T.paper} />
        <text x={cx} y={cy + 40} textAnchor="middle" fontFamily={T.display} fontSize={110} fill={T.ink}>KSh 5,000</text>
      </svg>
     </div>
    </AbsoluteFill>
  );
};
