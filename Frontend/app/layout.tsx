import React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AnalyticsClient } from "./analytics-client"
import { SwRegister } from "./sw-register"
import { OfflineBanner } from "@/components/offline-banner"
import { OfflineToast } from "@/components/offline-toast"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const isProd = process.env.NODE_ENV === "production"
const isLocalhost =
  typeof window !== "undefined" && window.location.hostname === "localhost"

export const metadata: Metadata = {
  title: "Cescar - 벌레 탐지 로봇 모니터링 시스템",
  description: "실시간 벌레 탐지 로봇 모니터링 및 제어 시스템",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  themeColor: "#0a0a0a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cescar",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SwRegister />
        <OfflineBanner />
        <OfflineToast />
        {children}
        <Toaster />
        {isProd ? <AnalyticsClient /> : null}
      </body>
    </html>
  )
}
