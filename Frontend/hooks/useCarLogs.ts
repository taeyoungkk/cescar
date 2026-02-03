// hooks/useCarLogs.ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as detectionApi from "@/core/api/detection"

export interface CarLogSummary {
  id: number
  mapId: number | null
  mapName?: string | null
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
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)

  const fetchLogs = useCallback(async () => {
    if (!carId) {
      setLogs([])
      setIsLoading(false)
      return
    }
    if (!online) {
      setIsLoading(false)
      setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
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
      const response = await detectionApi.getCarLogs(carId)
      if (requestIdRef.current !== requestId) return
      setLogs(response.success && response.data ? response.data : [])
      setError(null)
    } catch {
      if (requestIdRef.current !== requestId) return
      setError("\uC6B4\uD589 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.")
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
      inFlightRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        fetchLogs()
      }
    }
  }, [carId, online])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

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
    if (online) fetchLogs()
  }, [online, fetchLogs])

  return { logs, isLoading, error, refresh: fetchLogs }
}
