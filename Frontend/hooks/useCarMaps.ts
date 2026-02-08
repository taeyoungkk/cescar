"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  generateMap: (name?: string) => Promise<boolean>
  createMap: (payload: {
    name: string
    imageUrl: string
    width: number
    height: number
    resolution: number
    originX: number
    originY: number
  }) => Promise<CarMap | null>
  renameMap: (mapId: number, name: string) => Promise<boolean>
}

export function useCarMaps(carId: number | null): UseCarMapsReturn {
  const [maps, setMaps] = useState<CarMap[]>([])
  const [currentMap, setCurrentMap] = useState<CarMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!carId) {
      setMaps([])
      setCurrentMap(null)
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
      const [list, current] = await Promise.all([mapApi.getMaps(carId), mapApi.getCurrentMap(carId)])
      if (requestIdRef.current !== requestId) return
      setMaps(list)
      setCurrentMap(current ?? null)
      setError(null)
    } catch {
      if (requestIdRef.current !== requestId) return
      setError("\uC9C0\uB3C4 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.")
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
      inFlightRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        refresh()
      }
    }
  }, [carId, online])

  useEffect(() => {
    refresh()
  }, [refresh])

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
    if (online) refresh()
  }, [online, refresh])

  const selectMap = useCallback(
    async (mapId: number) => {
      if (!carId) return false
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return false
      }
      await mapApi.setCurrentMap(carId, mapId)
      await refresh()
      return true
    },
    [carId, online, refresh]
  )

  const deleteMap = useCallback(
    async (mapId: number) => {
      if (!carId) return false
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return false
      }
      await mapApi.deleteMap(carId, mapId)
      await refresh()
      return true
    },
    [carId, online, refresh]
  )

  const generateMap = useCallback(async (name?: string) => {
    if (!carId) return false
    if (!online) {
      setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
      return false
    }
    await mapApi.generateMap(carId, { name })
    return true
  }, [carId, online])

  const createMap = useCallback(
    async (payload: {
      name: string
      imageUrl: string
      width: number
      height: number
      resolution: number
      originX: number
      originY: number
    }) => {
      if (!carId) return null
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return null
      }
      const created = await mapApi.createMap(carId, payload)
      await refresh()
      return created ?? null
    },
    [carId, online, refresh]
  )

  const renameMap = useCallback(
    async (mapId: number, name: string) => {
      if (!carId) return false
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return false
      }
      await mapApi.renameMap(carId, mapId, name)
      await refresh()
      return true
    },
    [carId, online, refresh]
  )

  return {
    maps,
    currentMap,
    isLoading,
    error,
    refresh,
    selectMap,
    deleteMap,
    generateMap,
    createMap,
    renameMap,
  }
}
