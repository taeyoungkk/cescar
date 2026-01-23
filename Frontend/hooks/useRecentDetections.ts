"use client"

import { useState, useEffect, useCallback } from "react"
import type { Detection, DetectionStats } from "@/core/types"
import * as detectionApi from "@/core/api/detection"

interface UseRecentDetectionsReturn {
  recentDetections: Detection[]
  stats: DetectionStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecentDetections(limit: number = 5): UseRecentDetectionsReturn {
  const [recentDetections, setRecentDetections] = useState<Detection[]>([])
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [detectionsResponse, statsResponse] = await Promise.all([
        detectionApi.getRecentDetections(limit),
        detectionApi.getDetectionStats(),
      ])

      if (detectionsResponse.success && detectionsResponse.data) {
        setRecentDetections(detectionsResponse.data)
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data)
      }

      setError(null)
    } catch {
      setError("탐지 데이터를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    recentDetections,
    stats,
    isLoading,
    error,
    refresh: fetchData,
  }
}
