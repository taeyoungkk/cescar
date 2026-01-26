"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import {
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Activity,
  Bug,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ChevronRight,
  Map as MapIcon,
  Play,
  Square,
  Loader2,
  Navigation,
  Target,
  Grid3X3,
  MapPin,
  History,
  Trash2,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { useRobotStatus } from "@/hooks/useRobotStatus"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { useRecentDetections } from "@/hooks/useRecentDetections"
import { useAlerts } from "@/hooks/useAlerts"
import { useMapStore, type StoredMap, type MapStatus } from "@/hooks/useMapStore"

import type { RobotStatus, Detection, SystemAlert, DetectionStats } from "@/core/types"
import { DetectionControls } from "@/components/robot/DetectionControls"


// ✅ DEMO MODE
import { DEMO_MODE } from "@/core/demo/config"
import { robotDemoEngine } from "@/core/demo/robotDemoEngine"
import { useHomeDemoSummary } from "@/hooks/useHomeDemoSummary"

// ============================================
// Presentational Components (UI Only)
// ============================================

function StatusCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = "default",
}: {
  title: string
  value: string | number
  icon: React.ElementType
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-semibold ${variantStyles[variant]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg bg-secondary ${variantStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RobotStatusSection({
  status,
  stats,
  isLoading,
}: {
  status: RobotStatus | null
  stats: DetectionStats | null
  isLoading: boolean
}) {
  if (isLoading || !status) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 h-24 animate-pulse bg-secondary/20" />
          </Card>
        ))}
      </div>
    )
  }

  const modeLabels = { detecting: "탐지 중", idle: "대기 중", moving: "이동 중" } as const
  const modeVariants: Record<string, "default" | "success" | "warning" | "danger"> = {
    detecting: "success",
    idle: "default",
    moving: "warning",
  }
  const getBatteryVariant = (level: number) => {
    if (level > 50) return "success"
    if (level > 20) return "warning"
    return "danger"
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatusCard
        title="연결 상태"
        value={status.isOnline ? "온라인" : "오프라인"}
        icon={status.isOnline ? Wifi : WifiOff}
        variant={status.isOnline ? "success" : "danger"}
        subtitle={status.isOnline ? "정상 연결됨" : "연결 끊김"}
      />
      <StatusCard
        title="배터리"
        value={`${status.batteryLevel}%`}
        icon={status.batteryLevel > 20 ? Battery : BatteryLow}
        variant={getBatteryVariant(status.batteryLevel)}
        subtitle={status.batteryLevel > 50 ? "충분함" : "충전 필요"}
      />
      <StatusCard
        title="현재 모드"
        value={modeLabels[status.mode]}
        icon={Activity}
        variant={modeVariants[status.mode]}
      />
      <StatusCard
        title="오늘 탐지"
        value={stats?.todayCount ?? 0}
        icon={Bug}
        variant="default"
        subtitle={`이번 주: ${stats?.weekCount ?? 0}건`}
      />
    </div>
  )
}

// ============================================
// Map UI (Presentational)
// ============================================

