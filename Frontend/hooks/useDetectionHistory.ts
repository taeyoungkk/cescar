// hooks/useDetectionHistory.ts
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { Detection, DetectionHistoryFilters, DetectionStats, DetectionStatus } from "@/core/types"
import * as detectionApi from "@/core/api/detection"

interface UseDetectionHistoryReturn {
  detections: Detection[]
  stats: DetectionStats | null
  selectedDetection: Detection | null
  filters: DetectionHistoryFilters
  isLoading: boolean
  error: string | null
  setFilters: (filters: DetectionHistoryFilters) => void
  clearFilters: () => void
  selectDetection: (detection: Detection | null) => void
  updateStatus: (id: string, status: DetectionStatus) => Promise<boolean>
  updateNotes: (id: string, notes: string) => Promise<boolean>
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const stats = useMemo<DetectionStats>(() => {
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
      ? new Date(items[0].timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : "-"

    return { todayCount, weekCount, falseAlarmRate, lastDetectionTime }
  }, [filteredDetections])

  const fetchData = useCallback(async () => {
    if (!carId) {
      setAllDetections([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const historyResponse = await detectionApi.getDetectionHistory(carId)
      setAllDetections(historyResponse.success && historyResponse.data ? historyResponse.data : [])
      setError(null)
    } catch {
      setError("탐지 기록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [carId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 선택: 필터/재조회로 목록이 바뀌면, 선택 항목이 사라진 경우 정리
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
        setError("상태 업데이트에 실패했습니다.")
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

  return {
    detections: filteredDetections,
    stats,
    selectedDetection,
    filters,
    isLoading,
    error,
    setFilters,
    clearFilters,
    selectDetection,
    updateStatus,
    updateNotes,
    refresh: fetchData,
  }
}
