"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { RobotStatus, CameraEvent } from "@/core/types"
import * as robotApi from "@/core/api/robot"

import { DEMO_MODE } from "@/core/demo/config"
import { robotDemoEngine } from "@/core/demo/robotDemoEngine"

interface UseRobotStatusReturn {
  robotStatus: RobotStatus | null
  cameraEvents: CameraEvent[]
  isLoading: boolean
  error: string | null
  isDetecting: boolean
  startDetection: () => Promise<boolean>
  stopDetection: () => Promise<boolean>
  captureSnapshot: () => Promise<string | null>
  refresh: () => Promise<void>
}

export function useRobotStatus(): UseRobotStatusReturn {
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null)
  const [cameraEvents, setCameraEvents] = useState<CameraEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

  /**
   * ============================
   * DEMO MODE
   * ============================
   */
  useEffect(() => {
    if (!DEMO_MODE) return

    // demo engine 시작
    robotDemoEngine.start()

    // 최초 스냅샷 반영
    const syncFromDemo = () => {
      const snapshot = robotDemoEngine.getSnapshot()
      setRobotStatus(snapshot.robotStatus)
      setCameraEvents(snapshot.cameraEvents)
      setIsDetecting(snapshot.isDetecting)
      setIsLoading(false)
      setError(null)
    }

    syncFromDemo()

    // 상태 변경 구독
    const unsubscribe = robotDemoEngine.subscribe(syncFromDemo)

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * ============================
   * REAL API MODE (미래용)
   * ============================
   */
  const fetchData = useCallback(async () => {
    if (DEMO_MODE) return

    try {
      setIsLoading(true)

      const [statusResponse, eventsResponse] = await Promise.all([
        robotApi.getRobotStatus(),
        robotApi.getCameraEvents(),
      ])

      if (statusResponse.success && statusResponse.data) {
        setRobotStatus(statusResponse.data)
        setIsDetecting(statusResponse.data.mode === "detecting")
      }

      if (eventsResponse.success && eventsResponse.data) {
        setCameraEvents(eventsResponse.data)
      }

      setError(null)
    } catch {
      setError("로봇 상태를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!DEMO_MODE) {
      fetchData()
    }
  }, [fetchData])

  /**
   * ============================
   * ACTIONS
   * ============================
   */
  const startDetection = useCallback(async (): Promise<boolean> => {
    if (DEMO_MODE) {
      robotDemoEngine.startDetection()
      setIsDetecting(true)
      return true
    }

    try {
      const response = await robotApi.startDetection()
      if (response.success) {
        setIsDetecting(true)
        return true
      }
      return false
    } catch {
      setError("탐지 시작에 실패했습니다.")
      return false
    }
  }, [])

  const stopDetection = useCallback(async (): Promise<boolean> => {
    if (DEMO_MODE) {
      robotDemoEngine.stopDetection()
      setIsDetecting(false)
      return true
    }

    try {
      const response = await robotApi.stopDetection()
      if (response.success) {
        setIsDetecting(false)
        return true
      }
      return false
    } catch {
      setError("탐지 중지에 실패했습니다.")
      return false
    }
  }, [])

  const captureSnapshot = useCallback(async (): Promise<string | null> => {
    if (DEMO_MODE) {
      robotDemoEngine.captureSnapshot()
      return "demo://snapshot"
    }

    try {
      const response = await robotApi.captureSnapshot()
      if (response.success && response.data) {
        return response.data.snapshotUrl
      }
      return null
    } catch {
      setError("스냅샷 촬영에 실패했습니다.")
      return null
    }
  }, [])

  const refresh = useCallback(async () => {
    if (DEMO_MODE) return
    await fetchData()
  }, [fetchData])

  return {
    robotStatus,
    cameraEvents,
    isLoading,
    error,
    isDetecting,
    startDetection,
    stopDetection,
    captureSnapshot,
    refresh,
  }
}
