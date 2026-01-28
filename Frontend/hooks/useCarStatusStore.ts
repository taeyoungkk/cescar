// hooks/useCarStatusStore.ts
"use client"

import { create } from "zustand"
import type { CarStatus } from "@/core/types"
import * as carApi from "@/core/api/car"

type State = {
  data: CarStatus | null
  error: string | null
  isLoading: boolean
  isRefreshing: boolean
  start: (carId: number, intervalMs?: number) => () => void
  refreshNow: () => Promise<void>
}

function shallowEqualStatus(a: CarStatus | null, b: CarStatus | null) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.heading === b.heading &&
    a.mode === b.mode &&
    a.isOnline === b.isOnline &&
    a.updatedAt === b.updatedAt
  )
}

// ---- module-scope poller state (singleton) ----
let timer: number | null = null
let refCount = 0
let currentCarId: number | null = null

let baseIntervalMs = 1000
let currentIntervalMs = 1000
let failCount = 0

let inFlight = false
let stoppedByVisibility = false
let stoppedByOffline = false

let cleanupEvents: (() => void) | null = null

function clearTimer() {
  if (timer != null) {
    window.clearTimeout(timer)
    timer = null
  }
}

function computeBackoffInterval(base: number, fails: number) {
  // 1회 실패: 2x, 2회: 4x, 3회: 8x ... 최대 10초
  const next = Math.min(base * Math.pow(2, Math.min(fails, 3)), 10_000)
  return next
}

export const useCarStatusStore = create<State>((set, get) => {
  const scheduleNext = () => {
    clearTimer()

    // 탭 숨김/오프라인이면 스케줄 중단
    if (stoppedByVisibility || stoppedByOffline) return
    if (refCount <= 0 || currentCarId == null) return

    timer = window.setTimeout(async () => {
      await get().refreshNow()
      scheduleNext()
    }, currentIntervalMs)
  }

  const attachEventsOnce = () => {
    if (cleanupEvents) return

    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden"
      if (hidden) {
        stoppedByVisibility = true
        clearTimer()
      } else {
        stoppedByVisibility = false
        // visible 복귀 시 즉시 1회 갱신 후 재개
        get().refreshNow().finally(() => scheduleNext())
      }
    }

    const onOffline = () => {
      stoppedByOffline = true
      clearTimer()
    }

    const onOnline = () => {
      stoppedByOffline = false
      get().refreshNow().finally(() => scheduleNext())
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)

    cleanupEvents = () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      cleanupEvents = null
    }
  }

  return {
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,

    refreshNow: async () => {
      const carId = currentCarId
      if (carId == null) return

      // 중복 요청 방지
      if (inFlight) return
      inFlight = true

      const isFirstLoad = get().data == null

      set({
        isLoading: isFirstLoad,
        isRefreshing: !isFirstLoad,
      })

      try {
        const next = await carApi.getCarStatus(carId)

        const prev = get().data
        if (!shallowEqualStatus(prev, next)) {
          set({ data: next, error: null })
        } else {
          set({ error: null })
        }

        // 성공 시 백오프 리셋
        failCount = 0
        currentIntervalMs = baseIntervalMs
      } catch (e: any) {
        set({ error: e?.message ?? "차량 상태를 불러오는데 실패했습니다." })

        // 실패 시 백오프 증가
        failCount += 1
        currentIntervalMs = computeBackoffInterval(baseIntervalMs, failCount)
      } finally {
        set({ isLoading: false, isRefreshing: false })
        inFlight = false
      }
    },

    start: (carId: number, intervalMs = 1000) => {
      refCount += 1
      currentCarId = carId
      baseIntervalMs = intervalMs
      if (failCount === 0) currentIntervalMs = intervalMs

      attachEventsOnce()

      // 이미 돌고 있으면 detach만
      if (timer != null) {
        return () => {
          refCount -= 1
          if (refCount <= 0) {
            clearTimer()
            currentCarId = null
            refCount = 0
            failCount = 0
            currentIntervalMs = baseIntervalMs
            inFlight = false
            stoppedByOffline = false
            stoppedByVisibility = false
            cleanupEvents?.()
          }
        }
      }

      // 최초 1회 즉시
      get().refreshNow().finally(() => scheduleNext())

      return () => {
        refCount -= 1
        if (refCount <= 0) {
          clearTimer()
          currentCarId = null
          refCount = 0
          failCount = 0
          currentIntervalMs = baseIntervalMs
          inFlight = false
          stoppedByOffline = false
          stoppedByVisibility = false
          cleanupEvents?.()
        }
      }
    },
  }
})
