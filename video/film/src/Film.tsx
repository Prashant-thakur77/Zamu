import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries, type TransitionPresentation, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { film, type Scene, type Transition } from "./film";
import { INOUT } from "./lib/anim";
import { Backdrop } from "./components/Backdrop";
import { Overlays } from "./components/Overlays";
import { Captions } from "./components/Captions";
import { Kinetic } from "./scenes/Kinetic";
import { Screen } from "./scenes/Screen";
import { Device3D } from "./scenes/Device3D";
import { Hero3D } from "./scenes/Hero3D";
import { Persona } from "./scenes/Persona";
import { Diagram } from "./scenes/Diagram";
import { Proof } from "./scenes/Proof";
import { Code } from "./scenes/Code";
import { EndCard } from "./scenes/EndCard";
import { Arch3D } from "./scenes/Arch3D";
import { Footage } from "./scenes/Footage";
import { PhoneStep } from "./scenes/PhoneStep";
import { Turn } from "./scenes/Turn";
import { Ring } from "./scenes/Ring";
import { Ledger } from "./scenes/Ledger";

// Scene i always STARTS at the sum of the previous durations, so VO chunks timed to scene starts stay in sync:
// each sequence is lengthened by its outgoing transition, which overlaps the next scene's first frames.

type ZP = { kind: "zoom" | "blur" };
const Through: React.FC<TransitionPresentationComponentProps<ZP>> = ({ children, presentationProgress: p, presentationDirection, passedProps }) => {
  const entering = presentationDirection === "entering";
  const s = entering ? 0.85 + 0.15 * p : 1 + 0.25 * p;
  const o = entering ? p : 1 - p;
  const b = (entering ? 1 - p : p) * (passedProps.kind === "blur" ? 18 : 8);
  return <AbsoluteFill style={{ opacity: o, scale: `${passedProps.kind === "zoom" ? s : 1}`, filter: `blur(${b}px)` }}>{children}</AbsoluteFill>;
};
const through = (kind: ZP["kind"]): TransitionPresentation<ZP> => ({ component: Through, props: { kind } });

const tFrames = (t: Transition | undefined, fps: number) => (!t || t.type === "cut" ? 0 : Math.round((t.dur ?? 0.5) * fps));

const present = (t: Transition): TransitionPresentation<any> => {
  switch (t.type) {
    case "slide": return slide({ direction: t.dir ?? "from-right" });
    case "wipe": return wipe({ direction: t.dir ?? "from-left" });
    case "zoom": return through("zoom");
    case "blur": return through("blur");
    default: return fade();
  }
};

/** Nothing static: every scene breathes with a slow push unless it sets "drift": false (screen/3D scenes move their own camera). */
const Drift: React.FC<{ on: boolean; dur: number; children: React.ReactNode }> = ({ on, dur, children }) => {
  const f = useCurrentFrame();
  if (!on) return <AbsoluteFill>{children}</AbsoluteFill>;
  const k = Math.min(1, f / Math.max(1, dur));
  return <AbsoluteFill style={{ scale: `${1 + 0.035 * k}` }}>{children}</AbsoluteFill>;
};

const SceneBody: React.FC<{ s: Scene; dur: number }> = ({ s, dur }) => {
  switch (s.type) {
    case "kinetic": return <Kinetic lines={s.lines} emphasis={s.emphasis} kicker={s.kicker} align={s.align} dur={dur} />;
    case "screen": return <Screen {...s} dur={dur} />;
    case "device3d": return <Device3D src={s.src} device={s.device} title={s.title} flatten={s.flatten} dur={dur} />;
    case "hero3d": return <Hero3D title={s.title} subtitle={s.subtitle} model={s.model} modelScale={s.modelScale} clip={s.clip} shape={s.shape} dur={dur} />;
    case "persona": return <Persona {...s} dur={dur} />;
    case "diagram": return <Diagram title={s.title} nodes={s.nodes} edges={s.edges} order={s.order} dur={dur} />;
    case "proof": return <Proof {...s} dur={dur} />;
    case "code": return <Code title={s.title} file={s.file} code={s.code} highlight={s.highlight} dur={dur} />;
    case "arch3d": return <Arch3D {...s} dur={dur} />;
    case "footage": return <Footage {...s} dur={dur} />;
    case "phonestep": return <PhoneStep {...s} dur={dur} />;
    case "turn": return <Turn {...s} dur={dur} />;
    case "ring": return <Ring {...s} dur={dur} />;
    case "ledger": return <Ledger {...s} dur={dur} />;
    case "endcard": return <EndCard name={s.name} tagline={s.tagline} links={s.links} logo={s.logo} dur={dur} />;
  }
};

export const Film: React.FC = () => {
  const { fps } = useVideoConfig();
  const items: React.ReactNode[] = [];
  film.scenes.forEach((s, i) => {
    const out = i < film.scenes.length - 1 ? tFrames(s.transition, fps) : 0;
    const dur = Math.round(s.duration * fps);
    items.push(
      <TransitionSeries.Sequence key={s.id} durationInFrames={dur + out} name={`${s.id} · ${s.type}`}>
        <AbsoluteFill>
          {s.backdrop !== false && s.type !== "footage" && <Backdrop dim={s.type === "screen" ? 0.15 : 0} hem={s.type !== "turn"} />}
          <Drift on={(s as { drift?: boolean }).drift ?? !["screen", "device3d", "hero3d", "arch3d", "footage", "turn", "ring", "ledger"].includes(s.type)} dur={dur}>
            <SceneBody s={s} dur={dur} />
          </Drift>
          {s.overlays && <Overlays items={s.overlays} />}
        </AbsoluteFill>
      </TransitionSeries.Sequence>,
    );
    if (out > 0) {
      items.push(<TransitionSeries.Transition key={`${s.id}-t`} presentation={present(s.transition!)} timing={linearTiming({ durationInFrames: out, easing: INOUT })} />);
    }
  });
  return (
    <AbsoluteFill style={{ backgroundColor: film.theme.bg }}>
      <TransitionSeries>{items}</TransitionSeries>
      {film.captions && <Captions file={film.captions} />}
      {film.previewAudio && <Audio src={staticFile(film.previewAudio)} />}
    </AbsoluteFill>
  );
};

export const totalFrames = (fps: number) => film.scenes.reduce((a, s) => a + Math.round(s.duration * fps), 0);
