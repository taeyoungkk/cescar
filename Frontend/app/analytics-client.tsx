"use client"

import { Analytics } from "@vercel/analytics/next"

export function AnalyticsClient() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")

  // 로컬에서는 끔 (오프라인 테스트/데모 품질)
  if (isLocalhost) return null

  return <Analytics />
}
