"use client"

import { getToken, onMessage } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase"
import * as notificationApi from "@/core/api/notification"

const FCM_TOKEN_KEY = "fcmToken"
const FCM_DEBUG = process.env.NEXT_PUBLIC_FCM_DEBUG === "true"

const log = (...args: any[]) => {
  if (!FCM_DEBUG) return
  console.info("[FCM]", ...args)
}

const info = (...args: any[]) => {
  console.info("[FCM]", ...args)
}

interface RegisterOptions {
  requestPermission?: boolean
}

function canRequestPermission(requestPermission: boolean) {
  if (typeof Notification === "undefined") return false
  if (Notification.permission === "denied") return false
  if (Notification.permission === "default" && !requestPermission) return false
  return true
}

export async function registerFcmToken(options: RegisterOptions = {}): Promise<string | null> {
  if (typeof window === "undefined") return null

  const requestPermission = options.requestPermission ?? true
  if (!canRequestPermission(requestPermission)) return null
  info("registerFcmToken: start", {
    permission: Notification.permission,
    requestPermission,
  })

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission()
    info("permission result", permission)
    if (permission !== "granted") return null
  } else if (Notification.permission !== "granted") {
    return null
  }

  const messaging = await getFirebaseMessaging()
  if (!messaging) {
    console.warn("[FCM] Messaging is not supported in this browser.")
    return null
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing.")
    return null
  }

  let registration: ServiceWorkerRegistration
  try {
    // Ensure we use the main PWA service worker at "/" for FCM too.
    registration = await navigator.serviceWorker.getRegistration("/")
    if (!registration) {
      info("registerFcmToken: no SW at '/', registering /sw.js")
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
    }
    info("service worker registered", registration.scope)
  } catch (error) {
    console.error("[FCM] Service worker registration failed.", error)
    return null
  }

  // Unregister legacy FCM worker if it still exists.
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    info("service worker registrations", regs.map((r) => r.active?.scriptURL ?? ""))
    await Promise.all(
      regs
        .filter((reg) => reg.active?.scriptURL?.includes("firebase-messaging-sw.js"))
        .map((reg) => reg.unregister())
    )
  } catch (_err) {
    // best-effort cleanup
  }

  try {
    const ready = await navigator.serviceWorker.ready
    if (ready?.active) {
      registration = ready
      info("service worker ready", registration.scope)
    }
  } catch (error) {
    console.error("[FCM] Service worker not active.", error)
    return null
  }

  let token: string
  try {
    info("getToken: start", { scope: registration.scope })
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  } catch (error) {
    console.error("[FCM] Failed to fetch token.", error)
    return null
  }
  if (!token) return null
  info("token fetched", token)

  const stored = localStorage.getItem(FCM_TOKEN_KEY)
  info("token compare", { stored: Boolean(stored), changed: stored !== token })
  if (stored !== token) {
    try {
      await notificationApi.registerToken(token)
      info("token registered to server")
    } catch (error) {
      console.error("[FCM] Failed to register token to server.", error)
      return null
    }
    localStorage.setItem(FCM_TOKEN_KEY, token)
  }

  return token
}

export async function unregisterFcmToken(): Promise<void> {
  if (typeof window === "undefined") return
  const token = localStorage.getItem(FCM_TOKEN_KEY)
  if (!token) return

  try {
    await notificationApi.unregisterToken(token)
    info("token unregistered from server")
  } finally {
    localStorage.removeItem(FCM_TOKEN_KEY)
  }
}

export async function listenForegroundMessages(onReceive: (payload: any) => void) {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}
  info("listenForegroundMessages: attached")
  return onMessage(messaging, (payload) => {
    info("onMessage hit", {
      hasNotification: Boolean(payload?.notification),
      dataKeys: payload?.data ? Object.keys(payload.data) : [],
      messageId: payload?.messageId,
    })
    onReceive(payload)
  })
}
