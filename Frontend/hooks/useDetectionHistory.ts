// hooks/useDetectionHistory.ts
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Detection, DetectionHistoryFilters, DetectionStats, DetectionStatus, DetectionType } from "@/core/types"
import * as detectionApi from "@/core/api/detection"

interface UseDetectionHistoryReturn {
  detections: Detection[]
  stats: DetectionStats | null
  selectedDetection: Detection | null
  filters: DetectionHistoryFilters
  logId: number | null
  useSearch: boolean
  isLoading: boolean
  error: string | null
  setFilters: (filters: DetectionHistoryFilters) => void
  clearFilters: () => void
  setLogId: (logId: number | null) => void
  setUseSearch: (useSearch: boolean) => void
  selectDetection: (detection: Detection | null) => void
  updateStatus: (id: string, status: DetectionStatus) => Promise<boolean>
  updateNotes: (id: string, notes: string) => Promise<boolean>
  deleteDetection: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

const toDate = (d: Date) => d.toISOString().slice(0, 10)

function getInitialFilters(): DetectionHistoryFilters {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)

  return {
    type: "all",
    status: "all",
    searchId: "",
    dateFrom: toDate(start),
    dateTo: toDate(end),
  }
}

export function useDetectionHistory(carId: number | null): UseDetectionHistoryReturn {
  const [allDetections, setAllDetections] = useState<Detection[]>([])
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [filters, setFiltersState] = useState<DetectionHistoryFilters>(() => getInitialFilters())
  const [logId, setLogId] = useState<number | null>(null)
  const [useSearch, setUseSearch] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statsOverride, setStatsOverride] = useState<DetectionStats | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)

  const filteredDetections = useMemo(() => {
    const items = allDetections
    return items.filter((d) => {
      if (filters.type && filters.type !== "all" && d.type !== filters.type) return false
      if (filters.status && filters.status !== "all" && d.status !== filters.status) return false
      if (filters.searchId && !d.id.includes(filters.searchId)) return false
      if (filters.dateFrom) {
        const from = new Date(`${filters.dateFrom}T00:00:00`)
        if (Number.isNaN(from.getTime()) || new Date(d.timestamp) < from) return false
      }
      if (filters.dateTo) {
        const to = new Date(`${filters.dateTo}T23:59:59`)
        if (Number.isNaN(to.getTime()) || new Date(d.timestamp) > to) return false
      }
      return true
    })
  }, [allDetections, filters])

  const computedStats = useMemo<DetectionStats>(() => {
    const items = filteredDetections
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

    const falseAlarmCount = items.filter((d) => d.status === "false_alarm").length
    const falseAlarmRate = items.length ? Math.round((falseAlarmCount / items.length) * 100) : 0

    const lastDetectionTime = items[0]?.timestamp
      ? new Date(items[0].timestamp).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "-"

    return { todayCount, weekCount, falseAlarmRate, lastDetectionTime }
  }, [filteredDetections])

  const stats = statsOverride ?? computedStats

  const mapLabel = (type?: DetectionType | "all") => {
    if (!type || type === "all") return undefined
    return type
  }

  const fetchData = useCallback(async () => {
    if (!carId) {
      setAllDetections([])
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
      if (useSearch) {
        const searchResponse = await detectionApi.searchDetections({
          startDate: filters.dateFrom,
          endDate: filters.dateTo,
          label: mapLabel(filters.type),
        })
        if (requestIdRef.current !== requestId) return
        setAllDetections(searchResponse.success && searchResponse.data ? searchResponse.data : [])
        setStatsOverride(null)
      } else if (logId) {
        const historyResponse = await detectionApi.getDetectionsByLog(logId, 50, carId ?? undefined)
        if (requestIdRef.current !== requestId) return
        setAllDetections(historyResponse.success && historyResponse.data ? historyResponse.data : [])
        const latestTime = historyResponse.success && historyResponse.data ? historyResponse.data[0]?.time : undefined
        const statsResponse = await detectionApi.getLogStatistics(logId, latestTime)
        if (requestIdRef.current !== requestId) return
        setStatsOverride(statsResponse.success ? statsResponse.data : null)
      } else {
        const historyResponse = await detectionApi.getDetectionHistory(carId)
        if (requestIdRef.current !== requestId) return
        setAllDetections(historyResponse.success && historyResponse.data ? historyResponse.data : [])
        setStatsOverride(null)
      }
      if (requestIdRef.current !== requestId) return
      setError(null)
    } catch {
      if (requestIdRef.current !== requestId) return
      setError("감지 내역을 불러오지 못했습니다.")
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
  }, [carId, filters.dateFrom, filters.dateTo, filters.type, logId, online, useSearch])

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

  useEffect(() => {
    if (!selectedDetection) return
    const exists = filteredDetections.some((d) => d.id === selectedDetection.id)
    if (!exists) setSelectedDetection(null)
  }, [filteredDetections, selectedDetection])

  const setFilters = useCallback((newFilters: DetectionHistoryFilters) => {
    setFiltersState(newFilters)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(getInitialFilters())
  }, [])

  const selectDetection = useCallback((detection: Detection | null) => {
    setSelectedDetection(detection)
  }, [])

  const updateStatus = useCallback(
    async (id: string, status: DetectionStatus): Promise<boolean> => {
      try {
        const response = await detectionApi.updateDetectionStatus(id, status)
        if (!response.success) return false

        setAllDetections((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
        if (selectedDetection?.id === id) setSelectedDetection({ ...selectedDetection, status })
        return true
      } catch {
        setError("상태 변경에 실패했습니다.")
        return false
      }
    },
    [selectedDetection]
  )

  const updateNotes = useCallback(
    async (id: string, notes: string): Promise<boolean> => {
      try {
        const response = await detectionApi.updateDetectionNotes(id, notes)
        if (!response.success) return false

        setAllDetections((prev) => prev.map((d) => (d.id === id ? { ...d, notes } : d)))
        if (selectedDetection?.id === id) setSelectedDetection({ ...selectedDetection, notes })
        return true
      } catch {
        setError("메모 업데이트에 실패했습니다.")
        return false
      }
    },
    [selectedDetection]
  )

  const deleteDetection = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await detectionApi.deleteDetection(id)
        if (!response.success) return false
        setAllDetections((prev) => prev.filter((d) => String(d.id) !== String(id)))
        if (selectedDetection?.id && String(selectedDetection.id) === String(id)) setSelectedDetection(null)
        return true
      } catch {
        setError("감지 내역 삭제에 실패했습니다.")
        return false
      }
    },
    [selectedDetection]
  )

  return {
    detections: filteredDetections,
    stats,
    selectedDetection,
    filters,
    logId,
    useSearch,
    isLoading,
    error,
    setFilters,
    clearFilters,
    setLogId,
    setUseSearch,
    selectDetection,
    updateStatus,
    updateNotes,
    deleteDetection,
    refresh: fetchData,
  }
}

