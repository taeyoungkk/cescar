"use client"

import React, { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Bell, Settings, LogOut, Menu, Home, Camera, LayoutDashboard, Sun, Moon } from "lucide-react"
import { CescarLogo } from "@/components/cescar-logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/hooks/useAuth"
import { useTheme } from "@/hooks/useTheme"
import { useAlerts } from "@/hooks/useAlerts"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: "홈", href: "/home", icon: Home },
  { label: "실시간 카메라", href: "/camera", icon: Camera },
  { label: "탐지 기록", href: "/dashboard", icon: LayoutDashboard },
]

export function AppHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const { unreadCount, alerts, markAsRead, markAllAsRead } = useAlerts()

  // 모바일 Sheet open state를 controlled로 관리
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // 라우트(pathname) 변경 시 자동 닫기
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await logout()
  }

  const displayNickname = user?.nickname || user?.name || "사용자"
  const displayName = user?.name || user?.nickname || "사용자"
  const avatarText = displayNickname.slice(0, 2)

  return (
    <header className="flex items-center justify-between h-16 px-4 lg:px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Sheet key={pathname} open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="flex flex-row items-center gap-3 h-16 px-6 border-b border-border">
              <Link href="/home" className="flex items-center gap-3">
                <CescarLogo size={32} className="text-primary" />
                <SheetTitle className="text-lg font-semibold">Cescar</SheetTitle>
              </Link>
            </SheetHeader>

            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // 링크 클릭 시 즉시 닫기 (체감 UX 개선)
                    onClick={() => setMobileNavOpen(false)}
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
          </SheetContent>
        </Sheet>

        <Link href="/home" className="flex items-center gap-3 lg:hidden">
          <CescarLogo size={28} className="text-primary" />
          <span className="text-base font-semibold text-foreground">Cescar</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3"
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isDark ? "다크" : "라이트"}
          </span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="알림">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">알림</p>
              {unreadCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {unreadCount} 미확인
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => markAllAsRead()}
                  >
                    전체 읽음
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {(!alerts || alerts.filter((a) => !a.isRead).length === 0) && (
                <p className="text-xs text-muted-foreground">새 알림이 없습니다.</p>
              )}
              {alerts?.filter((a) => !a.isRead).slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-md border border-border bg-secondary/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{alert.title}</p>
                    {!alert.isRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => markAsRead(alert.id)}
                      >
                        읽음
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2" aria-label="계정 메뉴">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {avatarText}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hidden sm:inline">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                설정
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
