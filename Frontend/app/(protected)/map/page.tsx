"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Map,
  Navigation,
  Target,
  MapPin,
  Bug,
  Clock,
  RefreshCw,
  Info,
  History,
  Trash2,
  Grid3X3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { usePrimaryCarId } from "@/hooks/usePrimaryCarId"
import { useCarMaps } from "@/hooks/useCarMaps"
import { useRecentDetections } from "@/hooks/useRecentDetections"
import type { CarMap } from "@/core/types"

type MapStatus = "no_map" | "generating" | "completed"

// ============================================
// Presentational Components (UI Only)
// ============================================

interface LargeMapVisualizationProps {
  status: MapStatus
}

function LargeMapVisualization({ status }: LargeMapVisualizationProps) {
  return (
    <div className="relative w-full bg-zinc-900 rounded-lg overflow-hidden border border-border
                h-[320px] sm:h-auto sm:aspect-[16/10]">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />

      {status === "no_map" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="p-6 rounded-full bg-secondary/50 mb-4">
            <Map className="h-16 w-16 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-lg">지도가 아직 생성되지 않았습니다.</p>
          <p className="text-muted-foreground/60 text-sm mt-2">홈에서 지도 생성을 시작하세요.</p>

          <Button asChild variant="outline" className="bg-transparent mt-4">
            <Link href="/home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
        </div>
      )}

      {status === "generating" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="p-6 rounded-full bg-secondary/50 mb-4">
            <RefreshCw className="h-16 w-16 text-emerald-400/80 animate-spin" />
          </div>
          <p className="text-foreground text-lg font-medium">지도 생성 중...</p>
          <p className="text-muted-foreground/60 text-sm mt-2">잠시만 기다려주세요.</p>
        </div>
      )}

      {status === "completed" && (
        <>
          {/* Complete map visualization - larger version */}
          <div className="absolute inset-6">
            <svg
              className="w-full h-full"
              viewBox="0 0 400 250"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Outer walls */}
              <rect x="30" y="30" width="340" height="6" fill="rgba(140,140,140,0.9)" />
              <rect x="30" y="30" width="6" height="190" fill="rgba(140,140,140,0.9)" />
              <rect x="364" y="30" width="6" height="190" fill="rgba(140,140,140,0.9)" />
              <rect x="30" y="214" width="340" height="6" fill="rgba(140,140,140,0.9)" />

              {/* Interior walls - more complex layout */}
              <rect x="100" y="30" width="6" height="80" fill="rgba(140,140,140,0.9)" />
              <rect x="100" y="80" width="60" height="6" fill="rgba(140,140,140,0.9)" />
              <rect x="200" y="30" width="6" height="60" fill="rgba(140,140,140,0.9)" />
              <rect x="200" y="84" width="80" height="6" fill="rgba(140,140,140,0.9)" />
              <rect x="274" y="84" width="6" height="80" fill="rgba(140,140,140,0.9)" />
              <rect x="100" y="140" width="6" height="80" fill="rgba(140,140,140,0.9)" />
              <rect x="100" y="140" width="100" height="6" fill="rgba(140,140,140,0.9)" />
              <rect x="200" y="160" width="6" height="60" fill="rgba(140,140,140,0.9)" />

              {/* Free space areas */}
              <rect x="40" y="40" width="54" height="90" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="110" y="40" width="84" height="36" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="210" y="40" width="148" height="36" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="110" y="94" width="158" height="40" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="284" y="94" width="74" height="114" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="40" y="150" width="54" height="58" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="110" y="150" width="84" height="58" fill="rgba(34, 197, 94, 0.12)" />
              <rect x="210" y="170" width="68" height="38" fill="rgba(34, 197, 94, 0.12)" />

              {/* Fine grid overlay */}
              <g opacity="0.25">
                {[...Array(11)].map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="40"
                    y1={40 + i * 18}
                    x2="358"
                    y2={40 + i * 18}
                    stroke="rgba(34, 197, 94, 0.3)"
                    strokeWidth="0.5"
                  />
                ))}
                {[...Array(17)].map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={40 + i * 20}
                    y1="40"
                    x2={40 + i * 20}
                    y2="208"
                    stroke="rgba(34, 197, 94, 0.3)"
                    strokeWidth="0.5"
                  />
                ))}
              </g>

              {/* Robot path trail */}
              <path
                d="M 60 60 L 80 80 L 150 80 L 150 120 L 240 120 L 320 100 L 320 160 L 240 190 L 150 180 L 80 180 L 60 160"
                stroke="#22c55e"
                strokeWidth="2"
                fill="none"
                strokeDasharray="6 3"
                opacity="0.5"
              />

              {/* Detection markers with labels */}
              <g>
                <circle cx="80" cy="80" r="8" fill="#f59e0b" opacity="0.8" />
                <text x="80" y="68" fill="#f59e0b" fontSize="8" textAnchor="middle">
                  D1
                </text>
              </g>
              <g>
                <circle cx="320" cy="100" r="8" fill="#f59e0b" opacity="0.8" />
                <text x="320" y="88" fill="#f59e0b" fontSize="8" textAnchor="middle">
                  D2
                </text>
              </g>
              <g>
                <circle cx="150" cy="180" r="8" fill="#f59e0b" opacity="0.8" />
                <text x="150" y="168" fill="#f59e0b" fontSize="8" textAnchor="middle">
                  D3
                </text>
              </g>
              <g>
                <circle cx="240" cy="190" r="8" fill="#ef4444" opacity="0.8" />
                <text x="240" y="178" fill="#ef4444" fontSize="8" textAnchor="middle">
                  D4
                </text>
              </g>

              {/* Robot current position with ripple effect */}
              <g>
                <circle cx="200" cy="125" r="9" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" values="9;35" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="200" cy="125" r="9" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" values="9;35" dur="2s" begin="0.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" begin="0.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="200" cy="125" r="9" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" values="9;35" dur="2s" begin="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>

                <circle cx="200" cy="125" r="14" fill="#22c55e" opacity="0.2" />
                <circle cx="200" cy="125" r="9" fill="#22c55e" />
                <polygon points="200,112 206,122 194,122" fill="#22c55e" />
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className="hidden sm:flex absolute top-4 right-4 flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/70 rounded px-2.5 py-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/80">로봇</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/70 rounded px-2.5 py-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-xs text-white/80">탐지 (확인)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/70 rounded px-2.5 py-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="text-xs text-white/80">탐지 (미확인)</span>
            </div>
          </div>

          {/* Compass */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-black/70 rounded-full p-1.5 sm:p-2">
            <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-white/80" />
          </div>

          {/* Scale indicator */}
          <div className="hidden sm:block absolute bottom-4 left-4 bg-black/70 rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-white/60 rounded" />
              <span className="text-xs text-white/80">1m</span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="hidden sm:block absolute bottom-4 right-4 bg-black/70 rounded px-3 py-2">
            <span className="text-xs text-white/60 font-mono">X: 6.2m | Y: 4.1m</span>
          </div>
        </>
      )}
    </div>
  )
}

