"use client"

import { useState, useEffect, useCallback } from "react"

export type Theme = "light" | "dark"

const THEME_STORAGE_KEY = "cescar_theme"
const DEFAULT_THEME: Theme = "dark"

interface UseThemeReturn {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  isDark: boolean
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME
}

function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme()
    setThemeState(storedTheme)
    applyTheme(storedTheme)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }, [theme, setTheme])

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === "dark",
  }
}
