"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bug,
  Calendar,
  Clock,
  Search,
  Filter,
  Map as MapIcon,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  X,
  Camera,
  Play,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
import { useDetectionHistory } from "@/hooks/useDetectionHistory"
import { useCarLogs } from "@/hooks/useCarLogs"
import { usePrimaryCarId } from "@/hooks/usePrimaryCarId"
import * as detectionApi from "@/core/api/detection"
import type { Detection, DetectionStats, DetectionStatus, DetectionType, DetectionHistoryFilters } from "@/core/types"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"


// ============================================
// Presentational Components (UI Only)
// ============================================

interface SummaryCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
  compact?: boolean
}

function SummaryCard({ title, value, icon: Icon, subtitle, variant = "default", compact = false }: SummaryCardProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-base sm:text-2xl font-semibold ${variantStyles[variant]}`}>{value}</p>
            {!compact && subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg bg-secondary ${variantStyles[variant]}`}>
            <Icon className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface StatsSectionProps {
  stats: DetectionStats | null
  isLoading: boolean
}

function StatsSection({ stats, isLoading }: StatsSectionProps) {
  if (isLoading || !stats) {
    return (
      <>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card border-border min-w-[140px]">
              <CardContent className="p-3 h-20 animate-pulse bg-secondary/20" />
            </Card>
          ))}
        </div>
        <div className="hidden lg:grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4 h-24 animate-pulse bg-secondary/20" />
            </Card>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        <div className="min-w-[120px]">
          <SummaryCard title="오늘 탐지" value={stats.todayCount} icon={Bug} subtitle="건" compact />
        </div>
        <div className="min-w-[120px]">
          <SummaryCard title="이번 주 탐지" value={stats.weekCount} icon={BarChart3} subtitle="건" compact />
        </div>
        <div className="min-w-[120px]">
          <SummaryCard title="마지막 탐지" value={stats.lastDetectionTime} icon={Clock} subtitle="오늘" compact />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-3 gap-4">
        <SummaryCard title="오늘 탐지" value={stats.todayCount} icon={Bug} subtitle="건" />
        <SummaryCard title="이번 주 탐지" value={stats.weekCount} icon={BarChart3} subtitle="건" />
        <SummaryCard title="마지막 탐지" value={stats.lastDetectionTime} icon={Clock} subtitle="오늘" />
      </div>
    </>
  )
}

