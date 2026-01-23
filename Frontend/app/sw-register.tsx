"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function SwRegister() {
  const router = useRouter()

  useEffect(() => {
    // prod에서만
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] registered", reg)
      })
      .catch((err) => {
        console.error("[SW] register failed", err)
      })

    // 네트워크가 끊겼을 때: 현재 라우트가 서버 의존이면 offline로 유도
    // - 단, 이미 렌더된 화면은 유지되므로 강제 이동은 최소화
    const handleOffline = () => {
      // 지금 화면이 "사이트에 연결할 수 없음"으로 떨어지기 전에,
      // 사용자가 새로고침/네비게이션 시도했을 때 offline 페이지로 유도하는 용도
      // 여기서는 바로 push하지 않고, 필요한 화면에서 버튼/배너로 유도하는게 더 좋음.
      // 우선은 가장 단순하게: 오프라인 되면 offline 페이지로 이동(원하면 완화 가능)
      router.push("/offline")
    }

    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("offline", handleOffline)
    }
  }, [router])

  return null
}
