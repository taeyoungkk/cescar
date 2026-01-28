"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CarStatus } from "@/core/types"
import * as carApi from "@/core/api/car"

type Options = {
  enabled?: boolean
  intervalMs?: number
}

export function useCarStatus(carId: number, options: Options = {}) {
  const { enabled = true, intervalMs = 1000 } = options

  const [data, setData] = useState<CarStatus | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)

  const fetchOnce = useCallback(async () => {
    try {
      const res = await carApi.getCarStatus(carId)
      setData(res)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? e?.toString?.() ?? "차량 상태를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [carId])

  useEffect(() => {
    // cleanup 먼저
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null

    if (!enabled) {
      setIsLoading(false)
      setData(null)
      setError(null)
      return
    }

    setIsLoading(true)
    fetchOnce()

    timerRef.current = window.setInterval(fetchOnce, intervalMs)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [enabled, fetchOnce, intervalMs])

  return { data, isLoading, error, refresh: fetchOnce }
}
