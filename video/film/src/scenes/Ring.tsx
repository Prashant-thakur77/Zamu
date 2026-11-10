import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";
import { OUT, ramp } from "../lib/anim";
import { TakeLabel } from "../components/Kanga";

const EXPO = Easing.bezier(0.19, 1, 0.22, 1);
const TRAVEL = Easing.bezier(0.65, 0, 0.25, 1);

export type RingProps = {
  names: string[];
  recipient: number;
  share: number;
  /** seconds (scene time) when each payer's coin leaves, in payer order */
  payAt: number[];
  /** seconds when the turn passes to the next seat (optional) */
  turnAt?: number;
  codes?: string[];
  label?: string;
  /** the old way: every coin goes into one treasurer's tin in the middle, nobody's turn is lit */
  treasurer?: boolean;
  dur: number;
};

/**
 * Every hand to one hand. Members sit around the table; whoever's turn it is sits lit at the top. Each payer's
 * coin travels the chord to the lit seat, the chord stays drawn in green, the payer's seat gets a tick, and an
 * M-Pesa SMS lands on the recipient's phone beside the ring while the pot counts up. Then the turn passes.
 */
export const Ring: React.FC<RingProps> = ({ names, recipient, share, payAt, turnAt, codes = [], label, treasurer = false, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = names.length;
  const step = 360 / n;
  const cx = treasurer ? 960 : 640, cy = 560, R = 330;
  const payers = names.map((_, i) => i).filter((i) => treasurer || i !== recipient);
  const coinDur = Math.round(fps * 0.9);
  const landed = (k: number) => f >= Math.round(payAt[k] * fps) + coinDur
  const nLanded = payers.filter((_, k) => payAt[k] !== undefined && landed(k)).length;
  const turn = turnAt !== undefined && turnAt !== null ? ramp(f, Math.round(turnAt * fps), Math.round(fps * 1.0), EXPO) : 0;
  const rot = -recipient * step - turn * step;
  const enter = ramp(f, 0, Math.round(fps * 0.6), OUT);
  const exit = 1 - ramp(f, dur - Math.round(fps * 0.35), Math.round(fps * 0.35));

  // count the pot up smoothly as each coin lands
  const pot = payers.reduce((acc, _, k) => {
    if (payAt[k] === undefined) return acc;
    const t = ramp(f, Math.round(payAt[k] * fps) + coinDur - 4, 12);
    return acc + t * share;
  }, 0);

  const pos = (i: number) => {
    const a = ((i * step + rot) * Math.PI) / 180 - Math.PI / 2;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  };
  const target = treasurer ? { x: cx, y: cy } : pos(recipient);
  const nextLit = turn > 0.5;

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      {label && <TakeLabel text={label} opacity={ramp(f, 10, 12)} />}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: enter }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.rule} strokeWidth={3} strokeDasharray="4 14" />
        {/* chords that stay drawn once a share lands */}
        {payers.map((i, k) => {
          if (payAt[k] === undefined) return null;
          const t0 = Math.round(payAt[k] * fps);
          const draw = ramp(f, t0, coinDur, TRAVEL);
          if (draw <= 0) return null;
          const p = pos(i);
          const len = Math.hypot(target.x - p.x, target.y - p.y);
          return (
            <line key={`c${i}`} x1={p.x} y1={p.y} x2={target.x} y2={target.y} stroke={treasurer ? T.clay : T.leaf} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={len} strokeDashoffset={len * (1 - draw)} opacity={0.55 * (1 - turn)} />
          );
        })}
        {/* seats */}
        {names.map((name, i) => {
          const p = pos(i);
          const isTurn = !treasurer && (nextLit ? i === (recipient + 1) % n : i === recipient);
          const k = payers.indexOf(i);
          const paid = !treasurer && !nextLit && k >= 0 && payAt[k] !== undefined && landed(k);
          const r = isTurn ? 66 : 50;
          const pop = isTurn ? 1 + 0.06 * Math.sin(f / 9) : 1;
          return (
            <g key={name} transform={`translate(${p.x} ${p.y}) scale(${pop})`}>
              {isTurn && <circle r={r + 16} fill="none" stroke={T.sun} strokeWidth={4} opacity={0.45 + 0.25 * Math.sin(f / 9)} />}
              <circle r={r} fill={isTurn ? T.sun : paid ? T.leafBg : T.card} stroke={isTurn ? T.ink : paid ? T.leaf : T.rule} strokeWidth={isTurn ? 7 : 5} />
              <text y={isTurn ? 14 : 11} textAnchor="middle" fontFamily={T.font} fontWeight={700} fontSize={isTurn ? 40 : 32}
                fill={isTurn ? T.ink : paid ? T.leaf : T.ink}>{name.slice(0, 2).toUpperCase()}</text>
              <text y={r + 40} textAnchor="middle" fontFamily={T.font} fontWeight={600} fontSize={28} fill={T.ink2}>{name}</text>
              {paid && (
                <g transform={`translate(${r * 0.72} ${-r * 0.72}) scale(${ramp(f, Math.round(payAt[k] * fps) + coinDur - 2, 8)})`}>
                  <circle r={19} fill={T.leaf} />
                  <path d="M-8 0 l5.5 5.5 l10 -11" stroke="#fff" strokeWidth={4.5} fill="none" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}
        {/* coins in flight */}
        {payers.map((i, k) => {
          if (payAt[k] === undefined) return null;
          const t0 = Math.round(payAt[k] * fps);
          const t = ramp(f, t0, coinDur, TRAVEL);
          if (f < t0 || t >= 1) return null;
          const p = pos(i);
          const x = p.x + (target.x - p.x) * t, y = p.y + (target.y - p.y) * t - Math.sin(t * Math.PI) * 50;
          const s = 0.6 + 0.6 * Math.sin(t * Math.PI);
          return (
            <g key={`coin${i}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <circle r={26} fill={treasurer ? T.sun : T.leafBright} stroke={treasurer ? T.ink : T.leaf} strokeWidth={5} />
              <text y={9} textAnchor="middle" fontFamily={T.font} fontWeight={800} fontSize={24} fill="#fff">KSh</text>
            </g>
          );
        })}
      </svg>
      {treasurer && (
        <div style={{ position: "absolute", left: cx - 210, top: cy - 175, width: 420, textAlign: "center", opacity: enter }}>
          <svg width="170" height="170" viewBox="0 0 170 170" style={{ display: "block", margin: "0 auto" }}>
            <ellipse cx="85" cy="40" rx="62" ry="18" fill={T.paper2} stroke={T.ink} strokeWidth="5" />
            <path d="M23 40 V130 a62 18 0 0 0 124 0 V40" fill={T.card} stroke={T.ink} strokeWidth="5" />
            <ellipse cx="85" cy="40" rx="30" ry="7" fill={T.ink} />
            <text x="85" y="105" textAnchor="middle" fontFamily={T.display} fontSize="44" fill={T.clay}>?</text>
          </svg>
          <div style={{ fontFamily: T.monoFont, fontSize: 24, letterSpacing: 3, color: T.ink2, textTransform: "uppercase", marginTop: 6 }}>the treasurer's tin</div>
          <div style={{ fontFamily: T.display, fontSize: 64, lineHeight: 1, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 30, marginRight: 8, verticalAlign: 24 }}>KSh</span>{Math.round(pot).toLocaleString("en-US")}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 26, color: T.clay, fontWeight: 600 }}>held by one person</div>
        </div>
      )}
      {/* the pot, in the empty centre: no treasurer, no tin */}
      {!treasurer && (<>
      <div style={{ position: "absolute", left: cx - 170, top: cy - 170, width: 340, height: 340, borderRadius: "50%", background: T.paper,
        boxShadow: `0 0 0 3px ${T.rule}`, opacity: enter }} />
      <div style={{ position: "absolute", left: cx - 220, top: cy - 92, width: 440, textAlign: "center", opacity: enter }}>
        <div style={{ fontFamily: T.monoFont, fontSize: 26, letterSpacing: 4, color: T.ink3, textTransform: "uppercase" }}>
          {nextLit ? "next turn" : `to ${names[recipient]}`}
        </div>
        <div style={{ fontFamily: T.display, fontSize: 118, lineHeight: 1, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 50, marginRight: 10, verticalAlign: 48 }}>KSh</span>
          {Math.round(nextLit ? 0 : pot).toLocaleString("en-US")}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 28, color: T.ink3 }}>{nextLit ? names[(recipient + 1) % n] : `of ${(share * payers.length).toLocaleString("en-US")}`}</div>
      </div>
      </>)}
      {/* the recipient's phone, where every share lands as an M-Pesa SMS */}
      <div style={{ position: "absolute", left: 1290, top: 110, width: 470, height: 870, borderRadius: 60, background: T.ink, padding: 16,
        boxShadow: `10px 10px 0 ${T.ink3}55`, translate: `${(1 - enter) * 200}px 0`, opacity: treasurer ? 0 : enter * (1 - turn) }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 46, background: T.paper, overflow: "hidden", padding: "36px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: T.font, fontSize: 26, fontWeight: 700, color: T.ink, textAlign: "center", marginBottom: 6 }}>{names[recipient]}'s phone</div>
          {payers.map((i, k) => {
            if (payAt[k] === undefined) return null;
            const t0 = Math.round(payAt[k] * fps) + coinDur - 2;
            const a = ramp(f, t0, 10);
            if (a <= 0) return null;
            const code = codes[k] ?? `TK${(7 + k) * 13}QX${k}`;
            return (
              <div key={`sms${i}`} style={{ background: T.card, border: `2.5px solid ${T.leaf}`, borderRadius: 16, overflow: "hidden",
                opacity: a, translate: `0 ${(1 - a) * -26}px` }}>
                <div style={{ background: T.leaf, color: "#fff", fontFamily: T.font, fontWeight: 700, fontSize: 19, padding: "5px 12px", display: "flex", justifyContent: "space-between" }}>
                  <span>M-PESA</span><span style={{ fontFamily: T.monoFont }}>{code}</span>
                </div>
                <div style={{ fontFamily: T.monoFont, fontSize: 17, lineHeight: 1.35, color: T.ink, padding: "7px 12px" }}>
                  {code} Confirmed. You have received Ksh{share.toLocaleString("en-US")}.00 from {names[i].toUpperCase()}.
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 1000, width: 470, textAlign: "center", fontFamily: T.font, fontSize: 26, color: T.ink2, opacity: treasurer ? 0 : enter * (1 - turn) }}>
        {nLanded} of {payers.length} shares received
      </div>
    </AbsoluteFill>
  );
};
