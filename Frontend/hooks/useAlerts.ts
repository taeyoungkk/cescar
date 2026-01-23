"use client"

import { useState, useEffect, useCallback } from "react"
import type { SystemAlert } from "@/core/types"
import * as robotApi from "@/core/api/robot"

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
    try {
      const response = await robotApi.getAlerts()
      if (response.success && response.data) {
        setAlerts(response.data)
      }
      setError(null)
    } catch {
      setError("알림을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const markAsRead = useCallback(async (alertId: string) => {
    try {
      const response = await robotApi.markAlertAsRead(alertId)
      if (response.success) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === alertId ? { ...alert, isRead: true } : alert
          )
        )
      }
    } catch {
      setError("알림 읽음 처리에 실패했습니다.")
    }
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