interface StatusBadgeProps {
  status: DetectionStatus
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<DetectionStatus, { label: string; className: string; icon: React.ElementType }> = {
    detected: {
      label: "탐지됨",
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      icon: AlertTriangle,
    },
    confirmed: {
      label: "확인됨",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      icon: CheckCircle,
    },
    false_alarm: {
      label: "오탐",
      className: "bg-muted text-muted-foreground border-border",
      icon: XCircle,
    },
    resolved: {
      label: "해결됨",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle,
    },
    pending: {
      label: "확인 중",
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      icon: AlertTriangle,
    },
    dismissed: {
      label: "무시됨",
      className: "bg-muted text-muted-foreground border-border",
      icon: XCircle,
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge className={`${config.className} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

interface ConfidenceBadgeProps {
  confidence: number
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  // backend: 0~1, UI: 0~100
  const pct = confidence <= 1 ? confidence * 100 : confidence

  let colorClass = "text-emerald-400"
  if (pct < 60) colorClass = "text-red-400"
  else if (pct < 80) colorClass = "text-amber-400"

  return <span className={`font-mono font-medium ${colorClass}`}>{pct.toFixed(1)}%</span>
}


interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-muted-foreground bg-transparent">
          <Calendar className="h-4 w-4" />
          {startDate && endDate ? `${startDate} ~ ${endDate}` : "날짜 선택"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">시작 날짜</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">종료 날짜</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-input border-border"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DetailPanelProps {
  record: Detection | null
  open: boolean
  onClose: () => void
  onDelete?: (id: string) => void
}

function DetailPanel({ record, open, onClose, onDelete }: DetailPanelProps) {
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  const toAbsUrl = (url?: string | null) => {
    if (!url) return null
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return `${BASE_URL}${url}`
  }

  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  const snapshotUrl = record ? toAbsUrl(record.snapshotUrl ?? null) : null
  const videoUrl = record ? toAbsUrl(record.videoUrl ?? null) : null

  useEffect(() => {
    if (!snapshotUrl) {
      setSnapshotSrc(null)
      return
    }

    const controller = new AbortController()
    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
    let objectUrl: string | null = null

    setSnapshotLoading(true)
    fetch(snapshotUrl, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("snapshot fetch failed")
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setSnapshotSrc(objectUrl)
      })
      .catch(() => {
        setSnapshotSrc(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSnapshotLoading(false)
        }
      })

    return () => {
      controller.abort()
      setSnapshotLoading(false)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [snapshotUrl])

  useEffect(() => {
    if (!isVideoOpen || !videoUrl) {
      setVideoSrc(null)
      return
    }

    const controller = new AbortController()
    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
    let objectUrl: string | null = null

    setVideoLoading(true)
    fetch(videoUrl, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("video fetch failed")
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setVideoSrc(objectUrl)
      })
      .catch(() => {
        setVideoSrc(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setVideoLoading(false)
        }
      })

    return () => {
      controller.abort()
      setVideoLoading(false)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [isVideoOpen, videoUrl])

  if (!record) return null

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setIsVideoOpen(false)
          onClose()
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader className="border-b border-border px-3 sm:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 pr-10 sm:pr-12">
          <div className="flex items-center justify-between gap-3 pr-2">
            <div>
              <SheetTitle className="text-foreground text-sm sm:text-lg">탐지 상세 정보</SheetTitle>
              <SheetDescription className="text-muted-foreground text-[11px] sm:text-sm">탐지 ID: {record.id}</SheetDescription>
            </div>
            <div className="shrink-0">
              <StatusBadge status={record.status} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 sm:pt-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">탐지 시간</p>
              <p className="text-[11px] sm:text-sm font-medium text-foreground">
                {record.date} {record.time}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">차량 ID</p>
              <p className="text-[11px] sm:text-sm font-medium text-foreground">{record.robotId}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-6">
          <div className="flex justify-center">
            <div className="relative w-full max-w-[320px] sm:max-w-none sm:w-full aspect-[4/3] sm:aspect-[16/9] bg-secondary/50 rounded-lg overflow-hidden">
              {snapshotSrc ? (
                <img
                  src={snapshotSrc}
                  alt="snapshot"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Camera className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {snapshotLoading ? "스냅샷 불러오는 중..." : "탐지 순간 스냅샷"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-2 sm:p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">탐지 영상</p>
              <p className="hidden sm:block text-[11px] text-muted-foreground/70">탐지 전후 영상을 확인하세요.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVideoOpen(true)}
              disabled={!videoUrl}
            >
              <Play className="h-4 w-4 mr-1" />
              영상 확인
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">탐지 정보</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">탐지 유형</p>
                <p className="text-xs sm:text-sm font-medium text-foreground">{typeLabels[record.type] || record.type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">확신도</p>
                <ConfidenceBadge confidence={record.confidence} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">메모</label>
            <div className="min-h-[64px] rounded-md border border-border bg-secondary/20 p-3 text-xs sm:text-sm text-muted-foreground">
              {record.notes?.trim() ? record.notes : "메모가 없습니다."}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-border px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 gap-2">
          {onDelete && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onDelete(record.id)}
            >
              삭제
            </Button>
          )}
        </SheetFooter>
      </SheetContent>

      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>탐지 영상</DialogTitle>
            <DialogDescription>
              {record.date} {record.time} · {record.robotId}
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden">
            {videoSrc ? (
              <video className="absolute inset-0 w-full h-full" controls>
                <source src={videoSrc} />
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Play className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {videoLoading ? "영상 불러오는 중..." : "영상 준비 중..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-secondary mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">검색 결과가 없습니다</h3>
      <p className="text-sm text-muted-foreground max-w-sm">필터 조건을 변경하고 다시 검색해 주세요.</p>
    </div>
  )
}

interface DetectionTableProps {
  detections: Detection[]
  onViewDetail: (detection: Detection) => void
  isLoading: boolean
}

function DetectionTable({ detections, onViewDetail, isLoading }: DetectionTableProps) {
  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-secondary/20 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (detections.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {detections.map((record) => (
          <div key={record.id} className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{record.time}</p>
                <p className="text-xs text-muted-foreground">{record.date}</p>
              </div>
              <StatusBadge status={record.status} />
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-secondary">
                <Bug className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm text-foreground">{typeLabels[record.type] || record.type}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>확신도</span>
              <ConfidenceBadge confidence={record.confidence} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewDetail(record)}
              className="w-full"
            >
              상세 보기
            </Button>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">시간</TableHead>
              <TableHead className="text-muted-foreground">탐지 유형</TableHead>
              <TableHead className="text-muted-foreground">확신도</TableHead>
              <TableHead className="text-muted-foreground">상태</TableHead>
              <TableHead className="text-muted-foreground text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detections.map((record) => (
              <TableRow key={record.id} className="border-border">
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{record.time}</p>
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-secondary">
                      <Bug className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{typeLabels[record.type] || record.type}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <ConfidenceBadge confidence={record.confidence} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetail(record)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    상세 보기
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

function DashboardContent() {
  const searchParams = useSearchParams()
  const deepLinkId = searchParams.get("detectionId")
  const { toast } = useToast()
  const { carId } = usePrimaryCarId()
  const { logs, isLoading: logsLoading } = useCarLogs(carId)
  const {
    detections,
    stats,
    selectedDetection,
    filters,
    logId,
    useSearch,
    isLoading,
    error,
    setFilters,
    clearFilters,
    setLogId,
    setUseSearch,
    selectDetection,
    deleteDetection,
  } = useDetectionHistory(carId)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Detection | null>(null)
  const lastOpenedRef = React.useRef<string | null>(null)
  const [mapFilter, setMapFilter] = useState<string>("all")
  const [logSort, setLogSort] = useState<"desc" | "asc">("desc")

  const formatLogLabel = (log: {
    id: number
    startAt: string
    endAt: string | null
    status: string
    detectionCount: number
    mapName?: string | null
  }) => {
    const start = log.startAt ? new Date(log.startAt) : null
    const end = log.endAt ? new Date(log.endAt) : null
    const startLabel = start && !Number.isNaN(start.getTime()) ? start.toLocaleString("ko-KR") : log.startAt
    const endLabel = end && !Number.isNaN(end.getTime()) ? end.toLocaleString("ko-KR") : "-"
    const mapLabel = log.mapName ? ` · ${log.mapName}` : ""
    return `${startLabel} ~ ${endLabel} · ${log.status} · ${log.detectionCount}건${mapLabel}`
  }

  const mapOptions = React.useMemo(() => {
    const names = logs
      .map((log) => log.mapName)
      .filter((name): name is string => Boolean(name && name.trim()))
    return Array.from(new Set(names))
  }, [logs])

  const filteredLogs = React.useMemo(() => {
    if (mapFilter === "all") return logs
    return logs.filter((log) => log.mapName === mapFilter)
  }, [logs, mapFilter])

  const sortedLogs = React.useMemo(() => {
    const items = [...filteredLogs]
    items.sort((a, b) => {
      const aTime = new Date(a.startAt).getTime()
      const bTime = new Date(b.startAt).getTime()
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
        return logSort === "desc" ? bTime - aTime : aTime - bTime
      }
      return logSort === "desc" ? b.id - a.id : a.id - b.id
    })
    return items
  }, [filteredLogs, logSort])

  React.useEffect(() => {
    if (useSearch) return
    if (logId) return
    if (!sortedLogs.length) return
    setLogId(sortedLogs[0].id)
  }, [sortedLogs, logId, setLogId, useSearch])

  React.useEffect(() => {
    if (useSearch) return
    if (!logId) return
    if (!sortedLogs.length) return
    const exists = sortedLogs.some((log) => log.id === logId)
    if (!exists) setLogId(sortedLogs[0].id)
  }, [sortedLogs, logId, setLogId, useSearch])

  React.useEffect(() => {
    const detectionId = searchParams.get("detectionId")
    if (useSearch) {
      const params = new URLSearchParams()
      params.set("search", "1")
      if (filters.type && filters.type !== "all") params.set("type", filters.type)
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.dateFrom) params.set("from", filters.dateFrom)
      if (filters.dateTo) params.set("to", filters.dateTo)
      if (detectionId) params.set("detectionId", detectionId)
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
      return
    }
    if (logId) {
      const params = new URLSearchParams()
      params.set("logId", String(logId))
      if (mapFilter && mapFilter !== "all") params.set("map", mapFilter)
      if (logSort) params.set("sort", logSort)
      if (detectionId) params.set("detectionId", detectionId)
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
    }
  }, [filters.dateFrom, filters.dateTo, filters.status, filters.type, logId, mapFilter, logSort, searchParams, useSearch])

  React.useEffect(() => {
    const search = searchParams.get("search")
    const logParam = searchParams.get("logId")
    const mapParam = searchParams.get("map")
    const sortParam = searchParams.get("sort")
    if (search === "1") {
      setUseSearch(true)
      setLogId(null)
      setFilters({
        ...filters,
        type: (searchParams.get("type") as DetectionType) || filters.type,
        status: (searchParams.get("status") as DetectionStatus) || filters.status,
        dateFrom: searchParams.get("from") || filters.dateFrom,
        dateTo: searchParams.get("to") || filters.dateTo,
      })
      return
    }
    if (logParam) {
      setUseSearch(false)
      setLogId(Number(logParam))
    }
    if (mapParam) {
      setMapFilter(mapParam)
    }
    if (sortParam === "asc" || sortParam === "desc") {
      setLogSort(sortParam)
    }
  }, [searchParams])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem("dashboard.filters")
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.mapFilter) setMapFilter(parsed.mapFilter)
      if (parsed?.logSort === "asc" || parsed?.logSort === "desc") setLogSort(parsed.logSort)
      if (parsed?.filters) setFilters({ ...filters, ...parsed.filters })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      "dashboard.filters",
      JSON.stringify({
        mapFilter,
        logSort,
        filters,
      })
    )
  }, [filters, logSort, mapFilter])

  React.useEffect(() => {
    if (!useSearch) return
    if (!error) return
    toast({ title: "통합 검색 실패", description: "로그 기준 조회로 전환합니다." })
    setUseSearch(false)
  }, [error, setUseSearch, toast, useSearch])

  React.useEffect(() => {
    if (!deepLinkId) return
    if (lastOpenedRef.current === deepLinkId) return

    const existing = detections.find((d) => String(d.id) === deepLinkId)
    if (existing) {
      selectDetection(existing)
      setIsDetailOpen(true)
      lastOpenedRef.current = deepLinkId
      return
    }

    detectionApi.getDetectionById(deepLinkId).then((res) => {
      if (!res?.data) return
      selectDetection(res.data)
      setIsDetailOpen(true)
      lastOpenedRef.current = deepLinkId
    })
  }, [deepLinkId, detections, selectDetection])

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">탐지 기록</h1>
          <p className="text-sm text-muted-foreground mt-1">탐지 기록 및 통계를 확인하세요.</p>
        </div>

        <div className="mb-4 hidden lg:flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-auto sm:min-w-[280px] sm:flex-none">
            <Select
              value={logId ? String(logId) : ""}
              onValueChange={(value) => {
                setUseSearch(false)
                setLogId(Number(value))
              }}
              disabled={useSearch || logsLoading || sortedLogs.length === 0}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder={logsLoading ? "운행 로그 불러오는 중..." : "운행 로그 선택"} />
              </SelectTrigger>
              <SelectContent>
                {sortedLogs.map((log) => (
                  <SelectItem key={log.id} value={String(log.id)}>
                    {formatLogLabel(log)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:flex-1 sm:min-w-[220px] sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ID로 검색..."
              value={filters.searchId || ""}
              onChange={(e) => setFilters({ ...filters, searchId: e.target.value })}
              className="pl-9 bg-input border-border"
            />
          </div>
          <DateRangePicker
            startDate={filters.dateFrom || ""}
            endDate={filters.dateTo || ""}
            onStartDateChange={(date) => setFilters({ ...filters, dateFrom: date })}
            onEndDateChange={(date) => setFilters({ ...filters, dateTo: date })}
          />
          <Select
            value={mapFilter}
            onValueChange={(value) => {
              setMapFilter(value)
              setUseSearch(false)
            }}
            disabled={useSearch || mapOptions.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[160px] bg-input border-border">
              <MapIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="지도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 지도</SelectItem>
              {mapOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={logSort}
            onValueChange={(value) => setLogSort(value as "desc" | "asc")}
            disabled={useSearch || sortedLogs.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[140px] bg-input border-border">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">최신 로그</SelectItem>
              <SelectItem value="asc">오래된 로그</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.type || "all"}
            onValueChange={(value) => setFilters({ ...filters, type: value as DetectionType | "all" })}
          >
            <SelectTrigger className="w-full sm:w-[140px] bg-input border-border">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 유형</SelectItem>
              <SelectItem value="cockroach">바퀴벌레</SelectItem>
              <SelectItem value="ant">개미</SelectItem>
              <SelectItem value="fly">파리</SelectItem>
              <SelectItem value="mosquito">모기</SelectItem>
              <SelectItem value="spider">거미</SelectItem>
              <SelectItem value="unknown">미확인</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) => setFilters({ ...filters, status: value as DetectionStatus | "all" })}
          >
            <SelectTrigger className="w-full sm:w-[140px] bg-input border-border">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 상태</SelectItem>
              <SelectItem value="detected">탐지됨</SelectItem>
              <SelectItem value="confirmed">확인됨</SelectItem>
              <SelectItem value="false_alarm">오탐</SelectItem>
              <SelectItem value="resolved">해결됨</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              checked={useSearch}
              onCheckedChange={(checked) => {
                setUseSearch(checked)
                if (checked) setLogId(null)
              }}
            />
            <span className="text-sm text-muted-foreground">통합 검색</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {useSearch && (
                <Badge variant="secondary" className="text-xs">
                  통합 검색 결과
                </Badge>
              )}
              {!useSearch && mapFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  지도: {mapFilter}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">총 {detections.length}건</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("dashboard.filters")
                }
                setMapFilter("all")
                setLogSort("desc")
                clearFilters()
                window.history.replaceState(null, "", window.location.pathname)
                toast({ title: "필터 초기화", description: "필터와 저장값을 초기화했습니다." })
              }}
              onPointerDown={(e) => e.currentTarget.blur()}
              onPointerUp={(e) => e.currentTarget.blur()}
              onPointerCancel={(e) => e.currentTarget.blur()}
              onMouseUp={(e) => e.currentTarget.blur()}
              onTouchEnd={(e) => e.currentTarget.blur()}
              className="text-xs h-8 px-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            >
              <X className="h-3 w-3 mr-1" />
              필터 초기화
            </Button>
          </div>
        </div>

        <div className="mb-4 lg:hidden">
          <Accordion type="multiple" defaultValue={["filters"]}>
            <AccordionItem value="filters">
              <AccordionTrigger>필터 보기</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 gap-3">
                  <Select
                    value={logId ? String(logId) : ""}
                    onValueChange={(value) => {
                      setUseSearch(false)
                      setLogId(Number(value))
                    }}
                    disabled={useSearch || logsLoading || sortedLogs.length === 0}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder={logsLoading ? "운행 로그 불러오는 중..." : "운행 로그 선택"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedLogs.map((log) => (
                        <SelectItem key={log.id} value={String(log.id)}>
                          {formatLogLabel(log)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ID로 검색..."
                      value={filters.searchId || ""}
                      onChange={(e) => setFilters({ ...filters, searchId: e.target.value })}
                      className="pl-9 bg-input border-border"
                    />
                  </div>
                  <DateRangePicker
                    startDate={filters.dateFrom || ""}
                    endDate={filters.dateTo || ""}
                    onStartDateChange={(date) => setFilters({ ...filters, dateFrom: date })}
                    onEndDateChange={(date) => setFilters({ ...filters, dateTo: date })}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Select
                      value={mapFilter}
                      onValueChange={(value) => {
                        setMapFilter(value)
                        setUseSearch(false)
                      }}
                      disabled={useSearch || mapOptions.length === 0}
                    >
                      <SelectTrigger className="bg-input border-border h-9 px-2 text-[11px]">
                        <MapIcon className="hidden sm:inline-block h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="지도" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 지도</SelectItem>
                        {mapOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={logSort}
                      onValueChange={(value) => setLogSort(value as "desc" | "asc")}
                      disabled={useSearch || sortedLogs.length === 0}
                    >
                      <SelectTrigger className="bg-input border-border h-9 px-2 text-[11px]">
                        <SelectValue placeholder="정렬" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">최신 로그</SelectItem>
                        <SelectItem value="asc">오래된 로그</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.type || "all"}
                      onValueChange={(value) => setFilters({ ...filters, type: value as DetectionType | "all" })}
                    >
                      <SelectTrigger className="bg-input border-border h-9 px-2 text-[11px]">
                        <Filter className="hidden sm:inline-block h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="유형" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 유형</SelectItem>
                        <SelectItem value="cockroach">바퀴벌레</SelectItem>
                        <SelectItem value="ant">개미</SelectItem>
                        <SelectItem value="fly">파리</SelectItem>
                        <SelectItem value="mosquito">모기</SelectItem>
                        <SelectItem value="spider">거미</SelectItem>
                        <SelectItem value="unknown">미확인</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) => setFilters({ ...filters, status: value as DetectionStatus | "all" })}
                    >
                      <SelectTrigger className="bg-input border-border h-9 px-2 text-[11px]">
                        <SelectValue placeholder="상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 상태</SelectItem>
                        <SelectItem value="detected">탐지됨</SelectItem>
                        <SelectItem value="confirmed">확인됨</SelectItem>
                        <SelectItem value="false_alarm">오탐</SelectItem>
                        <SelectItem value="resolved">해결됨</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={useSearch}
                      onCheckedChange={(checked) => {
                        setUseSearch(checked)
                        if (checked) setLogId(null)
                      }}
                    />
                    <span className="text-sm text-muted-foreground">통합 검색</span>
                    {useSearch && (
                      <Badge variant="secondary" className="text-xs">
                        통합 검색 결과
                      </Badge>
                    )}
                  </div>
                  {!useSearch && mapFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs w-fit">
                      지도: {mapFilter}
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">총 {detections.length}건</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem("dashboard.filters")
                        }
                        setMapFilter("all")
                        setLogSort("desc")
                        clearFilters()
                        window.history.replaceState(null, "", window.location.pathname)
                        toast({ title: "필터 초기화", description: "필터와 저장값을 초기화했습니다." })
                      }}
                      onPointerDown={(e) => e.currentTarget.blur()}
                      onPointerUp={(e) => e.currentTarget.blur()}
                      onPointerCancel={(e) => e.currentTarget.blur()}
                      onMouseUp={(e) => e.currentTarget.blur()}
                      onTouchEnd={(e) => e.currentTarget.blur()}
                      className="text-xs h-8 px-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
                    >
                      <X className="h-3 w-3 mr-1" />
                      필터 초기화
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        {isLoading && (
          <div className="mb-4 h-2 w-full rounded-full bg-secondary/30 animate-pulse" />
        )}

        <div className="mb-4 sm:mb-6">
          <StatsSection stats={stats} isLoading={isLoading} />
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">탐지 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>탐지 기록 불러오기 실패</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DetectionTable
              detections={detections}
              onViewDetail={async (d) => {
                selectDetection(d)
                setIsDetailOpen(true)
                const res = await detectionApi.getDetectionById(d.id)
                if (res?.data) {
                  selectDetection(res.data)
                } else {
                  toast({ title: "상세 불러오기 실패", description: "탐지 상세 정보를 불러오지 못했습니다." })
                }
              }}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <DetailPanel
          record={selectedDetection}
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onDelete={async (id) => {
            const target = detections.find((d) => d.id === id) ?? null
            setDeleteTarget(target)
          }}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>탐지 내역 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                삭제하면 복구할 수 없습니다. 정말 삭제할까요?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-500/90"
                onClick={async () => {
                  if (!deleteTarget) return
                  const ok = await deleteDetection(deleteTarget.id)
                  if (ok) {
                    setIsDetailOpen(false)
                    toast({ title: "삭제 완료", description: "탐지 내역을 삭제했습니다." })
                  } else {
                    toast({ title: "삭제 실패", description: "삭제 중 오류가 발생했습니다." })
                  }
                  setDeleteTarget(null)
                }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="h-8 w-48 bg-secondary animate-pulse rounded mb-6" />
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}



