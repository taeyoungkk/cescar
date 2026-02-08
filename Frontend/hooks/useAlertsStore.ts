"use client"

import { create } from "zustand"
import type { SystemAlert } from "@/core/types"

type State = {
  baseAlerts: SystemAlert[]
  externalAlerts: SystemAlert[]
  isLoading: boolean
  error: string | null
  setBaseAlerts: (alerts: SystemAlert[]) => void
  setExternalAlerts: (alerts: SystemAlert[]) => void
  markAsRead: (alertId: string) => void
  markAllAsRead: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAlertsStore = create<State>((set, get) => ({
  baseAlerts: [],
  externalAlerts: [],
  isLoading: false,
  error: null,
  setBaseAlerts: (alerts) => set({ baseAlerts: alerts }),
  setExternalAlerts: (alerts) =>
    set((state) => {
      const prev = new Map(state.externalAlerts.map((a) => [a.id, a]))
      const merged = alerts.map((a) => {
        const existing = prev.get(a.id)
        return existing?.isRead ? { ...a, isRead: true } : a
      })
      return { externalAlerts: merged }
    }),
  markAsRead: (alertId) => {
    const update = (list: SystemAlert[]) =>
      list.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    set({
      baseAlerts: update(get().baseAlerts),
      externalAlerts: update(get().externalAlerts),
    })
  },
  markAllAsRead: () => {
    const update = (list: SystemAlert[]) => list.map((a) => ({ ...a, isRead: true }))
    set({
      baseAlerts: update(get().baseAlerts),
      externalAlerts: update(get().externalAlerts),
    })
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
