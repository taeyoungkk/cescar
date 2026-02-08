"use client"

import { useEffect, useRef } from "react"
import { listenForegroundMessages } from "@/lib/fcm"
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
        const trimmed = (rawTitle ?? "").replace(/^긴급 알림[:\s]*/i, "").trim()
        return trimmed ? `[!] ${trimmed}` : "[!] 알림"
      }

      const formatKst = (value: string | undefined) => {
        if (!value) return ""
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return String(value)
        const kst = new Date(parsed.getTime() + 9 * 60 * 60 * 1000)
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())} ${pad(
          kst.getHours()
        )}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`
      }

      const buildBody = (rawBody: string | undefined, data: any) => {
        const body = rawBody ?? ""
        const time = formatKst(data?.timestamp || data?.detectedAt)
        const hasDetectedLine = body.includes("감지되었습니다")
        const hasProbabilityLine = body.includes("확률")
        const hasTimeLine = body.includes("시간")

        if (hasDetectedLine || hasProbabilityLine || hasTimeLine) {
          if (time && !hasTimeLine) {
            return `${body}\n시간: ${time}`
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

        if (!type && !probability && !time) return body || "알림이 도착했습니다."

        const lines = []
        lines.push(`${type || "탐지"} 감지되었습니다.`)
        if (probability) lines.push(`확률: ${probability}`)
        if (time) lines.push(`시간: ${time}`)
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
      // Clear old entries
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
        } catch (_err) {
          // best-effort
        }
        try {
          new Notification(title, {
            body: message,
            icon: "/icons/icon-192.png",
            data: payload?.data ?? {},
          })
        } catch (_err) {
          // best-effort
        }
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
