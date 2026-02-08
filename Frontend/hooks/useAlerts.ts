// hooks/useAlerts.ts
"use client"

import { useEffect, useMemo, useCallback } from "react"
import type { SystemAlert } from "@/core/types"
import { useAlertsStore } from "@/hooks/useAlertsStore"

interface UseAlertsReturn {
  alerts: SystemAlert[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  markAsRead: (alertId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refresh: () => Promise<void>
  setExternalAlerts: (alerts: SystemAlert[]) => void
}

function mergeAlerts(base: SystemAlert[], extra: SystemAlert[]) {
  const map = new Map<string, SystemAlert>()
  for (const a of extra) map.set(a.id, a)
  for (const a of base) map.set(a.id, a)
  return Array.from(map.values())
}

export function useAlerts(): UseAlertsReturn {
  const baseAlerts = useAlertsStore((s) => s.baseAlerts)
  const externalAlerts = useAlertsStore((s) => s.externalAlerts)
  const isLoading = useAlertsStore((s) => s.isLoading)
  const error = useAlertsStore((s) => s.error)
  const setBaseAlerts = useAlertsStore((s) => s.setBaseAlerts)
  const setExternalAlerts = useAlertsStore((s) => s.setExternalAlerts)
  const markAsReadLocal = useAlertsStore((s) => s.markAsRead)
  const markAllAsReadLocal = useAlertsStore((s) => s.markAllAsRead)
  const setLoading = useAlertsStore((s) => s.setLoading)
  const setError = useAlertsStore((s) => s.setError)

  const alerts = useMemo(() => mergeAlerts(baseAlerts, externalAlerts), [baseAlerts, externalAlerts])
  const unreadCount = alerts.filter((a) => !a.isRead).length

  const fetchAlerts = useCallback(async () => {
    // 현재 alerts API 없음 → baseAlerts는 빈 배열
    setLoading(true)
    setBaseAlerts([])
    setError(null)
    setLoading(false)
  }, [setBaseAlerts, setError, setLoading])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const markAsRead = useCallback(async (alertId: string) => {
    markAsReadLocal(alertId)
  }, [markAsReadLocal])

  const markAllAsRead = useCallback(async () => {
    markAllAsReadLocal()
  }, [markAllAsReadLocal])

  return {
    alerts,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: fetchAlerts,
    setExternalAlerts,
  }
}
