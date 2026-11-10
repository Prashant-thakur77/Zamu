import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";
import { OUT, interp, ramp } from "../lib/anim";
import { Easing } from "remotion";
import { KangaBand } from "../components/Kanga";

const EXPO = Easing.bezier(0.19, 1, 0.22, 1);

/**
 * The signature transition: a ring of seats appears, turns one seat (the turn passes), and its kanga border
 * opens outward like an iris onto the next section's title. The app's own "turn passes" motion, full frame.
 */
export const Turn: React.FC<{ title: string; subtitle?: string; kicker?: string; seats?: number; wordmark?: boolean; dur: number }> = ({
  title, subtitle, kicker, seats = 8, wordmark = false, dur,
}) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const turnStart = Math.round(fps * 0.15);
  const turn = ramp(f, turnStart, Math.round(fps * 1.0), EXPO);
  const irisStart = Math.round(fps * 0.75);
  const iris = ramp(f, irisStart, Math.round(fps * 0.9), Easing.bezier(0.65, 0, 0.35, 1));
  const step = 360 / seats;
  const R = 230;
  const maxR = Math.hypot(width, height) / 2 + 40;
  const irisR = 290 + iris * (maxR - 290);
  const ringOpacity = ramp(f, 0, 8) * (1 - ramp(f, irisStart + 10, 14));
  const cx = width / 2, cy = height / 2;
  const exit = 1 - ramp(f, dur - Math.round(fps * 0.3), Math.round(fps * 0.3));
  const lit = turn > 0.5 ? 1 : 0;

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      {/* the next section, revealed through the opening ring */}
      <AbsoluteFill style={{ backgroundColor: T.ink, clipPath: `circle(${irisR}px at 50% 50%)` }}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 26,
          opacity: ramp(f, irisStart + 6, 14), translate: `0 ${(1 - ramp(f, irisStart + 6, 18)) * 18}px`,
          scale: `${1 + 0.05 * Math.min(1, f / Math.max(1, dur))}` }}>
          {kicker && <div style={{ fontFamily: T.monoFont, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: T.sun }}>{kicker}</div>}
          {wordmark ? (
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <div style={{ rotate: `${-Math.max(0, f - irisStart) * 0.6}deg` }}><Mark size={150} lit={0} /></div>
              <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 210, letterSpacing: -10, color: T.paper, lineHeight: 1 }}>zamu</div>
            </div>
          ) : (
            <div style={{ fontFamily: T.display, fontSize: 150, lineHeight: 0.95, color: T.paper, textTransform: "uppercase", textAlign: "center", maxWidth: 1500 }}>{title}</div>
          )}
          {subtitle && <div style={{ fontFamily: T.display, fontSize: 84, lineHeight: 1, color: T.sun, textTransform: "uppercase", textAlign: "center",
            opacity: ramp(f, irisStart + 16, 14) }}>{subtitle}</div>}
        </AbsoluteFill>
      </AbsoluteFill>
      {/* the kanga rim of the iris */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="rim" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill={T.ink} />
            <path d="M15 4 L26 15 L15 26 L4 15 Z" fill="none" stroke={T.clay} strokeWidth="3" />
            <circle cx="15" cy="15" r="4" fill={T.sun} />
          </pattern>
        </defs>
        <circle cx={cx} cy={cy} r={irisR + 11} fill="none" stroke="url(#rim)" strokeWidth={22} opacity={iris > 0.98 ? 0 : ramp(f, irisStart - 4, 6)} />
        {/* the ring of seats that turns */}
        <g opacity={ringOpacity} transform={`rotate(${-turn * step} ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.rule} strokeWidth={3} strokeDasharray="4 12" />
          {Array.from({ length: seats }, (_, i) => {
            const a = (i * step * Math.PI) / 180 - Math.PI / 2;
            const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
            const on = i === lit;
            const r = on ? 46 : 30;
            return <circle key={i} cx={x} cy={y} r={r} fill={on ? T.sun : T.card} stroke={on ? T.ink : T.rule} strokeWidth={on ? 6 : 4} />;
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const Mark: React.FC<{ size: number; lit?: number; color?: string }> = ({ size, lit = 0, color }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const on = i === lit;
      return <circle key={i} cx={16 + Math.cos(a) * 11} cy={16 + Math.sin(a) * 11} r={on ? 4.2 : 2.6} fill={on ? T.sun : color ?? T.paper} />;
    })}
  </svg>
);

/** Little helper used by other scenes for a fade-in heading in Zamu's sign-writing type. */
export const SignHead: React.FC<{ text: string; size?: number; delay?: number; color?: string }> = ({ text, size = 96, delay = 0, color }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: T.display, fontSize: size, lineHeight: 0.95, textTransform: "uppercase", color: color ?? T.ink,
      opacity: ramp(f, delay, 12), translate: `0 ${(1 - ramp(f, delay, 16, OUT)) * 14}px` }}>{text}</div>
  );
};

export const Hem: React.FC = () => <KangaBand height={22} />;
export { interp };
