import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";
import { OUT, ramp } from "../lib/anim";

const EXPO = Easing.bezier(0.19, 1, 0.22, 1);

/**
 * The skip-until-paid-up rule, drawn the way the app draws the rotation: stacked folder bands, the recipient's
 * name on each tab. The member who owes is marked in clay; at `skipAt` their band slides back behind the next
 * paid-up member, and the open round lights turmeric on the new name.
 */
export const Ledger: React.FC<{ names: string[]; open: number; owes: number; skipAt: number; dur: number }> = ({ names, open, owes, skipAt, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = ramp(f, Math.round(skipAt * fps), Math.round(fps * 1.0), EXPO);
  const exit = 1 - ramp(f, dur - Math.round(fps * 0.3), Math.round(fps * 0.3));
  const bandH = 104;
  const bands = ["#1d1712", "#b0402c", "#2f4a3a", "#4a3526", "#6b2d2a", "#1d1712"];
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div style={{ position: "absolute", left: 140, top: 150, fontFamily: T.display, fontSize: 96, lineHeight: 0.95, textTransform: "uppercase", color: T.ink, opacity: ramp(f, 0, 12) }}>
        Fall behind,<br />lose your turn
      </div>
      <div style={{ position: "absolute", left: 140, top: 380, width: 560, fontFamily: T.font, fontSize: 36, lineHeight: 1.35, color: T.ink2, opacity: ramp(f, 8, 12) }}>
        A rule the group switches on when it starts. Your turn waits until every share you owe is delivered.
      </div>
      <div style={{ position: "absolute", left: 860, top: 120, width: 900 }}>
        {names.map((name, i) => {
          // the owing member (i === owes) swaps places with the next one once the rule applies
          let slot = i;
          if (i === owes) slot = i + t;
          if (i === owes + 1) slot = i - t;
          const isOpen = (i === owes + 1 && t > 0.5) || (i === open && i !== owes && t <= 0.5) || (i === owes && false);
          const owing = i === owes;
          const enter = ramp(f, 4 + i * 4, 14, OUT);
          const color = isOpen ? T.sun : bands[i % bands.length];
          const ink = isOpen ? T.ink : "#fff";
          return (
            <div key={name} style={{ position: "absolute", top: slot * (bandH - 18), left: 0, right: 0, zIndex: Math.round(slot * 10), opacity: enter,
              translate: `${(1 - enter) * 60}px 0` }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: owing ? T.clay : color, color: owing ? "#fff" : ink, borderRadius: "16px 16px 0 0",
                padding: "10px 22px 14px", marginLeft: (i % 3) * 30, fontFamily: T.font, fontWeight: 700, fontSize: 32 }}>
                {name}
                {owing && <span style={{ fontFamily: T.monoFont, fontSize: 22, fontWeight: 600, background: "#fff", color: T.clay, padding: "2px 10px", borderRadius: 999 }}>owes 1 share</span>}
              </div>
              <div style={{ marginTop: -4, height: 64, background: owing ? T.clay : color, borderRadius: "4px 16px 16px 16px", display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "0 24px", color: owing ? "#fff" : ink, fontFamily: T.monoFont, fontSize: 24, letterSpacing: 1.5 }}>
                <span>ROUND {Math.round(slot) + 1}</span>
                <span>{isOpen ? "OPEN NOW" : owing && t > 0.5 ? "SKIPPED UNTIL PAID UP" : Math.round(slot) < open ? "✓ COMPLETE" : "UP NEXT"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
