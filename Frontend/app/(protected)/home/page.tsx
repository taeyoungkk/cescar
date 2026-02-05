"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  Wifi,
  WifiOff,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/components/ui/use-toast"
import { toastError, toastInfo, toastSuccess } from "@/lib/toast-helpers"
import { getErrorMessage } from "@/lib/error-messages"
import { getKstNow, parseBackendDate } from "@/lib/date"
import { ErrorAlert } from "@/components/ui/error-message"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { listenForegroundMessages } from "@/lib/fcm"
import { useRecentDetections } from "@/hooks/useRecentDetections"
import { usePrimaryCarId } from "@/hooks/usePrimaryCarId"
import { useAlerts } from "@/hooks/useAlerts"
import { useCarMaps } from "@/hooks/useCarMaps"

import type { Detection, SystemAlert, DetectionStats, CarStatus, CarSummary, CarMode } from "@/core/types"
import { OfflineGuardButton } from "@/components/offline-guard-button"
import * as carApi from "@/core/api/car"


import { useCarStatus } from "@/hooks/useCarStatus"

// ============================================
// Presentational Components (UI Only)
// ============================================

function StatusCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = "default",
  compact = false,
}: {
  title: string
  value: string | number | React.ReactNode
  icon: React.ElementType
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
  compact?: boolean
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  }
  const isSimpleValue = typeof value === "string" || typeof value === "number"

  return (
    <Card className="bg-card border-border">
      <CardContent className={compact ? "p-3" : "p-3 sm:p-4"}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            {isSimpleValue ? (
              <p className={`text-lg sm:text-2xl font-semibold ${variantStyles[variant]}`}>{value}</p>
            ) : (
              <div>{value}</div>
            )}
            {!compact && subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2.5 sm:p-3 rounded-lg bg-secondary ${variantStyles[variant]}`}>
            <Icon className={compact ? "h-4 w-4" : "h-4 w-4 sm:h-5 sm:w-5"} />
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
  status: CarStatus | null
  stats: DetectionStats | null
  isLoading: boolean
}) {
  if (isLoading || !status) {
    return (
      <>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="min-w-[140px]">
              <Card className="bg-card border-border">
                <CardContent className="p-3 h-20 animate-pulse bg-secondary/20" />
              </Card>
            </div>
          ))}
        </div>
        <div className="hidden lg:grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4 h-24 animate-pulse bg-secondary/20" />
            </Card>
          ))}
        </div>
      </>
    )
  }

  const modeLabels: Record<CarMode, string> = { STOP: "정지", MANUAL: "수동", AUTO: "자동" }
  
  const formatKstDateTime = (date: Date) => {
    const parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
    return {
      date: `${get("year")}.${get("month")}.${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    }
  }

  const lastSeenDate = parseBackendDate(status.updatedAt)
  const lastSeenParts = formatKstDateTime(lastSeenDate)
  const lastSeenLabel = (
    <div className="flex flex-col leading-tight">
      <span className="text-xs text-muted-foreground font-normal">{lastSeenParts.date}</span>
      <span className="text-lg sm:text-2xl font-semibold text-foreground">{lastSeenParts.time}</span>
    </div>
  )

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        <div className="min-w-[140px]">
          <StatusCard
            title="차량 연결 상태"
            value={status.isOnline ? "온라인" : "오프라인"}
            icon={status.isOnline ? Wifi : WifiOff}
            variant={status.isOnline ? "success" : "danger"}
            compact
          />
        </div>
        <div className="min-w-[140px]">
          <StatusCard
            title="현재 모드"
            value={modeLabels[status.mode]}
            icon={Activity}
            variant={status.mode === "AUTO" ? "success" : status.mode === "MANUAL" ? "warning" : "default"}
            compact
          />
        </div>
        <div className="min-w-[140px]">
          <StatusCard
            title="오늘 탐지"
            value={stats?.todayCount ?? 0}
            icon={Bug}
            variant="default"
            compact
          />
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-4 gap-4">
        <StatusCard
          title="차량 연결 상태"
          value={status.isOnline ? "온라인" : "오프라인"}
          icon={status.isOnline ? Wifi : WifiOff}
          variant={status.isOnline ? "success" : "danger"}
          subtitle={status.isOnline ? "정상 연결" : "연결 끊김"}
        />
        <StatusCard
          title="차량 마지막 수신"
          value={lastSeenLabel}
          icon={Clock}
          variant="default"
          subtitle="차량 상태 마지막 수신 시각"
        />
        <StatusCard
          title="현재 모드"
          value={modeLabels[status.mode]}
          icon={Activity}
          variant={status.mode === "AUTO" ? "success" : status.mode === "MANUAL" ? "warning" : "default"}
          subtitle={status.mode === "AUTO" ? "자율 주행" : status.mode === "MANUAL" ? "수동 조작" : "정지 상태"}
        />
        <StatusCard
          title="오늘 탐지"
          value={stats?.todayCount ?? 0}
          icon={Bug}
          variant="default"
          subtitle={`이번 주 ${stats?.weekCount ?? 0}건`}
        />
      </div>
    </>
  )
}

// ============================================
// Map UI (Presentational)
// ============================================

type MapStatus = "no_map" | "generating" | "completed"

type StoredMap = {
  id: string
  generatedAt: string
  areaSize: string
  robotId: string
  detectionsCount: number
  mapSeed: number
}

