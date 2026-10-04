'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Lenis from 'lenis'

import 'lenis/dist/lenis.css'

/* -------------------------------------------------------------------------- */
/*  Instance store                                                             */
/*  Lenis instance ko bahar se bhi access karna ho (eg. nav ka scroll-aware     */
/*  behaviour, drawer band karte waqt list top pe le jaana) to useSyncExternal  */
/*  Store ke through share karte hain — isse provider ke andar setState ki     */
/*  zaroorat nahi padti.                                                       */
/* -------------------------------------------------------------------------- */

let instance: Lenis | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return instance
}

function getServerSnapshot() {
  return null
}

/** Currently mounted Lenis instance (client components only). */
export function useLenis() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/* -------------------------------------------------------------------------- */
/*  Scroll lock sync                                                           */
/*  Sheet / Drawer / Dialog (Base UI) modal open karte hi html/body pe inline   */
/*  `overflow: hidden` laga dete hain. Us dauraan Lenis ko rok dete hain,      */
/*  warna modal ke peeche page scroll hota rehta hai.                           */
/* -------------------------------------------------------------------------- */

function isPageScrollLocked() {
  const html = document.documentElement
  const body = document.body

  // Base UI apna lock signal yahan deta hai
  if (html.hasAttribute('data-base-ui-scroll-locked')) return true

  // Sirf INLINE styles check karo — Lenis ka `lenis-stopped` class CSS se
  // overflow set karta hai, use galti se "locked" na samjhein
  return (
    html.style.overflowY === 'hidden' ||
    html.style.overflowY === 'clip' ||
    body.style.overflowY === 'hidden' ||
    body.style.overflowY === 'clip'
  )
}

function watchScrollLock(lenis: Lenis) {
  let locked = isPageScrollLocked()

  const sync = () => {
    const next = isPageScrollLocked()
    if (next === locked) return
    locked = next
    if (locked) lenis.stop()
    else lenis.start()
  }

  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'data-base-ui-scroll-locked'],
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })

  sync()

  return () => {
    observer.disconnect()
    lenis.start()
  }
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                   */
/* -------------------------------------------------------------------------- */

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const lenis = new Lenis({
      // Lenis apna RAF loop khud chalata hai — alag loop likhne ki zaroorat nahi
      autoRaf: true,

      // Feel: chhota lerp = tight & weighty, bada lerp = floaty
      lerp: 0.1,

      // Trackpad / mouse wheel ko 1:1 rakho
      wheelMultiplier: 1,

      // Mobile pe native inertia off karke Lenis ka hi smooth inertia use karo
      syncTouch: true,
      syncTouchLerp: 0.08,

      // Andar ke scrollable boxes (tables, chat list, sidebar) ko apna native
      // scroll karne do — page ko hijack mat karo
      allowNestedScroll: true,

      // Internal link click karte hi chal raha inertia rok do
      stopInertiaOnNavigate: true,

      // Browser ka prefers-reduced-motion khud respect hota hai (default true)
      respectReducedMotion: true,
    })

    const unwatch = watchScrollLock(lenis)

    instance = lenis
    emit()

    return () => {
      unwatch()
      lenis.destroy()
      if (instance === lenis) instance = null
      emit()
    }
  }, [])

  return <>{children}</>
}