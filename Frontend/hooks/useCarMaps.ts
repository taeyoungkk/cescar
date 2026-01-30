"use client"

import { useCallback, useEffect, useState } from "react"
import type { CarMap } from "@/core/types"
import * as mapApi from "@/core/api/map"

interface UseCarMapsReturn {
  maps: CarMap[]
  currentMap: CarMap | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  selectMap: (mapId: number) => Promise<boolean>
  deleteMap: (mapId: number) => Promise<boolean>
}

export function useCarMaps(carId: number | null): UseCarMapsReturn {
  const [maps, setMaps] = useState<CarMap[]>([])
  const [currentMap, setCurrentMap] = useState<CarMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!carId) {
      setMaps([])
      setCurrentMap(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [list, current] = await Promise.all([mapApi.getMaps(carId), mapApi.getCurrentMap(carId)])
      setMaps(list)
      setCurrentMap(current ?? null)
      setError(null)
    } catch {
      setError("지도 정보를 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [carId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectMap = useCallback(
    async (mapId: number) => {
      if (!carId) return false
      await mapApi.setCurrentMap(carId, mapId)
      await refresh()
      return true
    },
    [carId, refresh]
  )

  const deleteMap = useCallback(
    async (mapId: number) => {
      if (!carId) return false
      await mapApi.deleteMap(carId, mapId)
      await refresh()
      return true
    },
    [carId, refresh]
  )

  return {
    maps,
    currentMap,
    isLoading,
    error,
    refresh,
    selectMap,
    deleteMap,
  }
}
