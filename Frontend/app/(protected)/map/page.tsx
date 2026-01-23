"use client"

import React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Map,
  Navigation,
  Target,
  MapPin,
  Bug,
  Clock,
  Download,
  RefreshCw,
  Info,
  History,
  Trash2,
  Grid3X3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useMapStore, type StoredMap, type MapStatus } from "@/hooks/useMapStore"

// ============================================
// Presentational Components (UI Only)
// ============================================

interface LargeMapVisualizationProps {
  status: MapStatus
}

function LargeMapVisualization({ status }: LargeMapVisualizationProps) {
  return (
    <div className="relative w-full aspect-[16/10] bg-zinc-900 rounded-lg overflow-hidden border border-border">
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
          <p className="text-muted-foreground text-lg">지도가 아직 생성되지 않았습니다</p>
          <p className="text-muted-foreground/60 text-sm mt-2">
            홈에서 지도 생성을 시작하세요
          </p>

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
          <p className="text-muted-foreground/60 text-sm mt-2">
            잠시만 기다려주세요
          </p>
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
          <div className="absolute top-4 right-4 flex items-center gap-3">
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
          <div className="absolute top-4 left-4 bg-black/70 rounded-full p-2">
            <Navigation className="h-5 w-5 text-white/80" />
          </div>

          {/* Scale indicator */}
          <div className="absolute bottom-4 left-4 bg-black/70 rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-white/60 rounded" />
              <span className="text-xs text-white/80">1m</span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="absolute bottom-4 right-4 bg-black/70 rounded px-3 py-2">
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

// Static demo data for display purposes
const demoDetectionPoints = [
  { id: "D1", type: "바퀴벌레", location: "구역 A (2.5m, 2.0m)", time: "14:23", status: "confirmed" as const },
  { id: "D2", type: "개미", location: "구역 C (10.0m, 3.0m)", time: "14:45", status: "confirmed" as const },
  { id: "D3", type: "바퀴벌레", location: "구역 B (4.5m, 6.0m)", time: "15:12", status: "confirmed" as const },
  { id: "D4", type: "미확인", location: "구역 B (7.5m, 6.5m)", time: "15:28", status: "pending" as const },
]

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

export default function MapDetailPage() {
  const { status: mapStatus, activeMap, maps, isInitialized, selectMap, deleteMap } = useMapStore()

  if (!isInitialized) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse bg-secondary/20 h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="rounded-lg">
              <Link href="/home">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>

            <div>
              <h1 className="text-2xl font-semibold text-foreground">지도 상세 보기</h1>
              <p className="text-sm text-muted-foreground mt-0.5">SLAM 기반 실내 맵핑 결과</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {maps.length > 0 && <MapHistoryDialog maps={maps} onSelect={selectMap} onDelete={deleteMap} />}
            {mapStatus === "completed" && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <MapPin className="h-3 w-3 mr-1" />
                지도 완료
              </Badge>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map visualization - spans 3 columns */}
          <div className="lg:col-span-3">
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-medium">지도 시각화</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      Occupancy Grid
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="bg-transparent">
                      <Download className="h-4 w-4 mr-1" />
                      내보내기
                    </Button>
                    <Button variant="outline" size="sm" className="bg-transparent">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      새로고침
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
                      실시간 로봇 위치 추적, 경로 계획, 수동 조종 기능이 곧 추가될 예정입니다.
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
              <MapMetadataCard label="생성 시각" value={activeMap?.generatedAt || "-"} icon={Clock} />
              <MapMetadataCard label="맵 영역" value={activeMap?.areaSize || "-"} icon={Map} />
              <MapMetadataCard label="로봇 ID" value={activeMap?.robotId || "-"} icon={Target} />
              <MapMetadataCard
                label="탐지 지점"
                value={activeMap ? `${activeMap.detectionsCount}개` : "-"}
                icon={Bug}
              />
            </div>

            {/* Detection points list */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">탐지 지점 목록</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
                  {demoDetectionPoints.map((point) => (
                    <DetectionPointItem key={point.id} {...point} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
