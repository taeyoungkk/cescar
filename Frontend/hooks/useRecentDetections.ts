// hooks/useRecentDetections.ts
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Detection, DetectionStats } from "@/core/types"
import * as detectionApi from "@/core/api/detection"
import { getKstNow, parseBackendDate } from "@/lib/date"

interface UseRecentDetectionsReturn {
  recentDetections: Detection[]
  stats: DetectionStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecentDetections(
  carId: number | null,
  limit: number = 5,
  mapId?: number | null
): UseRecentDetectionsReturn {
  const [recentDetections, setRecentDetections] = useState<Detection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)

  const fallbackStats = useMemo<DetectionStats | null>(() => {
    const items = recentDetections
    if (!items.length) {
      return { todayCount: 0, weekCount: 0, falseAlarmRate: 0, lastDetectionTime: "-" }
    }

    const now = getKstNow()
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

    const todayCount = items.filter((d) => {
      if (!d.timestamp) return false
      const t = parseBackendDate(d.timestamp)
      if (!t) return false
      return !Number.isNaN(t.getTime()) && isSameDay(t, now)
    }).length

    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekCount = items.filter((d) => {
      if (!d.timestamp) return false
      const t = parseBackendDate(d.timestamp)
      return !!t && !Number.isNaN(t.getTime()) && t >= weekAgo
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
    if (!online) {
      setIsLoading(false)
      setError("오프라인 상태입니다.")
      return
    }

    if (inFlightRef.current) {
      queuedRef.current = true
      return
    }

    inFlightRef.current = true
    const requestId = ++requestIdRef.current

    setIsLoading(true)
    try {
      if (mapId) {
        const logsResponse = await detectionApi.getCarLogs(carId, 50)
        if (requestIdRef.current !== requestId) return
        const logs = logsResponse.success && logsResponse.data ? logsResponse.data : []
        const targetLog = logs.find((log) => log.mapId === mapId)
        if (!targetLog) {
          setRecentDetections([])
          setStats(null)
          setError(null)
          return
        }
        const detectionsResponse = await detectionApi.getDetectionsByLog(targetLog.id, limit, carId)
        const items = detectionsResponse.success && detectionsResponse.data ? detectionsResponse.data : []
        if (requestIdRef.current !== requestId) return
        setRecentDetections(items)

        const latestTime = items[0]?.timestamp ?? items[0]?.time ?? "-"
        const statsResponse = await detectionApi.getLogStatistics(targetLog.id, latestTime)
        if (requestIdRef.current !== requestId) return
        setStats(statsResponse.success ? statsResponse.data : null)
      } else {
        const detectionsResponse = await detectionApi.getRecentDetections(carId, limit)
        const items = detectionsResponse.success && detectionsResponse.data ? detectionsResponse.data : []
        if (requestIdRef.current !== requestId) return
        setRecentDetections(items)

        const latestTime = items[0]?.timestamp ?? items[0]?.time ?? "-"
        const statsResponse = await detectionApi.getLatestLogStatistics(carId, latestTime)
        if (requestIdRef.current !== requestId) return
        setStats(statsResponse.success ? statsResponse.data : null)
      }
      setError(null)
    } catch {
      if (requestIdRef.current !== requestId) return
      setError("최근 감지 내역을 불러오지 못했습니다.")
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
      inFlightRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        fetchData()
      }
    }
  }, [carId, limit, mapId, online])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    if (online) fetchData()
  }, [online, fetchData])

  return {
    recentDetections,
    stats: stats ?? fallbackStats,
    isLoading,
    error,
    refresh: fetchData,
  }
}

