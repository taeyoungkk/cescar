"use client"

import React, { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bug,
  Calendar,
  Clock,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
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
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

import { DEMO_MODE } from "@/core/demo/config"
import { robotDemoEngine } from "@/core/demo/robotDemoEngine"
import { useDashboardDemoData } from "@/hooks/useDashboardDemoData"

// ============================================
// Presentational Components (UI Only)
// ============================================

interface SummaryCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
}

function SummaryCard({ title, value, icon: Icon, subtitle, variant = "default" }: SummaryCardProps) {
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

interface StatsSectionProps {
  stats: DetectionStats | null
  isLoading: boolean
}

function StatsSection({ stats, isLoading }: StatsSectionProps) {
  if (isLoading || !stats) {
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard title="오늘 탐지" value={stats.todayCount} icon={Bug} subtitle="건" />
      <SummaryCard title="이번 주 탐지" value={stats.weekCount} icon={BarChart3} subtitle="건" />
      <SummaryCard
        title="오탐률"
        value={`${stats.falseAlarmRate}%`}
        icon={TrendingUp}
        variant={stats.falseAlarmRate > 15 ? "warning" : "success"}
      />
      <SummaryCard title="마지막 탐지" value={stats.lastDetectionTime} icon={Clock} subtitle="오늘" />
    </div>
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
  onMarkFalseAlarm: (id: string) => void
  onMarkResolved: (id: string) => void
  onSaveNotes?: (id: string, notes: string) => void
  onDelete?: (id: string) => void
}

function DetailPanel({ record, open, onClose, onMarkFalseAlarm, onMarkResolved, onSaveNotes, onDelete }: DetailPanelProps) {
  const [notes, setNotes] = useState(record?.notes || "")
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

  React.useEffect(() => {
    setNotes(record?.notes || "")
  }, [record?.id])

  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  if (!record) return null
  console.log("snapshotUrl:", record.snapshotUrl)
  const videoUrl = record.videoUrl ? `${BASE_URL}${record.videoUrl}` : null

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
        <SheetHeader className="border-b border-border px-5 pt-4 pb-4 pr-12">
          <div className="flex items-center justify-between gap-3 pr-2">
            <div>
              <SheetTitle className="text-foreground">탐지 상세 정보</SheetTitle>
              <SheetDescription className="text-muted-foreground">탐지 ID: {record.id}</SheetDescription>
            </div>
            <div className="shrink-0">
              <StatusBadge status={record.status} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">탐지 시간</p>
              <p className="text-sm font-medium text-foreground">
                {record.date} {record.time}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">차량 ID</p>
              <p className="text-sm font-medium text-foreground">{record.robotId}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden">
            {record.snapshotUrl ? (
              <img
                src={`${BASE_URL}${record.snapshotUrl}`}
                alt="snapshot"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Camera className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">탐지 순간 스냅샷</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">탐지 영상 확인</p>
              <p className="text-xs text-muted-foreground/70">탐지 전후 영상을 확인하세요.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsVideoOpen(true)}>
              <Play className="h-4 w-4 mr-1" />
              영상 확인
            </Button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">탐지 정보</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">탐지 유형</p>
                <p className="text-sm font-medium text-foreground">{typeLabels[record.type] || record.type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">확신도</p>
                <ConfidenceBadge confidence={record.confidence} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">메모</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="메모를 입력하세요."
              className="bg-input border-border resize-none min-h-[100px]"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border px-5 pb-5 pt-4 gap-2">
          {onSaveNotes && (
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onSaveNotes(record.id, notes)}
            >
              저장
            </Button>
          )}

          {onDelete && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onDelete(record.id)}
            >
              삭제
            </Button>
          )}

          {record.status !== "false_alarm" && (
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => onMarkFalseAlarm(record.id)}>
              <XCircle className="h-4 w-4 mr-2" />
              오탐으로 표시
            </Button>
          )}
          {record.status !== "resolved" && (
            <Button variant="default" className="flex-1" onClick={() => onMarkResolved(record.id)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              해결 처리
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
            {videoUrl ? (
              <video className="absolute inset-0 w-full h-full" controls>
                <source src={videoUrl} />
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Play className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">영상 준비 중...</p>
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

interface FiltersBarProps {
  filters: DetectionHistoryFilters
  onFiltersChange: (filters: DetectionHistoryFilters) => void
  onClearFilters: () => void
  totalCount: number
}

function FiltersBar({ filters, onFiltersChange, onClearFilters, totalCount }: FiltersBarProps) {
  const hasActiveFilters =
    filters.dateFrom || filters.dateTo || (filters.type && filters.type !== "all") || (filters.status && filters.status !== "all") || filters.searchId

  return (
    <div className="mb-4 pb-4 border-b border-border space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ID로 검색..."
            value={filters.searchId || ""}
            onChange={(e) => onFiltersChange({ ...filters, searchId: e.target.value })}
            className="pl-9 bg-input border-border"
          />
        </div>

        <DateRangePicker
          startDate={filters.dateFrom || ""}
          endDate={filters.dateTo || ""}
          onStartDateChange={(date) => onFiltersChange({ ...filters, dateFrom: date })}
          onEndDateChange={(date) => onFiltersChange({ ...filters, dateTo: date })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.type || "all"}
          onValueChange={(value) => onFiltersChange({ ...filters, type: value as DetectionType | "all" })}
        >
          <SelectTrigger className="w-[140px] bg-input border-border">
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
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as DetectionStatus | "all" })}
        >
          <SelectTrigger className="w-[140px] bg-input border-border">
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

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs h-8 px-2">
            <X className="h-3 w-3 mr-1" />
            필터 초기화
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">총 {totalCount}건</span>
      </div>
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
    <div className="overflow-x-auto">
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
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

function DashboardContent() {
  const searchParams = useSearchParams()
  const deepLinkId = searchParams.get("detectionId")
  /**
   * ============================
   * DEMO MODE
   * ============================
   */
  if (DEMO_MODE) {
    const { batterySeries, detectionsPerMinute, detectionByType } = useDashboardDemoData()

    // Demo engine snapshot
    const snap = robotDemoEngine.getSnapshot()

    // Detection 紐⑸줉 (CameraEvent ??Detection 蹂??
    const detections: Detection[] = snap.cameraEvents.map((e, idx) => ({
      id: e.id,
      robotId: "CESCAR-01",
      type: e.type as DetectionType,
      confidence: Math.round(70 + Math.random() * 25),
      status: "detected",
      date: new Date().toISOString().slice(0, 10),
      time: e.time,
      notes: "",
    }))

    // Stats 怨꾩궛
    const stats: DetectionStats = {
      todayCount: detections.length,
      weekCount: detections.length,
      falseAlarmRate: 8,
      lastDetectionTime: detections[0]?.time ?? "-",
    }

    const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [filters, setFilters] = useState<DetectionHistoryFilters>({})

    const filteredDetections = detections.filter((d) => {
      if (filters.type && filters.type !== "all" && d.type !== filters.type) return false
      if (filters.status && filters.status !== "all" && d.status !== filters.status) return false
      if (filters.searchId && !d.id.includes(filters.searchId)) return false
      return true
    })

    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">탐지 기록</h1>
            <p className="text-sm text-muted-foreground mt-1">
              탐지 기록 및 통계를 확인하세요. (DEMO MODE)
            </p>
          </div>

          <div className="mb-6">
            <StatsSection stats={stats} isLoading={false} />
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
            )}            <FiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={() => setFilters({})}
                totalCount={filteredDetections.length}
              />
              <DetectionTable
                detections={filteredDetections}
                onViewDetail={(d) => {
                  setSelectedDetection(d)
                  setIsDetailOpen(true)
                }}
                isLoading={false}
              />
            </CardContent>
          </Card>

          <DetailPanel
            record={selectedDetection}
            open={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            onMarkFalseAlarm={() => setIsDetailOpen(false)}
            onMarkResolved={() => setIsDetailOpen(false)}
            onSaveNotes={() => {}}
          />
        </div>
      </div>
    )
  }

  /**
   * ============================
   * REAL MODE
   * ============================
   */
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
    updateStatus,
    updateNotes,
    deleteDetection,
  } = useDetectionHistory(carId)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Detection | null>(null)
  const lastOpenedRef = React.useRef<string | null>(null)

  const formatLogLabel = (log: { id: number; startAt: string; endAt: string | null; status: string; detectionCount: number }) => {
    const start = log.startAt ? new Date(log.startAt) : null
    const end = log.endAt ? new Date(log.endAt) : null
    const startLabel = start && !Number.isNaN(start.getTime()) ? start.toLocaleString("ko-KR") : log.startAt
    const endLabel = end && !Number.isNaN(end.getTime()) ? end.toLocaleString("ko-KR") : "-"
    return `${startLabel} ~ ${endLabel} · ${log.status} · ${log.detectionCount}건`
  }

  React.useEffect(() => {
    if (useSearch) return
    if (logId) return
    if (!logs.length) return
    setLogId(logs[0].id)
  }, [logs, logId, setLogId, useSearch])

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
      if (detectionId) params.set("detectionId", detectionId)
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
    }
  }, [filters.dateFrom, filters.dateTo, filters.status, filters.type, logId, searchParams, useSearch])

  React.useEffect(() => {
    const search = searchParams.get("search")
    const logParam = searchParams.get("logId")
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
  }, [searchParams])

  React.useEffect(() => {
    if (!useSearch) return
    if (!error) return
    toast({ title: "통합 검색 실패", description: "로그 기준 조회로 전환합니다." })
    setUseSearch(false)
  }, [error, setUseSearch, toast, useSearch])

  React.useEffect(() => {
    if (!deepLinkId) return
    if (lastOpenedRef.current === deepLinkId) return

    const existing = detections.find((d) => d.id === deepLinkId)
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
    <div className="p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">탐지 기록</h1>
          <p className="text-sm text-muted-foreground mt-1">탐지 기록 및 통계를 확인하세요.</p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1 sm:flex-none">
            <Select
              value={logId ? String(logId) : ""}
              onValueChange={(value) => {
                setUseSearch(false)
                setLogId(Number(value))
              }}
              disabled={useSearch || logsLoading || logs.length === 0}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder={logsLoading ? "운행 로그 불러오는 중..." : "운행 로그 선택"} />
              </SelectTrigger>
              <SelectContent>
                {logs.map((log) => (
                  <SelectItem key={log.id} value={String(log.id)}>
                    {formatLogLabel(log)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select
            value={filters.type || "all"}
            onValueChange={(value) => setFilters({ ...filters, type: value as DetectionType | "all" })}
          >
            <SelectTrigger className="w-[140px] bg-input border-border">
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
            <SelectTrigger className="w-[140px] bg-input border-border">
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
          {useSearch && (
            <Badge variant="secondary" className="text-xs">
              통합 검색 결과
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-8 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            필터 초기화
          </Button>
        </div>
        {isLoading && (
          <div className="mb-4 h-2 w-full rounded-full bg-secondary/30 animate-pulse" />
        )}

        <div className="mb-6">
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
            <FiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              totalCount={detections.length}
            />
            <DetectionTable
              detections={detections}
              onViewDetail={(d) => {
                selectDetection(d)
                setIsDetailOpen(true)
              }}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <DetailPanel
          record={selectedDetection}
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onMarkFalseAlarm={async (id) => {
            await updateStatus(id, "false_alarm")
            setIsDetailOpen(false)
          }}
          onMarkResolved={async (id) => {
            await updateStatus(id, "resolved")
            setIsDetailOpen(false)
          }}
          onDelete={async (id) => {
            const target = detections.find((d) => d.id === id) ?? null
            setDeleteTarget(target)
          }}
          onSaveNotes={async (id, notes) => {
            await updateNotes(id, notes)
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



