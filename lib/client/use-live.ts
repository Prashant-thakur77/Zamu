'use client'

import { useEffect, useRef } from 'react'

const FAST_MS = 3_000
const MAX_MS = 15_000

/**
 * Poll a cheap version token and refetch only when it changes. Stops while the
 * app is in the background and snaps back to fast when something moves.
 */
export function useLiveVersion({
  fetchVersion,
  enabled,
  onChange,
}: {
  fetchVersion: () => Promise<{ version: string }>
  enabled: boolean
  onChange: () => void | Promise<void>
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const fetchRef = useRef(fetchVersion)
  fetchRef.current = fetchVersion

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = FAST_MS
    let last: string | null = null

    const poll = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const { version } = await fetchRef.current()
        if (last === null) last = version
        else if (version !== last) {
          last = version
          delay = FAST_MS
          await onChangeRef.current()
        } else delay = Math.min(delay * 1.5, MAX_MS)
      } catch {
        delay = Math.min(delay * 2, MAX_MS)
      }
      if (!cancelled) {
        clearTimeout(timer)
        timer = setTimeout(() => void poll(), delay)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        delay = FAST_MS
        void poll()
      } else clearTimeout(timer)
    }
    timer = setTimeout(() => void poll(), FAST_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
}
