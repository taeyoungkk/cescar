// hooks/useRobotStatus.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { CarStatus, CameraEvent } from "@/core/types"

import { DEMO_MODE } from "@/core/demo/config"
import { robotDemoEngine } from "@/core/demo/robotDemoEngine"

interface UseRobotStatusReturn {
  robotStatus: CarStatus | null
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
  const [robotStatus, setRobotStatus] = useState<CarStatus | null>(null)
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

    robotDemoEngine.start()

    const syncFromDemo = () => {
      const snapshot = robotDemoEngine.getSnapshot()

      // demoEngine이 예전 RobotStatus를 주는 구조라도,
      // 여기서는 CarStatus 형태로만 맞춰서 사용
      // (demoSummary처럼 x/y/heading/mode/isOnline/updatedAt 형태)
      setRobotStatus(snapshot.robotStatus as any)
      setCameraEvents(snapshot.cameraEvents as any)
      setIsDetecting(Boolean(snapshot.isDetecting))
      setIsLoading(false)
      setError(null)
    }

    syncFromDemo()
    const unsubscribe = robotDemoEngine.subscribe(syncFromDemo)

    return () => unsubscribe()
  }, [])

  /**
   * ============================
   * REAL MODE (현재 백엔드 API 없음 → 빌드/런타임 안전)
   * ============================
   */
  const fetchData = useCallback(async () => {
    if (DEMO_MODE) return
    // 현재 /api/robot 류 API를 제거했으니
    // 실서버에서는 빈 값 유지 (추후 car/status + events 연결 시 수정)
    setIsLoading(false)
    setRobotStatus(null)
    setCameraEvents([])
    setIsDetecting(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (!DEMO_MODE) fetchData()
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
    // REAL: 아직 API 없음
    setError("현재 REAL 모드에서는 탐지 제어 API가 연결되지 않았습니다.")
    return false
  }, [])

  const stopDetection = useCallback(async (): Promise<boolean> => {
    if (DEMO_MODE) {
      robotDemoEngine.stopDetection()
      setIsDetecting(false)
      return true
    }
    // REAL: 아직 API 없음
    setError("현재 REAL 모드에서는 탐지 제어 API가 연결되지 않았습니다.")
    return false
  }, [])

  const captureSnapshot = useCallback(async (): Promise<string | null> => {
    if (DEMO_MODE) {
      robotDemoEngine.captureSnapshot()
      return "demo://snapshot"
    }
    // REAL: 아직 API 없음
    setError("현재 REAL 모드에서는 스냅샷 API가 연결되지 않았습니다.")
    return null
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