function MapVisualization({
  status,
  progress = 0,
  imageUrl,
  imageVersion,
  mapName,
}: {
  status: MapStatus
  progress?: number
  imageUrl?: string | null
  imageVersion?: string | number | null
  mapName?: string | null
}) {
  const resolvedImageUrl = imageUrl
    ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${imageVersion ?? "latest"}`
    : null
  return (
    <div className="relative w-full aspect-[16/9] max-h-[200px] sm:max-h-none sm:aspect-[4/3] bg-zinc-900 rounded-lg overflow-hidden border border-border">
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
          <p className="text-muted-foreground text-sm">생성된 지도가 없습니다.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">지도를 생성해 주세요.</p>
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
          {resolvedImageUrl ? (
            <img
              src={resolvedImageUrl}
              alt="지도 미리보기"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
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
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1 max-w-[90%]">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              지도 완료
            </Badge>
            {mapName && (
              <div
                className="bg-black/60 text-white/90 text-xs px-2 py-1 rounded max-w-full truncate"
                title={mapName}
              >
                {mapName}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}

function MapMetadataPanel({
  status,
  generatedAtDate,
  generatedAtTime,
  areaSize,
  robotId,
}: {
  status: MapStatus
  generatedAtDate?: string
  generatedAtTime?: string
  areaSize?: string
  robotId?: string
}) {
  if (status === "no_map") return null

  return (
    <div className="grid grid-cols-3 gap-2 mt-3 sm:grid-cols-3 sm:gap-3 sm:mt-4">
      <div className="bg-secondary/50 rounded-lg p-2 sm:p-3">
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">생성 시각</p>
        <div className="space-y-0.5">
          <p className="text-xs sm:text-sm font-medium text-foreground">{generatedAtDate || "-"}</p>
          <p className="text-[11px] text-muted-foreground">{generatedAtTime || "-"}</p>
        </div>
      </div>
      <div className="bg-secondary/50 rounded-lg p-2 sm:p-3">
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">맵 영역</p>
        <p className="text-xs sm:text-sm font-medium text-foreground">{areaSize || "-"}</p>
      </div>
      <div className="bg-secondary/50 rounded-lg p-2 sm:p-3">
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">차량 ID</p>
        <p className="text-xs sm:text-sm font-medium text-foreground font-mono">{robotId || "-"}</p>
      </div>
    </div>
  )
}

function MapHistoryDialog({
  maps,
  onSelect,
  onDelete,
  disabled = false,
}: {
  maps: StoredMap[]
  onSelect: (mapId: string) => void
  onDelete: (mapId: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent w-full sm:w-auto" disabled={disabled}>
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
              <p className="text-sm text-muted-foreground">등록된 지도가 없습니다.</p>
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
                      disabled={disabled}
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
                      disabled={disabled}
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
  generatedAtDate,
  generatedAtTime,
  areaSize,
  robotId,
  imageUrl,
  imageVersion,
  mapName,
  mapActions,
  maps,
  onStartGeneration,
  onStopGeneration,
  onSelectMap,
  onDeleteMap,
  detectionEnabled,
  detectionDisabledReason,
  isDetecting,
  detectionLoading,
  onStartDetect,
  onStopDetect,
  networkOnline,
  robotOnline,
  mapReady,
  isGeneratingMap = false,
  generationEnabled = true,
  generationDisabledReason,
}: {
  mapStatus: MapStatus
  progress?: number
  isOnline: boolean
  generatedAtDate?: string
  generatedAtTime?: string
  areaSize?: string
  robotId?: string
  imageUrl?: string | null
  imageVersion?: string | number | null
  mapName?: string | null
  mapActions?: React.ReactNode
  maps: StoredMap[]
  onStartGeneration?: () => void
  onStopGeneration?: () => void
  onSelectMap?: (mapId: string) => void
  onDeleteMap?: (mapId: string) => void
  detectionEnabled?: boolean
  detectionDisabledReason?: string
  isDetecting: boolean
  detectionLoading: boolean
  onStartDetect: () => Promise<boolean> | void
  onStopDetect: () => Promise<boolean> | void
  networkOnline: boolean
  robotOnline: boolean
  mapReady: boolean
  isGeneratingMap?: boolean
  generationEnabled?: boolean
  generationDisabledReason?: string
}) {
  const isDisabled = !isOnline
  const enabled = detectionEnabled ?? true
  const canGenerate = generationEnabled && !!onStartGeneration && !isGeneratingMap
  const canStart = enabled && networkOnline && robotOnline && mapReady
  const canStop = enabled && networkOnline && robotOnline
  const startBlockMessage = !enabled
    ? (detectionDisabledReason ?? "현재 이 기능은 사용할 수 없습니다.")
    : !networkOnline
    ? "네트워크 연결 후 탐지를 시작할 수 있습니다."
    : !robotOnline
    ? "차량이 오프라인입니다. 연결 후 다시 시도하세요."
    : !mapReady
    ? "지도가 준비된 후 탐지를 시작할 수 있습니다."
    : "탐지를 시작할 수 없습니다."
  const stopBlockMessage = !enabled
    ? (detectionDisabledReason ?? "현재 이 기능은 사용할 수 없습니다.")
    : !networkOnline
    ? "네트워크 연결 후 탐지를 중지할 수 있습니다."
    : "차량이 오프라인입니다. 연결 후 다시 시도하세요."

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

          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
            {mapActions}
            {maps.length > 0 && onSelectMap && onDeleteMap && (
              <MapHistoryDialog
                maps={maps}
                onSelect={onSelectMap}
                onDelete={onDeleteMap}
                disabled={isGeneratingMap}
              />
            )}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <OfflineGuardButton
                className={`h-8 px-3 text-xs w-full sm:w-auto ${
                  isDetecting ? "bg-secondary hover:bg-secondary/80" : "bg-primary hover:bg-primary/90"
                }`}
                onClick={() => onStartDetect()}
                disabled={isDetecting || detectionLoading || !canStart || isGeneratingMap}
                offlineMessage={startBlockMessage}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                탐지 시작
              </OfflineGuardButton>
              <OfflineGuardButton
                variant="destructive"
                className="h-8 px-3 text-xs w-full sm:w-auto"
                onClick={() => onStopDetect()}
                disabled={!isDetecting || detectionLoading || !canStop || isGeneratingMap}
                offlineMessage={stopBlockMessage}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                탐지 중지
              </OfflineGuardButton>
            </div>
            {isGeneratingMap && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0">생성 중</Badge>
            )}
            {mapStatus === "completed" && !isGeneratingMap && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">완료됨</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4">
        <MapVisualization
          status={mapStatus}
          progress={progress}
          imageUrl={imageUrl}
          imageVersion={imageVersion}
          mapName={mapName}
        />
        <MapMetadataPanel
          status={mapStatus}
          generatedAtDate={generatedAtDate}
          generatedAtTime={generatedAtTime}
          areaSize={areaSize}
          robotId={robotId}
        />

        <div className="flex gap-2 sm:gap-3">
          <Button
            className="flex-1 h-9 text-xs sm:h-10 sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onStartGeneration}
            disabled={isDisabled || !canGenerate}
          >
            {isGeneratingMap ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                지도 생성 중
              </>
            ) : mapStatus === "completed" ? (
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
          <Button
            variant="destructive"
            className="flex-1 h-9 text-xs sm:h-10 sm:text-sm"
            onClick={onStopGeneration}
            disabled={isDisabled || !onStopGeneration}
          >
            <Square className="mr-2 h-4 w-4" />
            생성 중단
          </Button>

          {mapStatus === "completed" && (
            <Button asChild variant="outline" className="flex-1 h-9 text-xs sm:h-10 sm:text-sm bg-transparent">
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
            <p className="text-xs text-amber-400">차량이 오프라인이면 지도 생성이 불가합니다.</p>
          </div>
        )}
          {isGeneratingMap && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Info className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-amber-400">
                지도 생성 중에는 차량이 온라인 상태를 유지해야 합니다. AUTO 모드를 권장합니다.
              </p>
            </div>
          )}
          {!generationEnabled && (
          <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {generationDisabledReason ?? "지도 생성은 차량에서 수행합니다."}
            </p>
          </div>
        )}
        {!generationEnabled && (
          <div className="flex items-center gap-2 p-3 bg-secondary/20 border border-border rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              지도 생성은 차량에서 수행됩니다. “지도 생성 시작”을 누르면 차량에 생성 요청이 전송됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Alerts & Detections (same as your code)
// ============================================

function AlertItem({
  alert,
  onRead,
}: {
  alert: SystemAlert
  onRead?: (id: string) => void
}) {
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
    <div className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${config.bg}`}>
      <Icon className={`h-4 w-4 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{alert.title}</p>
          {!alert.isRead && <Badge variant="secondary" className="text-[10px]">NEW</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
      </div>
      {!alert.isRead && onRead && (
        <Button variant="outline" size="sm" onClick={() => onRead(alert.id)}>
          읽음
        </Button>
      )}
    </div>
  )
}

function SystemAlertsSection({
  alerts,
  isLoading,
  onRead,
  onReadAll,
}: {
  alerts: SystemAlert[]
  isLoading: boolean
  onRead?: (id: string) => void
  onReadAll?: () => void
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">시스템 알림</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {alerts.filter((a) => !a.isRead).length}개
            </Badge>
            {onReadAll && alerts.some((a) => !a.isRead) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={onReadAll}>
                전체 읽음
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts.filter((a) => !a.isRead).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">알림이 없습니다.</p>
        ) : (
          alerts.filter((a) => !a.isRead).slice(0, 3).map((alert) => (
            <AlertItem key={alert.id} alert={alert} onRead={onRead} />
          ))
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

// RecentDetectionsSection removed per request

// ============================================
// Page Component
// ============================================

export default function HomePage() {
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | "unknown">("unknown")
  const { toast } = useToast()
  const [carList, setCarList] = React.useState<CarSummary[]>([])
  const [carLoading, setCarLoading] = React.useState(false)
  const [carError, setCarError] = React.useState<string | null>(null)
  const [claimCode, setClaimCode] = React.useState("")
  const [claimNickname, setClaimNickname] = React.useState("")
  const [nicknameDraft, setNicknameDraft] = React.useState("")
  const [isClaiming, setIsClaiming] = React.useState(false)
  const [isUnclaiming, setIsUnclaiming] = React.useState(false)
  const [isSavingNickname, setIsSavingNickname] = React.useState(false)
  const [claimConfirmOpen, setClaimConfirmOpen] = React.useState(false)
  const [unclaimConfirmOpen, setUnclaimConfirmOpen] = React.useState(false)
  const [createMapOpen, setCreateMapOpen] = React.useState(false)
  const [isCreatingMap, setIsCreatingMap] = React.useState(false)
  const [mapDraftError, setMapDraftError] = React.useState<string | null>(null)
  const [mapFieldErrors, setMapFieldErrors] = React.useState<Record<string, string>>({})
  const [mapDraft, setMapDraft] = React.useState({
    name: "",
    imageUrl: "",
    width: "",
    height: "",
    resolution: "",
    originX: "",
    originY: "",
  })
  const [mapGenerateOpen, setMapGenerateOpen] = React.useState(false)
  const [mapGenerateName, setMapGenerateName] = React.useState("")
  const [mapGenerateError, setMapGenerateError] = React.useState<string | null>(null)
  const [manualGenerating, setManualGenerating] = React.useState(false)
  const [mapRenderPending, setMapRenderPending] = React.useState<{
    startedAt: number
    lastImageUrl: string | null
  } | null>(null)
  const mapRenderTimerRef = React.useRef<number | null>(null)
  const mapRenderAttemptsRef = React.useRef(0)

  const { carId, setCarId, refresh: refreshPrimaryCar, error: primaryCarError } = usePrimaryCarId()
  const carStatus = useCarStatus(carId ?? 0, { enabled: !!carId, intervalMs: 1000 })

  const realDetections = useRecentDetections(carId, 50)
  const realAlerts = useAlerts()
  const { setExternalAlerts } = realAlerts
  const [fcmAlerts, setFcmAlerts] = useState<SystemAlert[]>([])
  const { isOnline: networkOnline } = useNetworkStatus()
  const carMaps = useCarMaps(carId)
  const currentMap = carMaps.currentMap
  const refreshCarsRequestIdRef = React.useRef(0)
  const refreshCarsInFlightRef = React.useRef(false)
  const refreshCarsQueuedRef = React.useRef(false)

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMatch = window.matchMedia("(display-mode: standalone)").matches
      const isIosStandalone = Boolean((window.navigator as any).standalone)
      setIsStandalone(isStandaloneMatch || isIosStandalone)
    }

    checkStandalone()
    const media = window.matchMedia("(display-mode: standalone)")
    const handler = () => checkStandalone()
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler)
    } else if (typeof media.addListener === "function") {
      media.addListener(handler)
    }
    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handler)
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handler)
      }
    }
  }, [])

  const refreshCars = React.useCallback(async () => {
    if (!networkOnline) {
      setCarLoading(false)
      setCarError("오프라인 상태입니다.")
      return
    }

    if (refreshCarsInFlightRef.current) {
      refreshCarsQueuedRef.current = true
      return
    }

    refreshCarsInFlightRef.current = true
    const requestId = ++refreshCarsRequestIdRef.current
    setCarLoading(true)
    try {
      const list = await carApi.getMyCars()
      if (refreshCarsRequestIdRef.current !== requestId) return
      setCarList(list)
      setCarError(null)
    } catch (e: any) {
      if (refreshCarsRequestIdRef.current !== requestId) return
      setCarError("차량 목록을 불러오지 못했습니다.")
      setCarList([])
    } finally {
      if (refreshCarsRequestIdRef.current === requestId) {
        setCarLoading(false)
      }
      refreshCarsInFlightRef.current = false
      if (refreshCarsQueuedRef.current) {
        refreshCarsQueuedRef.current = false
        refreshCars()
      }
    }
  }, [networkOnline])

  useEffect(() => {
    refreshCars()
  }, [refreshCars])

  useEffect(() => {
    if (networkOnline) refreshCars()
  }, [networkOnline, refreshCars])

  const primaryCar = carList.find((car) => car.carId === carId) ?? carList[0] ?? null

  useEffect(() => {
    setNicknameDraft(primaryCar?.nickname ?? "")
  }, [primaryCar?.carId, primaryCar?.nickname])

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unknown")
      return
    }
    setNotificationPermission(Notification.permission)
  }, [])

  React.useEffect(() => {
    if (!mapRenderPending) {
      if (mapRenderTimerRef.current) {
        window.clearInterval(mapRenderTimerRef.current)
        mapRenderTimerRef.current = null
      }
      mapRenderAttemptsRef.current = 0
      return
    }

    const intervalMs = 5000
    const maxAttempts = 120
    mapRenderAttemptsRef.current = 0

    const tick = async () => {
      mapRenderAttemptsRef.current += 1
      await carMaps.refresh()
    if (mapRenderAttemptsRef.current >= maxAttempts) {
      setMapRenderPending(null)
      setManualGenerating(false)
    }
    }

    const id = window.setInterval(() => {
      tick()
    }, intervalMs)
    mapRenderTimerRef.current = id

    return () => {
      if (mapRenderTimerRef.current) {
        window.clearInterval(mapRenderTimerRef.current)
        mapRenderTimerRef.current = null
      }
    }
  }, [carMaps, mapRenderPending])

  React.useEffect(() => {
    if (!mapRenderPending) return
    if (!currentMap?.imageUrl) return
    if (currentMap.imageUrl === mapRenderPending.lastImageUrl) return

    const isRendered = currentMap.imageUrl.includes("maps/rendered")
    if (isRendered) {
      setMapRenderPending(null)
      setManualGenerating(false)
      toastSuccess(toast, "지도 변환 완료", "새 지도가 적용되었습니다.")
      return
    }

    setMapRenderPending((prev) =>
      prev ? { ...prev, lastImageUrl: currentMap.imageUrl } : prev
    )
  }, [currentMap?.imageUrl, mapRenderPending, toast])

  useEffect(() => {
    if (!createMapOpen) return
    setMapDraft((prev) => {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      return {
        name: prev.name || `MAP-${stamp}`,
        imageUrl: prev.imageUrl || currentMap?.imageUrl || "",
        width: prev.width || (currentMap?.width ? String(currentMap.width) : ""),
        height: prev.height || (currentMap?.height ? String(currentMap.height) : ""),
        resolution: prev.resolution || (currentMap?.resolution ? String(currentMap.resolution) : ""),
        originX: prev.originX || (currentMap?.originX != null ? String(currentMap.originX) : ""),
        originY: prev.originY || (currentMap?.originY != null ? String(currentMap.originY) : ""),
      }
    })
  }, [
    createMapOpen,
    currentMap?.imageUrl,
    currentMap?.width,
    currentMap?.height,
    currentMap?.resolution,
    currentMap?.originX,
    currentMap?.originY,
  ])

  const handleRequestNotification = async () => {
    if (typeof Notification === "undefined") return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  let status: CarStatus | null = null
  let recentDetections: Detection[] = []
  let stats: DetectionStats | null = null
  let alerts: SystemAlert[] = []

  let statusLoading = false
  let detectionsLoading = false
  let alertsLoading = false

  status = carStatus.data
  statusLoading = carStatus.isLoading
  const isGeneratingMap = Boolean(mapRenderPending || manualGenerating)

  recentDetections = realDetections.recentDetections
  const today = getKstNow()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfWeek = new Date(startOfToday)
  const day = startOfWeek.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday)
  const todayCount = recentDetections.filter((d) => {
    if (!d.timestamp) return false
    const t = parseBackendDate(d.timestamp)
    if (!t) return false
    return t >= startOfToday
  }).length
  const weekCount = recentDetections.filter((d) => {
    if (!d.timestamp) return false
    const t = parseBackendDate(d.timestamp)
    if (!t) return false
    return t >= startOfWeek
  }).length
  const last = recentDetections[0]
  stats = {
    todayCount,
    weekCount,
    falseAlarmRate: 0,
    lastDetectionTime: last?.time ?? "-",
  }
  alerts = realAlerts.alerts

  detectionsLoading = realDetections.isLoading
  alertsLoading = realAlerts.isLoading
  const hasTopErrors = Boolean(primaryCarError || carStatus.error || realDetections.error || realAlerts.error)

  const computedAlerts = React.useMemo(() => {
    const list: SystemAlert[] = []
    const now = Date.now()
    if (!isGeneratingMap && status && !status.isOnline) {
      list.push({
        id: "offline",
        type: "error",
        title: "차량 오프라인",
        message: "차량이 오프라인입니다. 전원/네트워크를 확인하세요.",
        timestamp: new Date().toISOString(),
        isRead: false,
      })
    }
    if (!isGeneratingMap && status?.updatedAt) {
      const updatedDate = parseBackendDate(status.updatedAt)
      const updated = updatedDate ? updatedDate.getTime() : NaN
      if (!Number.isNaN(updated) && now - updated > 2 * 60 * 1000) {
        list.push({
          id: "stale",
          type: "warning",
          title: "상태 갱신 지연",
          message: "차량 상태 갱신이 지연되고 있습니다.",
          timestamp: new Date().toISOString(),
          isRead: false,
        })
      }
    }
    if (!currentMap) {
      list.push({
        id: "map",
        type: "info",
        title: "지도 준비 필요",
        message: "지도 생성 또는 선택이 필요합니다.",
        timestamp: new Date().toISOString(),
        isRead: false,
      })
    }
    return list
  }, [status?.isOnline, status?.updatedAt, currentMap, isGeneratingMap])

  React.useEffect(() => {
    setExternalAlerts([...fcmAlerts, ...computedAlerts])
  }, [computedAlerts, fcmAlerts, setExternalAlerts])

  React.useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | undefined
    listenForegroundMessages((payload) => {
      if (!mounted) return
      const title =
        payload?.notification?.title ?? payload?.data?.title ?? "탐지 알림"
      const message =
        payload?.notification?.body ?? payload?.data?.body ?? "탐지가 발생했습니다."
      const id = payload?.messageId
        ? `fcm-${payload.messageId}`
        : `fcm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setFcmAlerts((prev) => [
        {
          id,
          type: "warning",
          title,
          message,
          timestamp: new Date().toISOString(),
          isRead: false,
        },
        ...prev,
      ])
    }).then((unsub) => {
      unsubscribe = unsub
    })
    return () => {
      mounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  alerts = realAlerts.alerts


  const robotOnline = isGeneratingMap ? true : status?.isOnline ?? false
  const mapReady = Boolean(currentMap)
  const areaSize =
    currentMap && currentMap.width && currentMap.height && currentMap.resolution
      ? `${(currentMap.width * currentMap.resolution).toFixed(1)}m x ${(currentMap.height * currentMap.resolution).toFixed(1)}m`
      : "-"
  const formatDateLine = (value?: string | null) => {
    if (!value) return "-"
    const date = parseBackendDate(value)
    if (!date) return value
    return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
  }
  const formatTimeLine = (value?: string | null) => {
    if (!value) return "-"
    const date = parseBackendDate(value)
    if (!date) return "-"
    return date.toLocaleTimeString("ko-KR", { hour: "numeric", hour12: true, timeZone: "Asia/Seoul" })
  }
  const generatedAtDate = formatDateLine(currentMap?.createdAt ?? null)
  const generatedAtTime = formatTimeLine(currentMap?.createdAt ?? null)
  const mapHistoryItems: StoredMap[] = carMaps.maps.map((m) => ({
    id: String(m.id),
    generatedAt: (parseBackendDate(m.createdAt) ?? new Date(m.createdAt)).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    }),
    areaSize:
      m.width && m.height && m.resolution
        ? `${(m.width * m.resolution).toFixed(1)}m x ${(m.height * m.resolution).toFixed(1)}m`
        : "-",
    robotId: carId ? String(carId) : "-",
    detectionsCount: 0,
    mapSeed: Number(m.id),
  }))

  const isDetecting = false
  const detectionLoading = false

  const onStart = React.useCallback(async () => {
      toastError(toast, "탐지 시작 불가", "탐지 시작/중지 API 연동이 필요합니다.")
    return false
  }, [toast])

  const onStop = React.useCallback(async () => {
      toastError(toast, "탐지 중지 불가", "탐지 시작/중지 API 연동이 필요합니다.")
    return false
  }, [toast])

  const handleClaim = async () => {
    if (!claimCode.trim()) {
      setCarError("클레임 코드를 입력해 주세요.")
      toastError(toast, "차량 등록 실패", "클레임 코드를 입력해 주세요.")
      return
    }
    setIsClaiming(true)
    try {
      await carApi.claimCar(claimCode.trim(), claimNickname.trim() || undefined)
      setClaimCode("")
      setClaimNickname("")
      await refreshCars()
      await refreshPrimaryCar()
      toastSuccess(
        toast,
        "차량 등록 완료",
        claimNickname.trim()
          ? `닉네임 “${claimNickname.trim()}”으로 등록되었습니다.`
          : "차량이 성공적으로 등록되었습니다."
      )
    } catch (e: any) {
      const message = getErrorMessage(e, "차량 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.")
      setCarError(message)
      toastError(toast, "차량 등록 실패", message)
    } finally {
      setIsClaiming(false)
    }
  }

  const handleUnclaim = async () => {
    if (!primaryCar) return
    setIsUnclaiming(true)
    try {
      await carApi.unclaimCar(primaryCar.carId)
      await refreshCars()
      await refreshPrimaryCar()
      toastSuccess(toast, "차량 연결 해제", `${primaryCar.nickname} (${primaryCar.carId}) 연결이 해제되었습니다.`)
    } catch (e: any) {
      const message = getErrorMessage(e, "차량 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.")
      setCarError(message)
      toastError(toast, "차량 해제 실패", message)
    } finally {
      setIsUnclaiming(false)
    }
  }

  const handleSaveNickname = async () => {
    if (!primaryCar) return
    const nextName = nicknameDraft.trim()
    if (!nextName) {
      setCarError("닉네임을 입력해 주세요.")
      toastError(toast, "닉네임 저장 실패", "닉네임을 입력해 주세요.")
      return
    }
    setIsSavingNickname(true)
    try {
      await carApi.updateCarNickname(primaryCar.carId, nextName)
      await refreshCars()
      toastSuccess(toast, "닉네임 저장 완료", `“${nextName}”으로 변경되었습니다.`)
    } catch (e: any) {
      const message = "닉네임 수정에 실패했습니다. 잠시 후 다시 시도해 주세요."
      setCarError(message)
      toastError(toast, "닉네임 저장 실패", "잠시 후 다시 시도해 주세요.")
    } finally {
      setIsSavingNickname(false)
    }
  }

  const resetMapDraft = () => {
    setMapDraft({
      name: "",
      imageUrl: "",
      width: "",
      height: "",
      resolution: "",
      originX: "",
      originY: "",
    })
    setMapDraftError(null)
    setMapFieldErrors({})
  }

  const handleOpenGenerateDialog = () => {
    if (mapRenderPending) {
      toastInfo(toast, "지도 생성 중", "현재 지도 생성이 진행 중입니다.")
      return
    }
    if (!carId) {
      toastError(toast, "지도 생성 실패", "차량을 먼저 선택해 주세요.")
      return
    }
    setMapGenerateName("")
    setMapGenerateError(null)
    setMapGenerateOpen(true)
  }

  const handleConfirmGenerate = async () => {
    const name = mapGenerateName.trim()
    if (!name) {
      setMapGenerateError("지도 이름을 입력해 주세요.")
      return
    }
    const ok = await carMaps.generateMap(name)
    if (ok) {
      toastSuccess(toast, "지도 생성 요청", "차량에 지도 생성을 요청했습니다.")
      setManualGenerating(true)
      setMapRenderPending({
        startedAt: Date.now(),
        lastImageUrl: currentMap?.imageUrl ?? null,
      })
      setMapGenerateOpen(false)
    } else {
      toastError(toast, "지도 생성 실패", "잠시 후 다시 시도해 주세요.")
    }
  }

  const handleCreateMap = async () => {
    if (!carId) {
      toastError(toast, "지도 등록 실패", "차량을 먼저 선택해 주세요.")
      return
    }
    const width = Number(mapDraft.width)
    const height = Number(mapDraft.height)
    const resolution = Number(mapDraft.resolution)
    const originX = Number(mapDraft.originX)
    const originY = Number(mapDraft.originY)

    if (!mapDraft.name.trim()) {
      setMapDraftError("지도 이름을 입력해 주세요.")
      setMapFieldErrors({ name: "지도 이름을 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "지도 이름을 입력해 주세요.")
      return
    }
    if (!mapDraft.imageUrl.trim()) {
      setMapDraftError("이미지 URL을 입력해 주세요.")
      setMapFieldErrors({ imageUrl: "이미지 URL을 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "이미지 URL을 입력해 주세요.")
      return
    }
    if (!/^(https?:\/\/|gs:\/\/)/i.test(mapDraft.imageUrl.trim())) {
      setMapDraftError("이미지 URL은 http(s):// 또는 gs://로 시작해야 합니다.")
      setMapFieldErrors({ imageUrl: "http(s):// 또는 gs:// 형식을 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "이미지 URL 형식을 확인해 주세요.")
      return
    }
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setMapDraftError("지도 크기(width/height)를 입력해 주세요.")
      setMapFieldErrors({ width: "가로/세로 값을 확인해 주세요.", height: "가로/세로 값을 확인해 주세요." })
      toastError(toast, "지도 등록 실패", "지도 크기(width/height)를 입력해 주세요.")
      return
    }
    if (!Number.isFinite(resolution) || resolution <= 0) {
      setMapDraftError("해상도(resolution)를 입력해 주세요.")
      setMapFieldErrors({ resolution: "해상도를 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "해상도(resolution)를 입력해 주세요.")
      return
    }
    if (resolution < 0.01 || resolution > 1) {
      setMapDraftError("해상도는 0.01 ~ 1.0 범위여야 합니다.")
      setMapFieldErrors({ resolution: "0.01 ~ 1.0 범위로 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "해상도 범위를 확인해 주세요.")
      return
    }
    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      setMapDraftError("origin 좌표를 입력해 주세요.")
      setMapFieldErrors({ originX: "origin 좌표를 입력해 주세요.", originY: "origin 좌표를 입력해 주세요." })
      toastError(toast, "지도 등록 실패", "origin 좌표를 입력해 주세요.")
      return
    }
    if (Math.abs(originX) > 1000 || Math.abs(originY) > 1000) {
      setMapDraftError("origin 좌표는 -1000 ~ 1000 범위여야 합니다.")
      setMapFieldErrors({ originX: "좌표 범위를 확인해 주세요.", originY: "좌표 범위를 확인해 주세요." })
      toastError(toast, "지도 등록 실패", "origin 좌표 범위를 확인해 주세요.")
      return
    }

    setIsCreatingMap(true)
    try {
      const created = await carMaps.createMap({
        name: mapDraft.name.trim(),
        imageUrl: mapDraft.imageUrl.trim(),
        width,
        height,
        resolution,
        originX,
        originY,
      })
      if (created?.id) {
        await carMaps.selectMap(created.id)
      }
      toastSuccess(toast, "지도 등록 완료", "지도 메타데이터가 등록되었고 현재 지도로 설정되었습니다.")
      setCreateMapOpen(false)
      resetMapDraft()
    } catch (e: any) {
      setMapDraftError("지도 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.")
      setMapFieldErrors({})
      toastError(toast, "지도 등록 실패", "잠시 후 다시 시도해 주세요.")
    } finally {
      setIsCreatingMap(false)
    }
  }


  const createMapAction = (
    <Dialog
      open={createMapOpen}
      onOpenChange={(open) => {
        setCreateMapOpen(open)
        if (!open) resetMapDraft()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent w-full sm:w-auto" disabled={!carId}>
          <MapIcon className="mr-2 h-4 w-4" />
          지도 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>지도 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            차량에서 지도 생성이 완료된 뒤, 메타데이터를 입력해 등록합니다.
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {currentMap ? "현재 지도 메타데이터를 입력칸에 채웁니다." : "현재 지도 정보가 없습니다."}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-transparent"
              disabled={!currentMap}
              onClick={() => {
                if (!currentMap) return
                setMapDraft((prev) => ({
                  ...prev,
                  imageUrl: currentMap.imageUrl ?? "",
                  width: String(currentMap.width ?? ""),
                  height: String(currentMap.height ?? ""),
                  resolution: String(currentMap.resolution ?? ""),
                  originX: String(currentMap.originX ?? ""),
                  originY: String(currentMap.originY ?? ""),
                }))
              }}
            >
              현재 지도 값 불러오기
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">지도 이름</p>
            <Input
              value={mapDraft.name}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[,\s]+/g, " ").trimStart()
                setMapDraft((prev) => ({ ...prev, name: cleaned }))
                setMapDraftError(null)
                setMapFieldErrors((prev) => ({ ...prev, name: "" }))
              }}
              placeholder="예: 3층 복도"
              className={`bg-input border-border ${mapFieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {mapFieldErrors.name && <p className="text-[11px] text-red-400">{mapFieldErrors.name}</p>}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">이미지 URL</p>
              <Input
                value={mapDraft.imageUrl}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\s+/g, "")
                  setMapDraft((prev) => ({ ...prev, imageUrl: cleaned }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, imageUrl: "" }))
                }}
                placeholder="https://..."
                className={`bg-input border-border ${mapFieldErrors.imageUrl ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
            <p className="text-[11px] text-muted-foreground">
              서버에서 이미지 URL을 필수로 요구합니다. http(s):// 또는 gs:// 형식만 허용됩니다.
            </p>
            {mapFieldErrors.imageUrl && <p className="text-[11px] text-red-400">{mapFieldErrors.imageUrl}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">가로 (px)</p>
              <Input
                type="number"
                value={mapDraft.width}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, "")
                  setMapDraft((prev) => ({ ...prev, width: val }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, width: "" }))
                }}
                className={`bg-input border-border ${mapFieldErrors.width ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">예: 800</p>
              {mapFieldErrors.width && <p className="text-[11px] text-red-400">{mapFieldErrors.width}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">세로 (px)</p>
              <Input
                type="number"
                value={mapDraft.height}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, "")
                  setMapDraft((prev) => ({ ...prev, height: val }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, height: "" }))
                }}
                className={`bg-input border-border ${mapFieldErrors.height ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">예: 600</p>
              {mapFieldErrors.height && <p className="text-[11px] text-red-400">{mapFieldErrors.height}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">해상도 (m/px)</p>
              <Input
                type="number"
                step="0.01"
                value={mapDraft.resolution}
                onChange={(e) => {
                  const val = e.target.value
                  const normalized = val && !Number.isNaN(Number(val)) ? Number(val).toFixed(2) : val
                  setMapDraft((prev) => ({ ...prev, resolution: normalized }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, resolution: "" }))
                }}
                className={`bg-input border-border ${mapFieldErrors.resolution ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">범위: 0.01 ~ 1.0 (예: 0.05)</p>
              {mapFieldErrors.resolution && <p className="text-[11px] text-red-400">{mapFieldErrors.resolution}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Origin X</p>
              <Input
                type="number"
                step="0.1"
                value={mapDraft.originX}
                onChange={(e) => {
                  const val = e.target.value
                  const normalized = val && !Number.isNaN(Number(val)) ? Number(val).toFixed(1) : val
                  setMapDraft((prev) => ({ ...prev, originX: normalized }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, originX: "" }))
                }}
                className={`bg-input border-border ${mapFieldErrors.originX ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">범위: -1000 ~ 1000 (예: -10.0)</p>
              {mapFieldErrors.originX && <p className="text-[11px] text-red-400">{mapFieldErrors.originX}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Origin Y</p>
              <Input
                type="number"
                step="0.1"
                value={mapDraft.originY}
                onChange={(e) => {
                  const val = e.target.value
                  const normalized = val && !Number.isNaN(Number(val)) ? Number(val).toFixed(1) : val
                  setMapDraft((prev) => ({ ...prev, originY: normalized }))
                  setMapDraftError(null)
                  setMapFieldErrors((prev) => ({ ...prev, originY: "" }))
                }}
                className={`bg-input border-border ${mapFieldErrors.originY ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">범위: -1000 ~ 1000 (예: -8.0)</p>
              {mapFieldErrors.originY && <p className="text-[11px] text-red-400">{mapFieldErrors.originY}</p>}
            </div>
          </div>
          {mapDraftError && (
            <div className="text-xs text-red-400">{mapDraftError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateMapOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateMap} disabled={isCreatingMap}>
              등록
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  // 탐지 시작/중지 API 연동 시 여기에 상태 연동 로직 추가

  return (
    <div className="p-3 sm:p-4 lg:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">홈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            차량 상태 및 감지 현황을 확인하세요
          </p>
        </div>

        {hasTopErrors && (
          <div className="mb-4 space-y-2">
            <ErrorAlert title="차량 정보 불러오기 실패" message={primaryCarError} />
            <ErrorAlert title="차량 상태 불러오기 실패" message={carStatus.error} />
            <ErrorAlert title="최근 탐지 불러오기 실패" message={realDetections.error} />
            <ErrorAlert title="알림 불러오기 실패" message={realAlerts.error} />
          </div>
        )}

        {!isStandalone && (
          <Alert className="mb-6">
            <AlertTitle>모바일 사용 팁</AlertTitle>
            <AlertDescription>
              크롬 메뉴에서 “홈 화면에 추가”로 설치하면 앱처럼 실행되고 알림 수신이 더 안정적입니다. 알림 권한도 꼭
              허용해 주세요.
            </AlertDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                알림 권한: {notificationPermission === "unknown" ? "확인 불가" : notificationPermission}
              </Badge>
              {notificationPermission !== "granted" && (
                <Button size="sm" variant="outline" onClick={handleRequestNotification}>
                  알림 권한 요청
                </Button>
              )}
            </div>
          </Alert>
        )}

        <div className="mb-4 sm:mb-6">
          <RobotStatusSection status={status} stats={stats} isLoading={statusLoading} />
        </div>

        {(() => {
          const mapSection = (
            <div className="space-y-4">
              <ErrorAlert title="지도 불러오기 실패" message={carMaps.error} />
              <MapGenerationSection
                mapStatus={currentMap ? "completed" : "no_map"}
                progress={0}
                isOnline={robotOnline}
                generatedAtDate={generatedAtDate}
                generatedAtTime={generatedAtTime}
                areaSize={areaSize}
                robotId={carId ? String(carId) : undefined}
                imageUrl={currentMap?.imageUrl ?? null}
                imageVersion={currentMap?.id ?? currentMap?.createdAt ?? null}
                mapName={currentMap?.name ?? null}
                mapActions={null}
                maps={mapHistoryItems}
                onStartGeneration={handleOpenGenerateDialog}
                onStopGeneration={undefined}
                onSelectMap={(id) => carMaps.selectMap(Number(id))}
                onDeleteMap={(id) => carMaps.deleteMap(Number(id))}
                generationEnabled={true}
                detectionEnabled={false}
                detectionDisabledReason="탐지 시작/중지 API 연동이 필요합니다."
                isDetecting={isDetecting}
                detectionLoading={detectionLoading}
                onStartDetect={onStart}
                onStopDetect={onStop}
                networkOnline={networkOnline}
                robotOnline={robotOnline}
                mapReady={mapReady}
                isGeneratingMap={isGeneratingMap}
              />
              <Dialog open={mapGenerateOpen} onOpenChange={setMapGenerateOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>지도 이름 입력</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      value={mapGenerateName}
                      onChange={(e) => {
                        setMapGenerateName(e.target.value)
                        setMapGenerateError(null)
                      }}
                      placeholder="지도 이름을 입력하세요"
                      className={mapGenerateError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {mapGenerateError && <p className="text-[11px] text-red-400">{mapGenerateError}</p>}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setMapGenerateOpen(false)}>
                        취소
                      </Button>
                      <Button onClick={handleConfirmGenerate}>생성 시작</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )

          const carManagementSection = (
            <>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">차량 관리</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {carLoading ? (
                    <div className="text-sm text-muted-foreground">불러오는 중...</div>
                  ) : (
                    <>
                      {primaryCar ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">현재 차량</p>
                            <Badge variant="secondary">{primaryCar.nickname || "내 차"}</Badge>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">차량 선택</p>
                            <Select
                              value={primaryCar ? String(primaryCar.carId) : ""}
                              onValueChange={(value) => {
                                const nextId = Number(value)
                                if (Number.isFinite(nextId)) {
                                  setCarId(nextId)
                                }
                              }}
                            >
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue placeholder="차량 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {carList.map((car) => (
                                  <SelectItem key={car.carId} value={String(car.carId)}>
                                    {car.nickname || "내 차"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">닉네임</p>
                            <div className="flex gap-2">
                              <Input
                                value={nicknameDraft}
                                onChange={(e) => setNicknameDraft(e.target.value)}
                                placeholder="차량 닉네임"
                                className="bg-input border-border"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveNickname}
                                disabled={isSavingNickname || nicknameDraft.trim() === primaryCar.nickname}
                              >
                                저장
                              </Button>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setUnclaimConfirmOpen(true)}
                            disabled={isUnclaiming}
                          >
                            차량 연결 해제
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">등록된 차량이 없습니다.</p>
                      )}

                      <div className="h-px bg-border" />

                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">차량 등록</p>
                        <Input
                          value={claimCode}
                          onChange={(e) => {
                            setClaimCode(e.target.value)
                            if (carError) setCarError(null)
                          }}
                          placeholder="클레임 코드"
                          className="bg-input border-border"
                        />
                        <Input
                          value={claimNickname}
                          onChange={(e) => {
                            setClaimNickname(e.target.value)
                            if (carError) setCarError(null)
                          }}
                          placeholder="닉네임 (선택)"
                          className="bg-input border-border"
                        />
                        <Button
                          className="w-full"
                          onClick={() => {
                            if (!claimCode.trim()) {
                              setCarError("클레임 코드를 입력해 주세요.")
                              toastError(toast, "차량 등록 실패", "클레임 코드를 입력해 주세요.")
                              return
                            }
                            setClaimConfirmOpen(true)
                          }}
                          disabled={isClaiming}
                        >
                          차량 등록
                        </Button>
                      </div>
                    </>
                  )}

                  {carError && <p className="text-xs text-red-400">{carError}</p>}
                </CardContent>
              </Card>

              <AlertDialog open={claimConfirmOpen} onOpenChange={setClaimConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>차량을 등록할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      클레임 코드 {claimCode ? `“${claimCode}”` : ""}로 차량을 등록합니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClaim}>등록</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={unclaimConfirmOpen} onOpenChange={setUnclaimConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>차량 연결을 해제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {primaryCar
                        ? `${primaryCar.nickname} (${primaryCar.carId}) 연결이 해제됩니다.`
                        : "차량 연결을 해제합니다."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnclaim}>해제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )

          const alertsSection = (
            <SystemAlertsSection
              alerts={alerts}
              isLoading={alertsLoading}
              onRead={realAlerts.markAsRead}
              onReadAll={realAlerts.markAllAsRead}
            />
          )

          return (
            <>
              <div className="lg:hidden space-y-4">
                <Accordion type="multiple" defaultValue={["map"]} className="space-y-2">
                  <AccordionItem value="map">
                    <AccordionTrigger>지도 생성 및 내비게이션</AccordionTrigger>
                    <AccordionContent>{mapSection}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="car">
                    <AccordionTrigger>차량 관리</AccordionTrigger>
                    <AccordionContent>{carManagementSection}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="alerts">
                    <AccordionTrigger>시스템 알림</AccordionTrigger>
                    <AccordionContent>{alertsSection}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {mapSection}
                </div>
                <div className="space-y-6">
                  {carManagementSection}
                  {alertsSection}
                </div>
              </div>
            </>
          )
        })()}

        <div className="mt-6">
        </div>
      </div>
    </div>
  )
}


