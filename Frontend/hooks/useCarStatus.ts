// hooks/useCarStatus.ts
"use client"

import { useEffect } from "react"
import { useCarStatusStore } from "@/hooks/useCarStatusStore"

type Options = { enabled?: boolean; intervalMs?: number }

export function useCarStatus(carId: number, options: Options = {}) {
  const { enabled = true, intervalMs = 1000 } = options

  const data = useCarStatusStore((s) => s.data)
  const error = useCarStatusStore((s) => s.error)
  const isLoading = useCarStatusStore((s) => s.isLoading)
  const refreshNow = useCarStatusStore((s) => s.refreshNow)
  const start = useCarStatusStore((s) => s.start)

  useEffect(() => {
    if (!enabled) return
    const detach = start(carId, intervalMs)
    return detach
  }, [enabled, carId, intervalMs, start])

  return { data, error, isLoading, refresh: refreshNow }
}
