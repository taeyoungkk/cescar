"use client"

import { useEffect, useRef } from "react"
import { listenForegroundMessages } from "@/lib/fcm"
import { parseBackendDate } from "@/lib/date"
import { useToast } from "@/components/ui/use-toast"
import { toastInfo } from "@/lib/toast-helpers"
import { useAlertsStore } from "@/hooks/useAlertsStore"

export function FcmListener() {
  const { toast } = useToast()
  const setExternalAlerts = useAlertsStore((s) => s.setExternalAlerts)
  const toastRef = useRef(toast)
  toastRef.current = toast
  const seenRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    console.info("[FcmListener] mounting")

    const handleFcmPayload = (payload: any) => {
      const normalizeTitle = (rawTitle: string | undefined) => {
        const trimmed = (rawTitle ?? "").replace(/^Emergency Alert[:\s]*/i, "").trim()
        return trimmed ? `[!] ${trimmed}` : "[!] Alert"
      }

      const formatKstFromDate = (date: Date) => {
        const pad = (n: number) => String(n).padStart(2, "0")
        const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
        return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())} ${pad(
          kst.getHours()
        )}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`
      }

      const normalizeBodyTime = (body: string) => {
        const match = body.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
        if (!match) return body
        const parsed = parseBackendDate(match[1])
        if (!parsed) return body
        const kstStr = formatKstFromDate(parsed)
        return body.replace(match[1], kstStr)
      }

      const formatKst = (value: string | undefined) => {
        if (!value) return ""
        const tzMatch = value.match(/([+-])(\d{2}):?(\d{2})$/)
        const isUtc = value.endsWith("Z")
        if (!isUtc && !tzMatch) return ""
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return String(value)

        let offsetMinutes = 0
        if (isUtc) {
          offsetMinutes = 0
        } else if (tzMatch) {
          const sign = tzMatch[1] === "-" ? -1 : 1
          offsetMinutes = sign * (parseInt(tzMatch[2], 10) * 60 + parseInt(tzMatch[3], 10))
        }
        const kst = new Date(parsed.getTime() + (9 * 60 - offsetMinutes) * 60 * 1000)
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())} ${pad(
          kst.getHours()
        )}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`
      }

      const buildBody = (rawBody: string | undefined, data: any) => {
        const time = formatKst(data?.timestamp || data?.detectedAt)
        const body = normalizeBodyTime(rawBody ?? "")
        const hasDetectedLine = body.toLowerCase().includes("detected")
        const hasProbabilityLine = body.toLowerCase().includes("prob")
        const hasTimeLine = body.toLowerCase().includes("time")

        if (hasDetectedLine || hasProbabilityLine || hasTimeLine) {
          if (time && !hasTimeLine) {
            return `${body}\nTime: ${time}`
          }
          return body
        }
        let type = ""
        let probability = ""

        const match = body.match(/^(.*?)(?:\s+detected)?\s*\(([^)]+)\)/i)
        if (match) {
          type = match[1].trim()
          probability = match[2].trim()
        } else {
          const detectedIdx = body.toLowerCase().indexOf("detected")
          if (detectedIdx > 0) {
            type = body.slice(0, detectedIdx).trim()
          }
        }

        if (!type && !probability && !time) return body || "Notification received."

        const lines = []
        lines.push(`${type || "Detection"} detected.`)
        if (probability) lines.push(`Probability: ${probability}`)
        if (time) lines.push(`Time: ${time}`)
        return lines.join("\n")
      }

      const title = normalizeTitle(payload?.notification?.title ?? payload?.data?.title)
      const message = buildBody(
        payload?.notification?.body ?? payload?.data?.body,
        payload?.data
      )
      const rawId =
        payload?.messageId ??
        payload?.fcmMessageId ??
        (payload?.data
          ? `${payload.data.detectionId ?? ""}:${payload.data.title ?? ""}:${payload.data.body ?? ""}`
          : `${title}:${message}`)
      const now = Date.now()
      const ttlMs = 10000
      for (const [key, ts] of seenRef.current.entries()) {
        if (now - ts > ttlMs) seenRef.current.delete(key)
      }
      if (seenRef.current.has(rawId)) {
        console.info("[FcmListener] duplicate message ignored", rawId)
        return
      }
      seenRef.current.set(rawId, now)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("fcm-detection", {
            detail: {
              detectionId: payload?.data?.detectionId ?? null,
              messageId: payload?.messageId ?? payload?.fcmMessageId ?? null,
            },
          })
        )
      }

      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200])
      }

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          navigator.serviceWorker?.getRegistration().then((reg) => {
            reg?.showNotification(title, {
              body: message,
              icon: "/icons/icon-192.png",
              data: payload?.data ?? {},
            })
          })
        } catch (_err) {}
        try {
          new Notification(title, {
            body: message,
            icon: "/icons/icon-192.png",
            data: payload?.data ?? {},
          })
        } catch (_err) {}
      }

      toastInfo(toastRef.current, title, message)

      const id = payload?.messageId
        ? `fcm-${payload.messageId}`
        : `fcm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const detectionId =
        payload?.data?.detectionId != null ? String(payload.data.detectionId) : undefined
      const current = useAlertsStore.getState().externalAlerts
      setExternalAlerts([
        {
          id,
          type: "warning",
          title,
          message,
          timestamp: new Date().toISOString(),
          isRead: false,
          detectionId,
        },
        ...current,
      ])
    }
const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "FCM_FOREGROUND_MESSAGE") return
      console.info("[FcmListener] SW/Broadcast message received", event.data)
      handleFcmPayload(event.data.payload)
    }

    navigator.serviceWorker?.addEventListener("message", handleMessage)
    console.info("[FcmListener] service worker message listener attached")

    const channel = new BroadcastChannel("fcm-messages")
    channel.addEventListener("message", handleMessage)
    console.info("[FcmListener] BroadcastChannel listener attached")

    listenForegroundMessages((payload) => {
      // Payload logging is handled in lib/fcm.ts when NEXT_PUBLIC_FCM_DEBUG=true.
      // This component just ensures the listener is active on all protected pages.
      console.info("[FcmListener] onMessage payload received", payload)
      handleFcmPayload(payload)
    }).then((unsub) => {
      unsubscribe = unsub
      console.info("[FcmListener] foreground listener registered")
    })
    return () => {
      console.info("[FcmListener] unmounting")
      navigator.serviceWorker?.removeEventListener("message", handleMessage)
      channel.removeEventListener("message", handleMessage)
      channel.close()
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return null
}

