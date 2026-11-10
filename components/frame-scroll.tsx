'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/** On desktop the app frame scrolls on its own; start each new screen at the top, as a phone would. */
export function FrameScroll() {
  const path = usePathname()
  useEffect(() => {
    document.getElementById('app-scroll')?.scrollTo({ top: 0 })
  }, [path])
  return null
}
