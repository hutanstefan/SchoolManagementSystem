import { useEffect, useState, type ReactNode } from 'react'
import { storage } from '@/lib/storage'
import { ThemeContext, type Theme } from './theme-context'

const THEME_KEY = 'sms.theme'

/** Light / dark / system theme, remembered in localStorage. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (storage.get(THEME_KEY) as Theme | null) ?? 'system',
  )

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', dark)
    }
    apply()

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const setTheme = (next: Theme) => {
    storage.set(THEME_KEY, next)
    setThemeState(next)
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}
