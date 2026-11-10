import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../theme";

/** The printed kanga hem: ink band, clay diamonds, turmeric dots. `drift` slides the print slowly. */
export const KangaBand: React.FC<{ height?: number; drift?: boolean; style?: React.CSSProperties }> = ({ height = 28, drift = true, style }) => {
  const f = useCurrentFrame();
  const cell = height;
  const off = drift ? (f * 0.6) % cell : 0;
  const id = `k${height}`;
  return (
    <svg width="100%" height={height} style={{ display: "block", ...style }}>
      <defs>
        <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse" patternTransform={`translate(${off} 0)`}>
          <rect width={cell} height={cell} fill={T.ink} />
          <path d={`M${cell / 2} ${cell * 0.12} L${cell * 0.88} ${cell / 2} L${cell / 2} ${cell * 0.88} L${cell * 0.12} ${cell / 2} Z`} fill="none" stroke={T.clay} strokeWidth={cell * 0.09} />
          <circle cx={cell / 2} cy={cell / 2} r={cell * 0.13} fill={T.sun} />
          <circle cx={0} cy={0} r={cell * 0.08} fill={T.sun} />
          <circle cx={cell} cy={cell} r={cell * 0.08} fill={T.sun} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
};

/** A small label chip that says what a take is (persona, local test, live, illustration). */
export const TakeLabel: React.FC<{ text: string; opacity?: number }> = ({ text, opacity = 1 }) => (
  <div style={{ position: "absolute", top: 58, right: 72, fontFamily: T.monoFont, fontSize: 24, letterSpacing: 1.5, textTransform: "uppercase",
    color: T.ink, background: T.card, border: `2px solid ${T.ink}`, borderRadius: 999, padding: "8px 18px", opacity,
    boxShadow: `3px 3px 0 ${T.ink}` }}>{text}</div>
);
