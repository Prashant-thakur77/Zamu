import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { T } from "../theme";
import { KangaBand } from "./Kanga";

/** Matte paper with grain and a faint warm light that drifts; kanga hem top and bottom. Never busy behind text. */
export const Backdrop: React.FC<{ dim?: number; hem?: boolean }> = ({ dim = 0, hem = true }) => {
  const f = useCurrentFrame();
  const a = f / 260;
  const x = 35 + Math.sin(a) * 14, y = 40 + Math.cos(a * 0.8) * 10;
  return (
    <AbsoluteFill style={{ backgroundColor: T.paper }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 60% at ${x}% ${y}%, #fff8ea, transparent 70%)` }} />
      <AbsoluteFill style={{ opacity: 0.32, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <filter id="paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={Math.floor(f / 3) % 8} />
            <feColorMatrix values="0 0 0 0 0.35 0 0 0 0 0.28 0 0 0 0 0.2 0 0 0 .22 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paper)" />
        </svg>
      </AbsoluteFill>
      {hem && (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}><KangaBand height={22} /></div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}><KangaBand height={22} /></div>
        </>
      )}
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(29,23,18,${dim})` }} />}
    </AbsoluteFill>
  );
};
