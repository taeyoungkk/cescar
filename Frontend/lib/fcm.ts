"use client"

import { getToken, onMessage } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase"
import * as notificationApi from "@/core/api/notification"

const FCM_TOKEN_KEY = "fcmToken"

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

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission()
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
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-messaging/",
    })
  } catch (error) {
    console.error("[FCM] Service worker registration failed.", error)
    return null
  }

  let token: string
  try {
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  } catch (error) {
    console.error("[FCM] Failed to fetch token.", error)
    return null
  }
  if (!token) return null

  const stored = localStorage.getItem(FCM_TOKEN_KEY)
  if (stored !== token) {
    try {
      await notificationApi.registerToken(token)
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
  } finally {
    localStorage.removeItem(FCM_TOKEN_KEY)
  }
}

export async function listenForegroundMessages(onReceive: (payload: any) => void) {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, onReceive)
}
