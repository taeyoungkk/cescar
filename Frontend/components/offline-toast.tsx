"use client"

import { useEffect, useRef } from "react"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { useToast } from "@/components/ui/use-toast"

export function OfflineToast() {
  const { isOnline } = useNetworkStatus()
  const { toast, dismiss } = useToast()
  const lastOnlineRef = useRef<boolean | null>(null)
  const toastIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastOnlineRef.current === null) {
      lastOnlineRef.current = isOnline
      if (!isOnline) {
        const entry = toast({
          title: "\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC",
          description: "\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uC5F0\uACB0 \uD6C4 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD569\uB2C8\uB2E4.",
        })
        toastIdRef.current = entry.id
      }
      return
    }

    if (lastOnlineRef.current === isOnline) return
    lastOnlineRef.current = isOnline

    if (!isOnline) {
      const entry = toast({
        title: "\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC",
        description: "\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uC5F0\uACB0 \uD6C4 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD569\uB2C8\uB2E4.",
      })
      toastIdRef.current = entry.id
    } else if (toastIdRef.current) {
      dismiss(toastIdRef.current)
      toastIdRef.current = null
    }
  }, [dismiss, isOnline, toast])

  return null
}
