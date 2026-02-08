"use client"

import React from "react"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { FcmListener } from "@/components/fcm-listener"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex overflow-x-hidden">
        <FcmListener />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto min-w-0">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
