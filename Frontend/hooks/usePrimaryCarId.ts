"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getMyCars } from "@/core/api/car"

interface UsePrimaryCarIdReturn {
  carId: number | null
  setCarId: (carId: number | null) => void
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePrimaryCarId(): UsePrimaryCarIdReturn {
  const [carId, setCarId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)

  const fetchCars = useCallback(async () => {
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
      const cars = await getMyCars()
      if (requestIdRef.current !== requestId) return
      setCarId(cars[0]?.carId ?? null)
      setError(null)
    } catch (e: any) {
      if (requestIdRef.current !== requestId) return
      setError("\uCC28\uB7C9 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.")
      setCarId(null)
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
      inFlightRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        fetchCars()
      }
    }
  }, [online])

  useEffect(() => {
    fetchCars()
  }, [fetchCars])

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
    if (online) fetchCars()
  }, [online, fetchCars])

  return { carId, setCarId, isLoading, error, refresh: fetchCars }
}
