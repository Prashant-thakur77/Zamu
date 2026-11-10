import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";
import { ramp, OUT } from "../lib/anim";

/** Kinetic typography: words rise out of a mask one by one; emphasis words get the accent and an underline sweep.
 *  Use for the hook line, the stakes, the claim. One idea per scene, ≤ 12 words on screen. */
export const Kinetic: React.FC<{ lines: string[]; emphasis?: string[]; kicker?: string; align?: "center" | "left"; dur: number; onFootage?: boolean }> = ({
  lines, emphasis = [], kicker, align = "center", dur, onFootage = false,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stagger = Math.round(fps * 0.075);
  const exit = 1 - ramp(f, dur - Math.round(fps * 0.35), Math.round(fps * 0.35));
  const isEm = (w: string) => emphasis.some((e) => w.replace(/[^\w%$.-]/g, "").toLowerCase() === e.toLowerCase());
  let k = 0;
  const big = lines.join(" ").split(" ").length <= 5;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: align === "center" ? "center" : "flex-start",
      padding: `0 ${T.safeX * 1.5}px`, opacity: exit }}>
      {kicker && (
        <div style={{ fontFamily: T.monoFont, fontSize: T.label, letterSpacing: 4, textTransform: "uppercase",
          color: onFootage ? T.sun : T.accent, marginBottom: 28, textShadow: onFootage ? "0 2px 12px rgba(0,0,0,.7)" : undefined, opacity: ramp(f, 0, 12), translate: `0 ${(1 - ramp(f, 0, 14)) * 12}px` }}>
          {kicker}
        </div>
      )}
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start",
          gap: "0 0.24em", fontFamily: T.display, fontWeight: 400, fontSize: big ? T.h1 * 1.5 : T.h1 * 1.12,
          lineHeight: 1.0, letterSpacing: 0, color: onFootage ? "#fffaf0" : T.fg, textAlign: align, textTransform: "uppercase",
          textShadow: onFootage ? "0 4px 24px rgba(0,0,0,.65)" : undefined }}>
          {line.split(" ").map((w, wi) => {
            const start = 6 + k++ * stagger;
            const t = ramp(f, start, Math.round(fps * 0.45), OUT);
            const em = isEm(w);
            const u = ramp(f, start + 8, Math.round(fps * 0.4));
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
                <span style={{ display: "inline-block", position: "relative", translate: `0 ${(1 - t) * 105}%`,
                  filter: `blur(${(1 - t) * 6}px)`, color: em ? (onFootage ? T.sun : T.accent) : (onFootage ? "#fffaf0" : T.fg) }}>
                  {w}
                  {em && (
                    <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.07em", width: `${u * 100}%`,
                      background: T.accent, borderRadius: 4 }} />
                  )}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};
