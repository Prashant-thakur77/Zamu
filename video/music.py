#!/usr/bin/env python3
"""Zamu's own score, synthesised in numpy: no samples, no SoundFont, nothing licensed, nothing Content ID can match.

One tune, 96 bpm, A major / F# minor, with a lilt (swung 8ths):
  kalimba   plucked metal tines: the motif, a turning five-note figure (the turn passing seat to seat)
  shaker    soft swung 8ths, enters on the turn (the name)
  drum      a low hand drum on each section change (the signature turn), and on the downbeats of the recap
  pad       warm, low, under the story; swells under the recap and resolves on the end card
  bass      round sine bass on chord roots from the name on
Arc from the real scene starts (narration/timeline.json, else film.json durations): kalimba alone under the story ->
drum + shaker + bass enter on the name -> light groove under the product -> sparse arpeggio counting the coins in the
ring -> thinned under the 3D -> lift for the recap -> the motif resolved over the close and end card.

  python3 video/music.py [--out PATH]
"""
from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
HERE = Path(__file__).resolve().parent
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE / "audio" / "music.wav"
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
SWING = 0.58  # fraction of the beat where the off-8th lands
rng = np.random.default_rng(7)


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def kalimba(n: int, vel: float = 0.6, dur: float = 2.2) -> np.ndarray:
    f0 = midi(n)
    L = int(dur * SR)
    t = np.arange(L) / SR
    # tine: strong fundamental, a bright inharmonic partial that dies fast, a soft metallic click
    y = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.9)
    y += 0.35 * np.sin(2 * np.pi * f0 * 5.4 * t) * np.exp(-t / 0.08)
    y += 0.12 * np.sin(2 * np.pi * f0 * 2.0 * t) * np.exp(-t / 0.4)
    y += 0.05 * rng.standard_normal(L) * np.exp(-t / 0.004)
    y *= np.minimum(1, t / 0.002)
    return y * vel * 0.32


def shaker(vel: float = 0.4) -> np.ndarray:
    L = int(0.09 * SR)
    t = np.arange(L) / SR
    noise = rng.standard_normal(L)
    # crude high-pass: difference of noise
    hp = np.diff(noise, prepend=0)
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.03)
    return hp * env * vel * 0.05


def drum(vel: float = 0.7) -> np.ndarray:
    L = int(0.7 * SR)
    t = np.arange(L) / SR
    f = 95 * np.exp(-t / 0.12) + 58
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(phase) * np.exp(-t / 0.28)
    y += 0.25 * rng.standard_normal(L) * np.exp(-t / 0.01)  # palm slap
    return y * vel * 0.5


def pad(notes: list[int], dur: float, vel: float = 0.4) -> np.ndarray:
    L = int(dur * SR)
    t = np.arange(L) / SR
    y = np.zeros(L)
    for n in notes:
        for det in (-0.07, 0.0, 0.07):
            y += np.sin(2 * np.pi * midi(n + det) * t + rng.uniform(0, 6.28)) * 0.33
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.2)
    return y * env * vel * 0.045


def bass(n: int, dur: float, vel: float = 0.5) -> np.ndarray:
    L = int(dur * SR)
    t = np.arange(L) / SR
    f0 = midi(n)
    y = np.sin(2 * np.pi * f0 * t) + 0.25 * np.sin(2 * np.pi * 2 * f0 * t)
    env = np.minimum(1, t / 0.02) * np.exp(-t / 1.1)
    return y * env * vel * 0.16


# A major / F# minor progression, one chord per bar: F#m D A E
CHORDS = [[54, 57, 61], [50, 54, 57], [57, 61, 64], [52, 56, 59]]
ROOTS = [42, 38, 45, 40]
# the motif: a five-note figure that turns around (seat to seat), last note left open
MOTIF = [(0.0, 73), (0.5, 76), (1.0, 78), (1.75, 76), (2.5, 81)]
ANSWER = [(0.0, 73), (0.5, 76), (1.0, 78), (1.75, 76), (2.5, 69)]  # resolved home


