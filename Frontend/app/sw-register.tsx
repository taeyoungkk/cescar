"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"

export function SwRegister() {
  const router = useRouter()
  const hasPromptedRef = useRef(false)
  const hasAutoClearedRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const clearCaches = async () => {
      if (!("caches" in window)) return
      const keys = await caches.keys()
      const targets = [
        "workbox-precache",
        "next-static",
        "static-resources",
        "images",
        "pages",
        "start-url",
      ]
      await Promise.all(
        keys
          .filter((key) => targets.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))
      )
    }

    const clearCachesAndUnregister = async () => {
      if (hasAutoClearedRef.current) return
      hasAutoClearedRef.current = true
      await clearCaches()
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    }

    const handlePrecacheError = () => {
      clearCachesAndUnregister()
        .catch(() => {})
        .finally(() => window.location.reload())
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = typeof reason === "string" ? reason : reason?.message
      if (!message) return
      if (message.includes("bad-precaching-response")) {
        handlePrecacheError()
      }
    }

    window.addEventListener("unhandledrejection", handleRejection)

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      if (hasPromptedRef.current) return
      hasPromptedRef.current = true

      const waiting = reg.waiting
      toast({
        title: "업데이트 준비됨",
        description: "새 버전이 있습니다. 새로고침하면 반영됩니다.",
        action: (
          <ToastAction
            altText="새로고침"
            onClick={() => {
              if (waiting) {
                waiting.postMessage({ type: "SKIP_WAITING" })
                clearCachesAndUnregister().finally(() => window.location.reload())
              } else {
                window.location.reload()
              }
            }}
          >
            새로고침
          </ToastAction>
        ),
      })

      let refreshed = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshed) return
        refreshed = true
        clearCachesAndUnregister().finally(() => window.location.reload())
      })
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          handleUpdate(reg)
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              handleUpdate(reg)
            }
          })
        })
      })
      .catch((err) => {
        console.error("[SW] register failed", err)
      })

    const handleOffline = () => {
      router.push("/offline")
    }

    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection)
      window.removeEventListener("offline", handleOffline)
    }
  }, [router])

  return null
}