function MapVisualization({ status, progress = 0 }: { status: MapStatus; progress?: number }) {
  return (
    <div className="relative w-full aspect-[4/3] bg-zinc-900 rounded-lg overflow-hidden border border-border">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {status === "no_map" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="p-4 rounded-full bg-secondary/50 mb-4">
            <Grid3X3 className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">생성된 지도가 없습니다</p>
          <p className="text-muted-foreground/60 text-xs mt-1">지도 생성을 시작하세요</p>
        </div>
      )}

      {status === "generating" && (
        <>
          {/* scanning overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(
                180deg,
                transparent 0%,
                transparent ${Math.max(0, progress - 5)}%,
                rgba(34, 197, 94, 0.15) ${progress}%,
                transparent ${Math.min(100, progress + 5)}%,
                transparent 100%
              )`,
            }}
          />

          <div className="absolute inset-4">
            <svg className="w-full h-full" viewBox="0 0 200 150">
              <rect x="20" y="20" width="160" height="4" fill="rgba(100,100,100,0.8)" opacity={progress > 10 ? 1 : 0} />
              <rect x="20" y="20" width="4" height="110" fill="rgba(100,100,100,0.8)" opacity={progress > 15 ? 1 : 0} />
              <rect x="176" y="20" width="4" height="110" fill="rgba(100,100,100,0.8)" opacity={progress > 20 ? 1 : 0} />
              <rect x="20" y="126" width="160" height="4" fill="rgba(100,100,100,0.8)" opacity={progress > 25 ? 1 : 0} />

              <rect x="60" y="20" width="4" height="50" fill="rgba(100,100,100,0.8)" opacity={progress > 35 ? 1 : 0} />
              <rect x="120" y="80" width="4" height="50" fill="rgba(100,100,100,0.8)" opacity={progress > 45 ? 1 : 0} />
              <rect x="60" y="90" width="40" height="4" fill="rgba(100,100,100,0.8)" opacity={progress > 55 ? 1 : 0} />

              {progress > 30 && (
                <g opacity={Math.min(1, (progress - 30) / 30)}>
                  <rect x="28" y="28" width="28" height="60" fill="rgba(34, 197, 94, 0.1)" />
                  <rect x="68" y="28" width="48" height="58" fill="rgba(34, 197, 94, 0.1)" />
                  <rect x="128" y="28" width="44" height="94" fill="rgba(34, 197, 94, 0.1)" />
                  <rect x="28" y="98" width="88" height="24" fill="rgba(34, 197, 94, 0.1)" />
                </g>
              )}

              <circle cx="100" cy="75" r="6" fill="#22c55e" opacity={progress > 20 ? 1 : 0}>
                <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
              </circle>

              {progress > 40 && (
                <path d="M 40 40 L 50 50 L 80 50 L 100 75" stroke="#22c55e" strokeWidth="2" fill="none" strokeDasharray="4 2" opacity="0.5" />
              )}
            </svg>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
              <span className="text-sm text-emerald-400 font-medium">지도 생성 중...</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">{progress}% 완료</p>
          </div>
        </>
      )}

      {status === "completed" && (
        <>
          <div className="absolute inset-4">
            <svg className="w-full h-full" viewBox="0 0 200 150">
              <rect x="20" y="20" width="160" height="4" fill="rgba(120,120,120,0.9)" />
              <rect x="20" y="20" width="4" height="110" fill="rgba(120,120,120,0.9)" />
              <rect x="176" y="20" width="4" height="110" fill="rgba(120,120,120,0.9)" />
              <rect x="20" y="126" width="160" height="4" fill="rgba(120,120,120,0.9)" />

              <rect x="60" y="20" width="4" height="50" fill="rgba(120,120,120,0.9)" />
              <rect x="120" y="80" width="4" height="50" fill="rgba(120,120,120,0.9)" />
              <rect x="60" y="90" width="40" height="4" fill="rgba(120,120,120,0.9)" />

              <rect x="28" y="28" width="28" height="58" fill="rgba(34, 197, 94, 0.15)" />
              <rect x="68" y="28" width="48" height="58" fill="rgba(34, 197, 94, 0.15)" />
              <rect x="128" y="28" width="44" height="94" fill="rgba(34, 197, 94, 0.15)" />
              <rect x="28" y="98" width="88" height="24" fill="rgba(34, 197, 94, 0.15)" />

              <g opacity="0.3">
                {[...Array(7)].map((_, i) => (
                  <line key={`h-${i}`} x1="28" y1={28 + i * 14} x2="172" y2={28 + i * 14} stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
                ))}
                {[...Array(10)].map((_, i) => (
                  <line key={`v-${i}`} x1={28 + i * 16} y1="28" x2={28 + i * 16} y2="122" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
                ))}
              </g>

              {/* Robot marker with ripple */}
              <g>
                <circle cx="100" cy="75" r="5" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0">
                  <animate attributeName="r" values="5;20" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="100" cy="75" r="5" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0">
                  <animate attributeName="r" values="5;20" dur="2s" begin="0.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" begin="0.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="100" cy="75" r="5" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0">
                  <animate attributeName="r" values="5;20" dur="2s" begin="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>

                <circle cx="100" cy="75" r="8" fill="#22c55e" opacity="0.3" />
                <circle cx="100" cy="75" r="5" fill="#22c55e" />
                <polygon points="100,67 104,73 96,73" fill="#22c55e" />
              </g>

              <g>
                <circle cx="45" cy="50" r="4" fill="#f59e0b" opacity="0.8" />
                <circle cx="140" cy="100" r="4" fill="#f59e0b" opacity="0.8" />
                <circle cx="85" cy="110" r="4" fill="#f59e0b" opacity="0.8" />
              </g>

              <path d="M 40 40 L 50 50 L 80 50 L 100 75 L 140 100 L 85 110 L 100 75" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeDasharray="4 2" opacity="0.4" />
            </svg>
          </div>

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              지도 완료
            </Badge>
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/80">로봇</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs text-white/80">탐지</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>마지막 업데이트: 방금 전</span>
              <span>탐지 지점: 3개</span>
            </div>
          </div>
        </>
      )}

      {/* Compass indicator */}
      <div className="absolute top-3 left-3">
        {status !== "no_map" && (
          <div className="bg-black/60 rounded-full p-1.5">
            <Navigation className="h-4 w-4 text-white/70" />
          </div>
        )}
      </div>
    </div>
  )
}

