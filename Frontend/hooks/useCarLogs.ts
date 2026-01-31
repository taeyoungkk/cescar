// hooks/useCarLogs.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import * as detectionApi from "@/core/api/detection"

export interface CarLogSummary {
  id: number
  mapId: number | null
  startAt: string
  endAt: string | null
  status: string
  detectionCount: number
}

interface UseCarLogsReturn {
  logs: CarLogSummary[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCarLogs(carId: number | null): UseCarLogsReturn {
  const [logs, setLogs] = useState<CarLogSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!carId) {
      setLogs([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const response = await detectionApi.getCarLogs(carId)
      setLogs(response.success && response.data ? response.data : [])
      setError(null)
    } catch {
      setError("운행 기록을 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [carId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return { logs, isLoading, error, refresh: fetchLogs }
}