interface MapMetadataCardProps {
  label: string
  value: string
  icon: React.ElementType
}

function MapMetadataCard({ label, value, icon: Icon }: MapMetadataCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DetectionPointItemProps {
  id: string
  type: string
  location: string
  time: string
  status: "confirmed" | "pending"
}

function DetectionPointItem({ id, type, location, time, status }: DetectionPointItemProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${status === "confirmed" ? "bg-amber-500/20" : "bg-red-500/20"}`}>
          <Bug className={`h-4 w-4 ${status === "confirmed" ? "text-amber-400" : "text-red-400"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {id}: {type}
          </p>
          <p className="text-xs text-muted-foreground">{location}</p>
        </div>
      </div>
      <div className="text-right">
        <Badge
          className={
            status === "confirmed"
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
          }
        >
          {status === "confirmed" ? "확인됨" : "확인 중"}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
          <Clock className="h-3 w-3" />
          {time}
        </p>
      </div>
    </div>
  )
}

// ============================================
// Page Component
// ============================================

function toAreaSize(map: CarMap | null) {
  if (!map || !map.width || !map.height || !map.resolution) return "-"
  const w = map.width * map.resolution
  const h = map.height * map.resolution
  return `${w.toFixed(1)}m x ${h.toFixed(1)}m`
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ko-KR")
}
function MapHistoryDialog({
  maps,
  onSelect,
  onDelete,
  currentMapId,
}: {
  maps: CarMap[]
  onSelect: (mapId: string) => void
  onDelete: (mapId: string) => void
  currentMapId?: number | null
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent">
          <History className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">기존 지도 보기</span>
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
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    currentMapId === map.id
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{map.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{formatDateLabel(map.createdAt)}</span>
                      <span className="text-xs text-muted-foreground">{toAreaSize(map)}</span>
                      {currentMapId === map.id && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          현재 지도
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        onSelect(String(map.id))
                        setOpen(false)
                      }}
                    >
                      선택
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => onDelete(String(map.id))}
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

export default function MapDetailPage() {
  const { carId } = usePrimaryCarId()
  const { maps, currentMap, isLoading, refresh, selectMap, deleteMap, renameMap, error: mapsError } = useCarMaps(carId)
  const { recentDetections, isLoading: detectionsLoading, error: detectionsError } = useRecentDetections(carId, 20)
  const { toast } = useToast()

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)

  const mapStatus: MapStatus = currentMap ? "completed" : "no_map"

  const handleSelectMap = useCallback(async (mapId: string) => {
    await selectMap(Number(mapId))
  }, [selectMap])

  const handleDeleteMap = useCallback(async (mapId: string) => {
    await deleteMap(Number(mapId))
  }, [deleteMap])

  const handleDeleteAndSelectNext = useCallback(async () => {
    if (!currentMap) return
    await handleDeleteMap(String(currentMap.id))
    const remaining = maps.filter((map) => map.id !== currentMap.id)
    if (remaining.length > 0) {
      await handleSelectMap(String(remaining[0].id))
      toast({ title: "다음 지도 선택", description: `“${remaining[0].name}”로 전환했습니다.` })
    } else {
      toast({ title: "지도 삭제 완료", description: "선택 가능한 지도가 없습니다." })
    }
  }, [currentMap, handleDeleteMap, handleSelectMap, maps, toast])

  const nextMap = useMemo(() => {
    if (!currentMap) return null
    return maps.filter((map) => map.id !== currentMap.id)[0] ?? null
  }, [currentMap, maps])

  useEffect(() => {
    if (!renameOpen) return
    setRenameDraft(currentMap?.name ?? "")
  }, [renameOpen, currentMap?.name])

  const handleRename = useCallback(async () => {
    if (!currentMap) return
    const nextName = renameDraft.trim()
    if (!nextName) {
      toast({ title: "이름 변경 실패", description: "지도 이름을 입력해 주세요." })
      return
    }
    setRenaming(true)
    try {
      await renameMap(currentMap.id, nextName)
      toast({ title: "이름 변경 완료", description: "지도 이름이 변경되었습니다." })
      setRenameOpen(false)
    } catch (e: any) {
      toast({ title: "이름 변경 실패", description: e?.message ?? "지도 이름 변경에 실패했습니다." })
    } finally {
      setRenaming(false)
    }
  }, [currentMap, renameDraft, renameMap, toast])

  const detectionPoints = useMemo(() => {
    const typeLabels: Record<string, string> = {
      cockroach: "바퀴벌레",
      ant: "개미",
      fly: "파리",
      mosquito: "모기",
      spider: "거미",
      person: "사람",
      unknown: "미확인",
    }
    return recentDetections.map((d) => {
      const x = d.x == null ? "-" : d.x.toFixed(2)
      const y = d.y == null ? "-" : d.y.toFixed(2)
      const location = d.x == null || d.y == null ? "-" : `(${x}m, ${y}m)`
      const status = d.status === "confirmed" || d.status === "resolved" ? "confirmed" : "pending"
      return {
        id: d.id,
        type: typeLabels[d.type] ?? d.type,
        location,
        time: d.time,
        status,
      }
    })
  }, [recentDetections])

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse bg-secondary/20 h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          {/* Left */}
          <div className="flex items-start gap-3 min-w-0">
            <Button asChild variant="ghost" size="icon" className="rounded-lg shrink-0">
              <Link href="/home">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
                <span className="sm:hidden">지도 상세</span>
                <span className="hidden sm:inline">지도 상세 보기</span>
              </h1>
              {currentMap && (
                <p className="text-xs text-muted-foreground mt-1">
                  현재 지도: <span className="text-foreground font-medium">{currentMap.name}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5 break-words">
                <span className="sm:hidden">SLAM 지도 결과</span>
                <span className="hidden sm:inline">SLAM 기반 지도 결과</span>
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
            {maps.length > 0 && (
              <MapHistoryDialog
                maps={maps}
                onSelect={handleSelectMap}
                onDelete={handleDeleteMap}
                currentMapId={currentMap?.id ?? null}
              />
            )}

            {mapStatus === "completed" && currentMap && (
              <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    지도 이름 수정
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>지도 이름 수정</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">지도 이름</p>
                      <Input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        placeholder="지도 이름"
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setRenameOpen(false)}>
                        취소
                      </Button>
                      <Button onClick={handleRename} disabled={renaming}>
                        저장
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {mapStatus === "completed" && currentMap && (
              <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent text-red-400 hover:text-red-300">
                  지도 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>현재 지도를 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <div>삭제하면 현재 지도 선택이 해제됩니다. 필요하면 기존 지도 목록에서 다시 선택할 수 있습니다.</div>
                    <div className="text-xs text-muted-foreground">
                      다음 지도:{" "}
                      <span className="text-foreground font-medium">{nextMap?.name ?? "없음"}</span>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={!nextMap}
                      onClick={async () => {
                        await handleDeleteAndSelectNext()
                      }}
                    >
                      삭제
                    </AlertDialogAction>
                    {!nextMap && (
                      <span className="text-xs text-muted-foreground">선택 가능한 다음 지도가 없습니다.</span>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {mapStatus === "completed" && currentMap && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                <MapPin className="h-3 w-3 mr-1" />
                현재 지도
              </Badge>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map visualization - spans 3 columns */}
          <div className="lg:col-span-3">
            {mapsError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>지도 불러오기 실패</AlertTitle>
                <AlertDescription>{mapsError}</AlertDescription>
              </Alert>
            )}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-base font-medium truncate">지도 시각화</CardTitle>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <Target className="h-3 w-3 mr-1" />
                      Occupancy Grid
                    </Badge>
                    {currentMap && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {currentMap.name}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={refresh} disabled={isLoading}>
                      <RefreshCw className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">새로고침</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <LargeMapVisualization status={mapStatus} />
              </CardContent>
            </Card>

            {/* Coming soon notice */}
            <Card className="bg-blue-500/10 border-blue-500/30 mt-4">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-400">실시간 기능 준비 중</p>
                    <p className="text-xs text-blue-400/80 mt-1">
                      실시간 로봇 위치 추적, 경로 확인, 수동 조작 기능을 곧 추가할 예정입니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - metadata and detection points */}
          <div className="space-y-4">
            {/* Map metadata */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground px-1">지도 정보</h3>
              {currentMap && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 w-fit">
                  현재 지도
                </Badge>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <MapMetadataCard label="지도 이름" value={currentMap?.name ?? "-"} icon={MapPin} />
                <MapMetadataCard label="생성 시각" value={formatDateLabel(currentMap?.createdAt)} icon={Clock} />
                <MapMetadataCard label="맵 영역" value={toAreaSize(currentMap)} icon={Map} />
                <MapMetadataCard label="차량 ID" value={carId ? String(carId) : "-"} icon={Target} />
                <MapMetadataCard
                  label="탐지 지점"
                  value={detectionsLoading ? "-" : recentDetections.length ? `${recentDetections.length}개` : "-"}
                  icon={Bug}
                />
              </div>
            </div>

            {/* Detection points list */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">탐지 지점 목록</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {detectionsError && (
                  <div className="p-4">
                    <Alert variant="destructive">
                      <AlertTitle>탐지 기록 불러오기 실패</AlertTitle>
                      <AlertDescription>{detectionsError}</AlertDescription>
                    </Alert>
                  </div>
                )}
                <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
                  {detectionsLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">불러오는 중...</div>
                  ) : detectionPoints.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">탐지 기록이 없습니다.</div>
                  ) : (
                    detectionPoints.map((point) => <DetectionPointItem key={point.id} {...point} />)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


