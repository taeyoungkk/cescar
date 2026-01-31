"use client"

import { useCallback, useEffect, useState } from "react"
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

  const fetchCars = useCallback(async () => {
    setIsLoading(true)
    try {
      const cars = await getMyCars()
      setCarId(cars[0]?.carId ?? null)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? "차량 목록을 불러오는데 실패했습니다.")
      setCarId(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCars()
  }, [fetchCars])

  return { carId, setCarId, isLoading, error, refresh: fetchCars }
}