function MapMetadataPanel({
  status,
  generatedAt,
  areaSize,
  robotId,
}: {
  status: MapStatus
  generatedAt?: string
  areaSize?: string
  robotId?: string
}) {
  if (status === "no_map") return null

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      <div className="bg-secondary/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">생성 시각</p>
        <p className="text-sm font-medium text-foreground">{generatedAt || "-"}</p>
      </div>
      <div className="bg-secondary/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">맵 영역</p>
        <p className="text-sm font-medium text-foreground">{areaSize || "-"}</p>
      </div>
      <div className="bg-secondary/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">로봇 ID</p>
        <p className="text-sm font-medium text-foreground font-mono">{robotId || "-"}</p>
      </div>
    </div>
  )
}

function MapHistoryDialog({
  maps,
  onSelect,
  onDelete,
}: {
  maps: StoredMap[]
  onSelect: (mapId: string) => void
  onDelete: (mapId: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent">
          <History className="mr-2 h-4 w-4" />
          기존 지도 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>기존 지도</DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {maps.length === 0 ? (
            <div className="text-center py-8">
              <Grid3X3 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">저장된 지도가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {maps.map((map) => (
                <div
                  key={map.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{map.generatedAt}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{map.areaSize}</span>
                      <span className="text-xs text-muted-foreground">{map.detectionsCount}개 탐지</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        onSelect(map.id)
                        setOpen(false)
                      }}
                    >
                      선택
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => onDelete(map.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MapGenerationSection({
  mapStatus,
  progress = 0,
  isOnline,
  generatedAt,
  areaSize,
  robotId,
  maps,
  onStartGeneration,
  onStopGeneration,
  onSelectMap,
  onDeleteMap,
}: {
  mapStatus: MapStatus
  progress?: number
  isOnline: boolean
  generatedAt?: string
  areaSize?: string
  robotId?: string
  maps: StoredMap[]
  onStartGeneration?: () => void
  onStopGeneration?: () => void
  onSelectMap?: (mapId: string) => void
  onDeleteMap?: (mapId: string) => void
}) {
  const isDisabled = !isOnline

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-base font-medium truncate">지도 생성 및 내비게이션</CardTitle>
            <Badge variant="secondary" className="text-xs shrink-0">
              <Target className="h-3 w-3 mr-1" />
              SLAM
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
            {maps.length > 0 && onSelectMap && onDeleteMap && (
              <MapHistoryDialog maps={maps} onSelect={onSelectMap} onDelete={onDeleteMap} />
            )}
            {mapStatus === "completed" && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">완료됨</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <MapVisualization status={mapStatus} progress={progress} />
        <MapMetadataPanel status={mapStatus} generatedAt={generatedAt} areaSize={areaSize} robotId={robotId} />

        <div className="flex gap-3">
          {mapStatus === "generating" ? (
            <Button variant="destructive" className="flex-1" onClick={onStopGeneration} disabled={isDisabled}>
              <Square className="mr-2 h-4 w-4" />
              생성 중지
            </Button>
          ) : (
            <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onStartGeneration} disabled={isDisabled}>
              {mapStatus === "completed" ? (
                <>
                  <MapIcon className="mr-2 h-4 w-4" />
                  지도 재생성
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  지도 생성 시작
                </>
              )}
            </Button>
          )}

          {mapStatus === "completed" && (
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/map">
                <MapIcon className="mr-2 h-4 w-4" />
                지도 상세 보기
                <ChevronRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {isDisabled && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-amber-400">로봇이 오프라인 상태입니다. 연결 후 지도 생성이 가능합니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Alerts & Detections (same as your code)
// ============================================

function AlertItem({ alert }: { alert: SystemAlert }) {
  const alertConfig = {
    warning: {
      bg: "bg-amber-500/10 border-amber-500/30",
      icon: AlertTriangle,
      iconColor: "text-amber-400",
    },
    error: {
      bg: "bg-red-500/10 border-red-500/30",
      icon: AlertCircle,
      iconColor: "text-red-400",
    },
    info: {
      bg: "bg-blue-500/10 border-blue-500/30",
      icon: Info,
      iconColor: "text-blue-400",
    },
  } as const

  const config = alertConfig[alert.type]
  const Icon = config.icon

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg}`}>
      <Icon className={`h-4 w-4 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
      </div>
    </div>
  )
}

function SystemAlertsSection({ alerts, isLoading }: { alerts: SystemAlert[]; isLoading: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">시스템 알림</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {alerts.length}개
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">알림이 없습니다</p>
        ) : (
          alerts.slice(0, 3).map((alert) => <AlertItem key={alert.id} alert={alert} />)
        )}
      </CardContent>
    </Card>
  )
}

function DetectionItem({ detection }: { detection: Detection }) {
  const statusStyles: Record<string, string> = {
    confirmed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    dismissed: "bg-muted text-muted-foreground border-border",
    detected: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    false_alarm: "bg-red-500/20 text-red-400 border-red-500/30",
    resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  }

  const statusLabels: Record<string, string> = {
    confirmed: "확인됨",
    pending: "확인 중",
    dismissed: "무시됨",
    detected: "탐지됨",
    false_alarm: "오탐",
    resolved: "해결됨",
  }

  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-secondary">
          <Bug className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{typeLabels[detection.type] || detection.type}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {detection.time}
          </p>
        </div>
      </div>
      <Badge className={statusStyles[detection.status]}>{statusLabels[detection.status]}</Badge>
    </div>
  )
}

function RecentDetectionsSection({ detections, isLoading }: { detections: Detection[]; isLoading: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">최근 탐지 이벤트</CardTitle>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              전체 보기
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-3 h-16 animate-pulse bg-secondary/10" />
            ))}
          </div>
        ) : detections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">오늘 탐지된 항목이 없습니다</p>
        ) : (
          <div className="divide-y divide-border">
            {detections.map((d) => (
              <DetectionItem key={d.id} detection={d} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Page Component (DEMO/REAL merge)
// ============================================

export default function HomePage() {
  // Always call hooks (avoid conditional hooks)
  const demoSummary = useHomeDemoSummary()
  const realStatus = useRobotStatus()
  const realDetections = useRecentDetections()
  const realAlerts = useAlerts()
  const mapStore = useMapStore()
  const { isOnline: networkOnline } = useNetworkStatus()

  const isDemo = DEMO_MODE


  // DEMO: derive same data you already used
  let robotStatus: RobotStatus | null = null
  let recentDetections: Detection[] = []
  let stats: DetectionStats | null = null
  let alerts: SystemAlert[] = []

  let statusLoading = false
  let detectionsLoading = false
  let alertsLoading = false

  if (isDemo) {
    const snap = robotDemoEngine.getSnapshot()

    const mode: RobotStatus["mode"] =
      snap.isDetecting ? "detecting" : snap.robotStatus.isMoving ? "moving" : "idle"

    const base = demoSummary.status
    robotStatus = base ? { ...base, mode } : null

    recentDetections = snap.cameraEvents.slice(0, 5).map((e) => ({
      id: e.id,
      type: e.type as Detection["type"],
      time: e.time,
      status: "detected",
      date: new Date().toLocaleDateString("ko-KR"),
      robotId: "CESCAR-01",
      confidence: Math.round(70 + Math.random() * 25),
      notes: "",
    }))

    stats = {
      todayCount: demoSummary.detectionsLast10m,
      weekCount: snap.detectionHistory.length,
      falseAlarmRate: 8,
      lastDetectionTime: recentDetections[0]?.time ?? "-",
    }

    alerts = []
    if (robotStatus && !robotStatus.isOnline) {
      alerts.push({
        id: "offline",
        type: "error",
        title: "로봇 연결 끊김",
        message: "로봇이 오프라인입니다. 네트워크/전원을 확인하세요.",
      })
    }
    if (robotStatus && robotStatus.batteryLevel <= 20) {
      alerts.push({
        id: "low-battery",
        type: "warning",
        title: "배터리 부족",
        message: `배터리 잔량이 ${robotStatus.batteryLevel}% 입니다. 충전이 필요합니다.`,
      })
    }
    if (recentDetections.length > 0) {
      alerts.push({
        id: "recent-detection",
        type: "info",
        title: "최근 탐지 이벤트",
        message: `가장 최근 탐지: ${recentDetections[0].type} (${recentDetections[0].time})`,
      })
    }

    statusLoading = robotStatus == null
    detectionsLoading = false
    alertsLoading = false
  } else {
    robotStatus = realStatus.robotStatus
    recentDetections = realDetections.recentDetections
    stats = realDetections.stats
    alerts = realAlerts.alerts

    statusLoading = realStatus.isLoading
    detectionsLoading = realDetections.isLoading
    alertsLoading = realAlerts.isLoading
  }

  const robotOnline = robotStatus?.isOnline ?? false
  const mapReady = mapStore.status === "completed"

  const isDetecting = isDemo
    ? robotStatus?.mode === "detecting"
    : realStatus.isDetecting

  const detectionLoading = isDemo
    ? statusLoading
    : realStatus.isLoading

  const onStart = React.useCallback(async () => {
    if (isDemo) {
      robotDemoEngine.startDetection()
      return true
    }
    return realStatus.startDetection()
  }, [isDemo, realStatus])

  const onStop = React.useCallback(async () => {
    if (isDemo) {
      robotDemoEngine.stopDetection()
      return true
    }
    return realStatus.stopDetection()
  }, [isDemo, realStatus])

  // must be above early return
  useEffect(() => {
    if (mapStore.status === "generating" && isDetecting) {
      onStop()
    }
  }, [mapStore.status, isDetecting, onStop])


  // Wait for mapStore hydration (prevents flicker + mismatch)
  if (!mapStore.isInitialized) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">홈</h1>
            <p className="text-sm text-muted-foreground mt-1">로봇 상태 및 탐지 현황을 확인하세요</p>
          </div>
          <div className="animate-pulse bg-secondary/20 h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">홈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            로봇 상태 및 탐지 현황을 확인하세요{isDemo ? " (DEMO MODE)" : ""}
          </p>
        </div>

        <div className="mb-6">
          <RobotStatusSection status={robotStatus} stats={stats} isLoading={statusLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <MapGenerationSection
              mapStatus={mapStore.status}
              progress={mapStore.progress}
              isOnline={robotOnline}
              generatedAt={mapStore.activeMap?.generatedAt}
              areaSize={mapStore.activeMap?.areaSize}
              robotId={mapStore.activeMap?.robotId}
              maps={mapStore.maps}
              onStartGeneration={mapStore.startGeneration}
              onStopGeneration={mapStore.stopGeneration}
              onSelectMap={mapStore.selectMap}
              onDeleteMap={mapStore.deleteMap}
            />

              <DetectionControls
                isDetecting={isDetecting}
                isLoading={detectionLoading}
                onStart={onStart}
                onStop={onStop}
                networkOnline={networkOnline}
                robotOnline={robotOnline}
                mapReady={mapReady}
              />
          </div>
          <div className="space-y-6">
            <SystemAlertsSection alerts={alerts} isLoading={alertsLoading} />
          </div>
        </div>

        <div className="mt-6">
          <RecentDetectionsSection detections={recentDetections} isLoading={detectionsLoading} />
        </div>
      </div>
    </div>
  )
}
