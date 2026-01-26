"use client"

import { useState, useEffect, useCallback } from "react"

// ============================================
// Types
// ============================================

export type MapStatus = "no_map" | "generating" | "completed"

export interface StoredMap {
  id: string
  generatedAt: string
  areaSize: string
  robotId: string
  detectionsCount: number
  mapSeed: number // Used to generate consistent random map visuals
}

export interface MapStoreState {
  status: MapStatus
  progress: number
  activeMapId: string | null
  maps: StoredMap[]
}

const STORAGE_KEY = "cescar_map_store"

const defaultState: MapStoreState = {
  status: "no_map",
  progress: 0,
  activeMapId: null,
  maps: [],
}

// ============================================
// Helper Functions
// ============================================

function loadFromStorage(): MapStoreState {
  if (typeof window === "undefined") return defaultState
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as MapStoreState
      // Reset generating state on reload (can't resume generation)
      if (parsed.status === "generating") {
        parsed.status = parsed.activeMapId ? "completed" : "no_map"
        parsed.progress = 0
      }
      return parsed
    }
  } catch (e) {
    console.error("Failed to load map store from localStorage:", e)
  }
  return defaultState
}

function saveToStorage(state: MapStoreState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error("Failed to save map store to localStorage:", e)
  }
}

function generateMapId(): string {
  return `map-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

function generateMapSeed(): number {
  return Math.floor(Math.random() * 1000000)
}

function formatCurrentTime(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

// ============================================
// Hook
// ============================================

export function useMapStore() {
  const [state, setState] = useState<MapStoreState>(defaultState)
  const [isInitialized, setIsInitialized] = useState(false)

  // ✅ Next/Browser 안전 타입 (NodeJS.Timeout 제거)
  const [generationInterval, setGenerationInterval] =
    useState<ReturnType<typeof setInterval> | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadFromStorage()
    setState(loaded)
    setIsInitialized(true)
  }, [])

  // Save to localStorage whenever state changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveToStorage(state)
    }
  }, [state, isInitialized])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (generationInterval) {
        clearInterval(generationInterval)
      }
    }
  }, [generationInterval])

  // Get the active map
  const activeMap = state.maps.find((m) => m.id === state.activeMapId) || null

  // Start map generation
  const startGeneration = useCallback(() => {
    // Clear any existing interval
    if (generationInterval) {
      clearInterval(generationInterval)
    }

    setState((prev) => ({
      ...prev,
      status: "generating",
      progress: 0,
    }))

    // Prepare new map data
    const newMapId = generateMapId()
    const newMapSeed = generateMapSeed()

    // Simulate progress
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setGenerationInterval(null)

        // Create and store the new map
        const newMap: StoredMap = {
          id: newMapId,
          generatedAt: formatCurrentTime(),
          areaSize: `${(10 + Math.random() * 5).toFixed(1)}m x ${(6 + Math.random() * 4).toFixed(1)}m`,
          robotId: "CESCAR-01",
          detectionsCount: Math.floor(Math.random() * 5) + 1,
          mapSeed: newMapSeed,
        }

        setState((prev) => ({
          ...prev,
          status: "completed",
          progress: 100,
          activeMapId: newMapId,
          maps: [newMap, ...prev.maps].slice(0, 10), // Keep max 10 maps
        }))
      } else {
        setState((prev) => ({
          ...prev,
          progress: Math.min(100, Math.round(progress)),
        }))
      }
    }, 500)

    setGenerationInterval(interval)
  }, [generationInterval])

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (generationInterval) {
      clearInterval(generationInterval)
      setGenerationInterval(null)
    }

    setState((prev) => ({
      ...prev,
      status: prev.activeMapId ? "completed" : "no_map",
      progress: 0,
    }))
  }, [generationInterval])

  // Regenerate map (same as start but for existing maps)
  const regenerate = useCallback(() => {
    startGeneration()
  }, [startGeneration])

  // Select an existing map
  const selectMap = useCallback((mapId: string) => {
    setState((prev) => {
      const mapExists = prev.maps.some((m) => m.id === mapId)
      if (!mapExists) return prev
      return {
        ...prev,
        status: "completed",
        progress: 100,
        activeMapId: mapId,
      }
    })
  }, [])

  // Delete a map
  const deleteMap = useCallback((mapId: string) => {
    setState((prev) => {
      const newMaps = prev.maps.filter((m) => m.id !== mapId)
      const wasActive = prev.activeMapId === mapId
      return {
        ...prev,
        maps: newMaps,
        activeMapId: wasActive ? newMaps[0]?.id || null : prev.activeMapId,
        status: wasActive ? (newMaps.length > 0 ? "completed" : "no_map") : prev.status,
      }
    })
  }, [])

  return {
    // State
    status: state.status,
    progress: state.progress,
    activeMap,
    maps: state.maps,
    isInitialized,

    // Actions
    startGeneration,
    stopGeneration,
    regenerate,
    selectMap,
    deleteMap,
  }
}
