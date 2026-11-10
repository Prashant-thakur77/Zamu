import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as instrument } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as mono } from "@remotion/google-fonts/JetBrainsMono";
import { film } from "./film";

// Zamu's own type: condensed sign-writing caps for headlines, Instrument Sans for text, JetBrains Mono for receipts.
const display = anton("normal", { weights: ["400"], subsets: ["latin"] });
const text = instrument("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const code = mono("normal", { weights: ["400", "600"], subsets: ["latin"] });

export const T = {
  ...film.theme,
  font: text.fontFamily,
  display: display.fontFamily,
  monoFont: code.fontFamily,
  // Zamu palette (app/globals.css)
  paper: "#f3ecdf",
  paper2: "#e9dfcd",
  card: "#fbf7ef",
  rule: "#d6c8b1",
  ink: "#1d1712",
  ink2: "#5a4e42",
  ink3: "#8a7b6a",
  leaf: "#127a3a",
  leafBright: "#2fa84f",
  leafBg: "#dcefd9",
  sun: "#f0ac16",
  sunBg: "#fbe7b5",
  clay: "#b0402c",
  clayBg: "#f4d9cf",
  // type scale at 1080p
  h1: 112, h2: 76, h3: 52, body: 40, small: 30, label: 26,
  safeX: 96, safeY: 84,
};
