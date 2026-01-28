// hooks/useAlerts.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { SystemAlert } from "@/core/types"

interface UseAlertsReturn {
  alerts: SystemAlert[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  markAsRead: (alertId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useAlerts(): UseAlertsReturn {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = alerts.filter((a) => !a.isRead).length

  const fetchAlerts = useCallback(async () => {
    // 현재 robot alerts API 제거 상태이므로
    // UI는 "알림 없음"으로 두고 빌드만 안전하게 통과시킴
    setIsLoading(true)
    setAlerts([])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const markAsRead = useCallback(async (alertId: string) => {
    // 현재 서버 연동 없으니 로컬에서만 처리(선택사항)
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)))
  }, [])

  return {
    alerts,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    refresh: fetchAlerts,
  }
}
