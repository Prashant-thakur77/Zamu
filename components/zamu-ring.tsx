'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The Zamu ring: the chama around a table. The lit seat is whoever's turn it
 * is (zamu). When a share is delivered, a coin travels from the payer's seat
 * to the lit seat and a green chord stays drawn between them. When the turn
 * passes, the whole ring turns until the next seat is at the top.
 */

export type SeatState = 'recipient' | 'paid' | 'paying' | 'checking' | 'failed' | 'unpaid'

export interface Seat {
  id: string
  name: string
  state: SeatState
  you?: boolean
}

const SIZE = 300
const C = SIZE / 2
const R = 116

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function ZamuRing({
  seats,
  recipientIndex,
  children,
  label,
}: {
  seats: Seat[]
  recipientIndex: number
  children?: ReactNode
  label: string
}) {
  const n = Math.max(seats.length, 2)
  const step = 360 / n
  // Keep the recipient at 12 o'clock. Accumulate so the ring always turns forward.
  const [rotation, setRotation] = useState(-recipientIndex * step)
  const lastRecipient = useRef(recipientIndex)
  useEffect(() => {
    if (recipientIndex === lastRecipient.current) return
    const forward = ((recipientIndex - lastRecipient.current + n) % n) * step
    lastRecipient.current = recipientIndex
    setRotation((r) => r - forward)
  }, [recipientIndex, n, step])

  const pos = (i: number) => {
    const a = ((i * step) * Math.PI) / 180 - Math.PI / 2
    return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R }
  }
  const target = pos(recipientIndex)

  // Coins for seats that just turned paid.
  const prev = useRef<Record<string, SeatState>>({})
  const [coins, setCoins] = useState<{ key: string; from: { x: number; y: number } }[]>([])
  useEffect(() => {
    const fresh: { key: string; from: { x: number; y: number } }[] = []
    seats.forEach((s, i) => {
      const before = prev.current[s.id]
      if (before && before !== 'paid' && s.state === 'paid') fresh.push({ key: `${s.id}-${Date.now()}`, from: pos(i) })
      prev.current[s.id] = s.state
    })
    if (fresh.length && !reducedMotion()) setCoins((c) => [...c, ...fresh])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full overflow-visible">
        {/* the table */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--rule)" strokeWidth="1.5" strokeDasharray="2 6" />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transition: 'transform var(--t-turn) var(--ease-turn)',
          }}
        >
          {seats.map((s, i) => {
            if (s.state !== 'paid') return null
            const p = pos(i)
            return (
              <line
                key={`chord-${s.id}`}
                x1={p.x}
                y1={p.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--leaf)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.55"
              />
            )
          })}
          {coins.map((c) => (
            <Coin key={c.key} from={c.from} to={target} onDone={() => setCoins((all) => all.filter((x) => x.key !== c.key))} />
          ))}
          {seats.map((s, i) => {
            const p = pos(i)
            const turn = s.state === 'recipient'
            const fill =
              turn ? 'var(--sun)' : s.state === 'paid' ? 'var(--leaf-bg)' : s.state === 'failed' ? 'var(--clay-bg)' : 'var(--card)'
            const stroke =
              turn ? 'var(--ink)' : s.state === 'paid' ? 'var(--leaf)' : s.state === 'failed' ? 'var(--clay)' : s.state === 'checking' ? 'var(--sun)' : s.state === 'paying' ? 'var(--ink)' : 'var(--rule)'
            const r = turn ? 27 : 20
            return (
              <g
                key={s.id}
                style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${p.x}px ${p.y}px`, transition: 'transform var(--t-turn) var(--ease-turn)' }}
              >
                {turn && (
                  <circle cx={p.x} cy={p.y} r={r + 7} fill="none" stroke="var(--sun)" strokeWidth="2" opacity="0.5">
                    <animate attributeName="r" values={`${r + 3};${r + 12};${r + 3}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={turn || s.you ? 2.5 : 1.75} strokeDasharray={s.state === 'paying' || s.state === 'checking' ? '5 4' : undefined} />
                <text
                  x={p.x}
                  y={p.y + (turn ? 6 : 4.5)}
                  textAnchor="middle"
                  className="font-display"
                  fontWeight="800"
                  fontSize={turn ? 17 : 13}
                  fill={turn ? '#1d1712' : s.state === 'paid' ? 'var(--leaf)' : s.state === 'failed' ? 'var(--clay)' : 'var(--ink)'}
                >
                  {initials(s.name)}
                </text>
                {s.state === 'paid' && (
                  <g>
                    <circle cx={p.x + 14} cy={p.y - 14} r="8" fill="var(--leaf)" />
                    <path d={`M${p.x + 10.5} ${p.y - 14} l2.6 2.6 l4.6 -5`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </g>
                )}
                {s.you && !turn && (
                  <text x={p.x} y={p.y + r + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink-2)">
                    YOU
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="absolute inset-[26%] flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

function Coin({ from, to, onDone }: { from: { x: number; y: number }; to: { x: number; y: number }; onDone: () => void }) {
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const dx = to.x - from.x
    const dy = to.y - from.y
    const anim = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.4)', opacity: 0 },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.12}px) scale(1.15)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 1, offset: 0.92 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', fill: 'forwards' },
    )
    anim.onfinish = onDone
    return () => anim.cancel()
  }, [from, to, onDone])
  return (
    <g ref={ref} style={{ transformBox: 'fill-box' }}>
      <circle cx={from.x} cy={from.y} r="9" fill="var(--leaf-bright)" stroke="var(--leaf)" strokeWidth="2" />
      <text x={from.x} y={from.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">
        K
      </text>
    </g>
  )
}
