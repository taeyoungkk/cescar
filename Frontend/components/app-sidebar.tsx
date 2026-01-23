"use client"

import React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Camera, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { CescarLogo } from "@/components/cescar-logo"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: "홈", href: "/home", icon: Home },
  { label: "실시간 카메라", href: "/camera", icon: Camera },
  { label: "대시보드", href: "/dashboard", icon: LayoutDashboard },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
      <div className="flex items-center gap-3 h-16 px-6 border-b border-border">
        <CescarLogo size={32} className="text-primary" />
        <span className="text-lg font-semibold text-foreground">Cescar</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-muted-foreground">시스템 정상</span>
        </div>
      </div>
    </aside>
  )
}