def timeline() -> tuple[dict[str, float], float]:
    tl = HERE / "narration" / "timeline.json"
    if tl.exists():
        d = json.loads(tl.read_text())
        starts = {s["id"]: s["start"] for s in d["scenes"]}
        total = d["scenes"][-1]["start"] + d["scenes"][-1]["duration"]
        return starts, total
    film = json.loads((HERE / "film" / "film.json").read_text())
    starts, t = {}, 0.0
    for s in film["scenes"]:
        starts[s["id"]] = t
        t += s["duration"]
    return starts, t


def add(buf: np.ndarray, at: float, y: np.ndarray, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i < 0 or i >= len(buf):
        return
    j = min(len(buf), i + len(y))
    buf[i:j] += y[: j - i] * gain


def main() -> None:
    starts, total = timeline()
    total += 1.5
    N = int(total * SR)
    mus = np.zeros(N)
    get = lambda k, d=0.0: starts.get(k, d)
    t_name = get("T1", 22)
    t_ring = get("T2", 50)
    t_hood = get("T3", 80)
    t_proof = get("S13", get("T3", 80) + 16)
    t_recap = get("T4", 100)
    t_close = get("S16", t_recap + 9)
    t_end = get("S17", total - 7)

    def energy(t: float) -> int:
        if t < t_name:
            return 1
        if t < t_ring:
            return 3
        if t < get("S9", t_ring + 11):
            return 2
        if t < t_hood:
            return 3
        if t < t_proof:
            return 2
        if t < t_recap:
            return 3
        if t < t_close:
            return 5
        return 2

    bars = int(total / BAR) + 1
    for b in range(bars):
        t0 = b * BAR
        e = energy(t0 + BAR / 2)
        ch = b % 4
        # pad always (warm bed), louder in recap, resolve chord on the end card
        notes = [57, 61, 64] if t0 >= t_end - BAR else CHORDS[ch]
        add(mus, t0, pad(notes, BAR + 1.0, vel=0.55 if e >= 5 else 0.42 if e >= 3 else 0.35))
        # kalimba motif: every other bar in the story, every bar after the name; answered (resolved) in the close
        mot = ANSWER if t0 >= t_close else MOTIF
        if e == 1 and b % 2 == 0 or e >= 2:
            for beat, n in mot:
                transpose = [0, -4, 0, -2][ch] if e >= 3 else 0
                add(mus, t0 + beat * BEAT, kalimba(n + transpose, vel=0.55 if e < 5 else 0.7))
        if e == 2 and t0 >= t_ring and t0 < get("S9", t_ring + 11):
            # the ring: a soft arpeggio counting coins
            for k in range(8):
                add(mus, t0 + k * BEAT / 2, kalimba(CHORDS[ch][k % 3] + 12, vel=0.3))
        # bass and shaker from the name on
        if e >= 2 and t0 >= t_name:
            add(mus, t0, bass(ROOTS[ch], BAR * 0.95, vel=0.45 if e < 5 else 0.6))
        if e >= 3:
            for beat in range(4):
                add(mus, t0 + beat * BEAT, shaker(0.5))
                add(mus, t0 + (beat + SWING) * BEAT, shaker(0.35))
        if e >= 5:
            for beat in (0, 2):
                add(mus, t0 + beat * BEAT, drum(0.55))

    # the drum on every signature turn, and a dip to near-silence one beat before the name
    for k in ("T1", "T2", "T3", "T4"):
        if k in starts:
            add(mus, starts[k] + 0.25, drum(0.85))
    dip_a, dip_b = int((t_name - BEAT) * SR), int(t_name * SR)
    if dip_a > 0:
        mus[dip_a:dip_b] *= np.linspace(1, 0.15, dip_b - dip_a)

    # 2 s fade in, 3 s fade out
    fi = int(2 * SR)
    mus[:fi] *= np.linspace(0, 1, fi)
    fo = int(3 * SR)
    mus[-fo:] *= np.linspace(1, 0, fo)

    # gentle saturation + normalise to -18 dBFS peak-ish (mix.py does the real loudness)
    mus = np.tanh(mus * 1.4) / 1.4
    mus = mus / (np.max(np.abs(mus)) + 1e-9) * 0.5
    stereo = np.stack([mus, np.roll(mus, int(0.011 * SR))], axis=1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(stereo, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"wrote {OUT} ({total:.1f}s)")


if __name__ == "__main__":
    main()
