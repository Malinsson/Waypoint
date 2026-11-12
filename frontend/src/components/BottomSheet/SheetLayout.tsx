import { useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './SheetLayout.module.css'

type SheetLayoutProps = {
  // Layout for wide screens, where the map and the panel sit side by side
  className?: string
  children: ReactNode
}

// Wraps a MapView and a BottomSheet. On phones it becomes one full-screen
// area: the map fills it and the sheet slides over it.
function SheetLayout({ className = '', children }: SheetLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null)

  // The area must end exactly where the fixed bottom nav begins. Guessing the
  // header height is not reliable (fonts, login state), and if the area is too
  // tall its bottom edge, and the sheet's handle, end up hidden behind the nav.
  // So the real distance from the top of the page is measured.
  useLayoutEffect(() => {
    const layout = layoutRef.current
    if (!layout) return

    const measure = () => {
      const topInPage = layout.getBoundingClientRect().top + window.scrollY
      layout.style.setProperty('--layout-top', `${topInPage}px`)
    }
    measure()

    // The page grows or shrinks when the header or content changes
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  return <div ref={layoutRef} className={`${styles.layout} ${className}`}>{children}</div>
}

export default SheetLayout
