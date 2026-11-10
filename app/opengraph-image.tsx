import { ImageResponse } from 'next/og'

export const alt = 'Zamu: your chama, paid straight to M-Pesa'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The share card: the ring of seats with the lit turn, and the one-line pitch. */
export default function OpengraphImage() {
  const seats = 8
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f3ecdf', color: '#1d1712', padding: 72, alignItems: 'center', gap: 64 }}>
        <div style={{ position: 'relative', width: 400, height: 400, display: 'flex' }}>
          {Array.from({ length: seats }, (_, i) => {
            const a = (i / seats) * Math.PI * 2 - Math.PI / 2
            const on = i === 0
            const r = on ? 48 : 30
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 200 + Math.cos(a) * 150 - r,
                  top: 200 + Math.sin(a) * 150 - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: 999,
                  background: on ? '#f0ac16' : i % 3 === 1 ? '#dcefd9' : '#fbf7ef',
                  border: `5px solid ${on ? '#1d1712' : i % 3 === 1 ? '#127a3a' : '#d6c8b1'}`,
                }}
              />
            )
          })}
          <div style={{ position: 'absolute', left: 0, top: 172, width: 400, display: 'flex', justifyContent: 'center', fontSize: 44, fontWeight: 900 }}>KSh 5,000</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>zamu</div>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 0.95, letterSpacing: -3, marginTop: 16 }}>Your chama, paid straight to M-Pesa.</div>
          <div style={{ fontSize: 30, color: '#5a4e42', marginTop: 24 }}>Runs inside Nimiq Pay. No treasurer.</div>
        </div>
      </div>
    ),
    size,
  )
}
