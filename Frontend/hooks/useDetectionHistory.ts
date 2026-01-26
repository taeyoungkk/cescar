"use client"

import { useState, useEffect, useCallback } from "react"
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

const initialFilters: DetectionHistoryFilters = {
  type: "all",
  status: "all",
  searchId: "",
}

export function useDetectionHistory(): UseDetectionHistoryReturn {
  const [detections, setDetections] = useState<Detection[]>([])
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [filters, setFiltersState] = useState<DetectionHistoryFilters>(initialFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [historyResponse, statsResponse] = await Promise.all([
        detectionApi.getDetectionHistory(filters),
        detectionApi.getDetectionStats(),
      ])

      if (historyResponse.success && historyResponse.data) {
        setDetections(historyResponse.data)
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data)
      }

      setError(null)
    } catch {
      setError("탐지 기록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setFilters = useCallback((newFilters: DetectionHistoryFilters) => {
    setFiltersState(newFilters)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(initialFilters)
  }, [])

  const selectDetection = useCallback((detection: Detection | null) => {
    setSelectedDetection(detection)
  }, [])

  const updateStatus = useCallback(async (id: string, status: DetectionStatus): Promise<boolean> => {
    try {
      const response = await detectionApi.updateDetectionStatus(id, status)
      if (response.success && response.data) {
        setDetections((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status } : d))
        )
        if (selectedDetection?.id === id) {
          setSelectedDetection({ ...selectedDetection, status })
        }
        return true
      }
      return false
    } catch {
      setError("상태 업데이트에 실패했습니다.")
      return false
    }
  }, [selectedDetection])

  const updateNotes = useCallback(async (id: string, notes: string): Promise<boolean> => {
    try {
      const response = await detectionApi.updateDetectionNotes(id, notes)
      if (response.success && response.data) {
        setDetections((prev) =>
          prev.map((d) => (d.id === id ? { ...d, notes } : d))
        )
        if (selectedDetection?.id === id) {
          setSelectedDetection({ ...selectedDetection, notes })
        }
        return true
      }
      return false
    } catch {
      setError("메모 업데이트에 실패했습니다.")
      return false
    }
  }, [selectedDetection])

  return {
    detections,
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
