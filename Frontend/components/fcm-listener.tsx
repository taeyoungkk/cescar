"use client"

import { useEffect } from "react"
import { listenForegroundMessages } from "@/lib/fcm"

export function FcmListener() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    listenForegroundMessages((payload) => {
      // Payload logging is handled in lib/fcm.ts when NEXT_PUBLIC_FCM_DEBUG=true.
      // This component just ensures the listener is active on all protected pages.
      void payload
    }).then((unsub) => {
      unsubscribe = unsub
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return null
}
