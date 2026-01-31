// hooks/useRecentDetections.ts
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { Detection, DetectionStats } from "@/core/types"
import * as detectionApi from "@/core/api/detection"

interface UseRecentDetectionsReturn {
  recentDetections: Detection[]
  stats: DetectionStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecentDetections(carId: number | null, limit: number = 5): UseRecentDetectionsReturn {
  const [recentDetections, setRecentDetections] = useState<Detection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DetectionStats | null>(null)

  const fallbackStats = useMemo<DetectionStats | null>(() => {
    const items = recentDetections
    if (!items.length) {
      return { todayCount: 0, weekCount: 0, falseAlarmRate: 0, lastDetectionTime: "-" }
    }

    const now = new Date()
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

    const todayCount = items.filter((d) => {
      if (!d.timestamp) return false
      const t = new Date(d.timestamp)
      return !Number.isNaN(t.getTime()) && isSameDay(t, now)
    }).length

    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekCount = items.filter((d) => {
      if (!d.timestamp) return false
      const t = new Date(d.timestamp)
      return !Number.isNaN(t.getTime()) && t >= weekAgo
    }).length

    const last = items[0]
    return {
      todayCount,
      weekCount,
      falseAlarmRate: 0,
      lastDetectionTime: last?.time ?? "-",
    }
  }, [recentDetections])

  const fetchData = useCallback(async () => {
    if (!carId) {
      setRecentDetections([])
      setStats(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const detectionsResponse = await detectionApi.getRecentDetections(carId, limit)
      const items = detectionsResponse.success && detectionsResponse.data ? detectionsResponse.data : []
      setRecentDetections(items)

      const latestTime = items[0]?.time ?? "-"
      const statsResponse = await detectionApi.getLatestLogStatistics(carId, latestTime)
      setStats(statsResponse.success ? statsResponse.data : null)
      setError(null)
    } catch {
      setError("?먯? ?곗씠?곕? 遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.")
    } finally {
      setIsLoading(false)
    }
  }, [carId, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    recentDetections,
    stats: stats ?? fallbackStats,
    isLoading,
    error,
    refresh: fetchData,
  }
}
