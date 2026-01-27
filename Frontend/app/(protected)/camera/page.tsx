"use client"

import React, { useState } from "react"
import {
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Camera,
  AlertTriangle,
  Clock,
  Circle,
  Play,
  Square,
  ImageIcon,
  Eye,
  EyeOff,
  SignalLow,
  SignalMedium,
  SignalHigh,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { useRobotStatus } from "@/hooks/useRobotStatus"
import type { RobotStatus, CameraEvent, ConnectionQuality } from "@/core/types"
import { OfflineGuardButton } from "@/components/offline-guard-button"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"

// ============================================
// Presentational Components (UI Only)
// ============================================

interface ConnectionQualityIndicatorProps {
  quality: ConnectionQuality
}

function ConnectionQualityIndicator({ quality }: ConnectionQualityIndicatorProps) {
  const config = {
    excellent: { icon: SignalHigh, label: "우수", color: "text-emerald-400" },
    good: { icon: SignalMedium, label: "양호", color: "text-amber-400" },
    poor: { icon: SignalLow, label: "불안정", color: "text-red-400" },
  }

  const { icon: Icon, label, color } = config[quality]

  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

interface LiveCameraViewProps {
  isOnline: boolean
  networkOnline: boolean
  isDetecting: boolean
  showOverlay: boolean
  connectionQuality: ConnectionQuality
  wsUrl: string
  roomId: string
}

function LiveCameraView({
  isOnline,
  networkOnline,
  isDetecting,
  showOverlay,
  connectionQuality,
  wsUrl,
  roomId,
}: LiveCameraViewProps) {
    const [hasStream, setHasStream] = React.useState(false)
    const showVideo = hasStream
    const closingRef = React.useRef(false)

    const videoRef = React.useRef<HTMLVideoElement | null>(null)

    const wsRef = React.useRef<WebSocket | null>(null)
    const pcRef = React.useRef<RTCPeerConnection | null>(null)
    const pendingCandidatesRef = React.useRef<RTCIceCandidateInit[]>([])

    const connectingRef = React.useRef(false)

    const cleanupWebRTC = React.useCallback(() => {
      connectingRef.current = false
      closingRef.current = true

      const pc = pcRef.current
      const ws = wsRef.current

      // 핸들러 제거
      if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        // ws.onclose = null
      }
      if (pc) {
        pc.onicecandidate = null
        pc.ontrack = null
        pc.oniceconnectionstatechange = null
        pc.onconnectionstatechange = null
      }

      try { pc?.close() } catch {}
      try { ws?.close() } catch {}

      pcRef.current = null
      wsRef.current = null
      pendingCandidatesRef.current = []
      setHasStream(false)
      if (videoRef.current) videoRef.current.srcObject = null

      // 다음 connect를 위해 복구
      // setTimeout(() => { closingRef.current = false }, 0)
    }, [])

    const ICE_SERVERS: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // TURN 있으면 여기에 추가
    ]

    const send = (msg: any) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify(msg))
    }

    const createPeerConnection = () => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      pc.oniceconnectionstatechange = () => console.log("[ice]", pc.iceConnectionState)
      pc.onconnectionstatechange = () => console.log("[pc]", pc.connectionState)

      pc.addTransceiver("video", { direction: "recvonly" })

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        // Jetson이 기대하는 candidate 포맷으로 보냄
        send({
          type: "candidate",
          roomId,
          candidate: ev.candidate.candidate,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
          sdpMid: ev.candidate.sdpMid,
          data: {
            candidate: ev.candidate.candidate,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
            sdpMid: ev.candidate.sdpMid,
          },
        })
      }

      pc.ontrack = (ev) => {
        console.log("[ontrack]", ev.track.kind, ev.streams)

        const stream = ev.streams?.[0] ?? new MediaStream([ev.track])
        setHasStream(true)

        const video = videoRef.current

        if (!video) return
        console.log("before set, srcObject?", !!videoRef.current?.srcObject)
        video.srcObject = stream
        console.log("after set, srcObject?", !!videoRef.current?.srcObject)
        video.play().catch(() => {})

        // if (ev.streams?.[0]) {
        //   setHasStream(true)
        //   videoRef.current.srcObject = ev.streams[0]
        //   videoRef.current.play().catch(() => {})
        // }
      }
    }

    const handleOffer = async (payload: any) => {
      const pc = pcRef.current
      if (!pc) return
      const sdp = payload?.sdp
      if (!sdp) return

      await pc.setRemoteDescription({ type: "offer", sdp })

      // offer 전에 쌓인 candidate 처리
      for (const c of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      }
      pendingCandidatesRef.current = []

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // Jetson이 기대하는 answer 포맷 (data.sdp를 뽑아씀)
      send({
        type: "answer",
        roomId,
        sdp: answer.sdp,
        data: { type: "answer", sdp: answer.sdp },
      })
    }

    const handleCandidate = async (payload: any) => {
      const pc = pcRef.current
      if (!pc) return

      const cand: RTCIceCandidateInit = {
        candidate: payload?.candidate,
        sdpMLineIndex: payload?.sdpMLineIndex ?? 0,
        sdpMid: payload?.sdpMid,
      }
      if (!cand.candidate) return

      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } else {
        pendingCandidatesRef.current.push(cand)
      }
    }

    const connectWebRTC = React.useCallback(() => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return
      }

      if (!wsUrl || !roomId) return

      // 이전 pc가 남아있으면 닫고 새로 시작
      if (pcRef.current) {
        try { pcRef.current.close() } catch {}
        pcRef.current = null
      }
      pendingCandidatesRef.current = []
      setHasStream(false)
      if (videoRef.current) videoRef.current.srcObject = null


      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        send({ type: "join", roomId })
        createPeerConnection()
        send({ type: "ready", roomId })
      }

      ws.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data)

        // Spring이 릴레이만 하니까 msg.data가 있든 없든 방어
        if (msg.type === "offer") await handleOffer(msg.data ?? msg)
        if (msg.type === "candidate") await handleCandidate(msg.data ?? msg)
        // answer는 viewer가 받는 쪽이면 보통 안 옴(offer 주도 Jetson이라서)
      }

      ws.onerror = () => {
        connectingRef.current = false
      }

      ws.onclose = () => {
        if (closingRef.current) {
          closingRef.current = false
          return
        }

        connectingRef.current = false
        pcRef.current = null
        wsRef.current = null
        pendingCandidatesRef.current = []
        setHasStream(false)
        if (videoRef.current) videoRef.current.srcObject = null
      }
    }, [cleanupWebRTC, roomId, wsUrl])

      React.useEffect(() => {
        if (!networkOnline) {
          connectingRef.current = false
          cleanupWebRTC()
          return
        }

        if (connectingRef.current) return
        connectingRef.current = true

        connectWebRTC()

        return () =>{
          connectingRef.current = false
          cleanupWebRTC()
        }
      }, [networkOnline, connectWebRTC, cleanupWebRTC])

  const [currentTime, setCurrentTime] = useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 z-10 w-full h-full object-cover transition-opacity ${hasStream ? "opacity-100" : "opacity-0"}`}
      />

      {showVideo ? (
        <>
          <div
            className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
            style={{
              backgroundImage: `
                radial-gradient(circle at 30% 40%, rgba(50, 50, 55, 0.8) 0%, transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(45, 45, 50, 0.6) 0%, transparent 40%),
                radial-gradient(circle at 50% 80%, rgba(40, 40, 45, 0.5) 0%, transparent 30%)
              `,
            }}
          />

          <div
            className="absolute inset-0 z-20 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(255, 255, 255, 0.1) 2px,
                rgba(255, 255, 255, 0.1) 4px
              )`,
            }}
          />

          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2 opacity-20">
              <Camera className="h-20 w-20 text-white/40 mx-auto" />
              <p className="text-xs text-white/40 font-mono tracking-wider">CESCAR-CAM-01</p>
            </div>
          </div>

          {showOverlay && (
            <>
              <div className="absolute top-[25%] left-[20%] pointer-events-none animate-pulse" style={{ animationDuration: "2s" }}>
                <div className="relative">
                  <div className="w-24 h-16 border-2 border-emerald-400/70 rounded" />
                  <div className="absolute -top-5 left-0 text-[10px] text-emerald-400 font-mono bg-black/50 px-1 rounded">
                    바퀴벌레 94%
                  </div>
                </div>
              </div>

              <div className="absolute top-[55%] left-[60%] pointer-events-none">
                <div className="relative">
                  <div className="w-16 h-12 border-2 border-amber-400/60 rounded" />
                  <div className="absolute -top-5 left-0 text-[10px] text-amber-400 font-mono bg-black/50 px-1 rounded">
                    개미 78%
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-center space-y-3">
            <WifiOff className="h-16 w-16 text-red-400/50 mx-auto" />
            <p className="text-sm text-red-400">카메라 스트림 대기 중</p>
            <p className="text-xs text-muted-foreground">WebRTC 연결 중...</p>
          </div>
        </div>
      )}

      {/* Top left badges */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <Badge
          className={
            showVideo ? "bg-red-500/90 text-white border-transparent" : "bg-muted/90 text-muted-foreground border-transparent"
          }
        >
          <Circle className={`h-2 w-2 mr-1.5 ${showVideo ? "fill-white animate-pulse" : "fill-muted-foreground"}`} />
          {showVideo ? "LIVE" : "OFFLINE"}
        </Badge>

        {showVideo && (
          <div className="bg-black/70 rounded px-2.5 py-1">
            <ConnectionQualityIndicator quality={connectionQuality} />
          </div>
        )}
      </div>

      {/* Top right badges */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {showVideo && (
          <>
            <div className="flex items-center gap-1.5 bg-black/70 rounded px-2.5 py-1">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white font-medium">REC</span>
            </div>
            <div className="bg-black/70 rounded px-2.5 py-1">
              <span className="text-xs text-white/80 font-mono">1920x1080 30fps</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${isDetecting ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className={`text-sm font-medium ${isDetecting ? "text-emerald-400" : "text-amber-400"}`}>
                {isDetecting ? "탐지 중" : "대기 중"}
              </span>
            </div>
            <p className="text-xs text-white/60">마지막 탐지: 3분 전</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-xs text-white/80 font-mono">
              {currentTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-[10px] text-white/50 font-mono">{currentTime.toLocaleDateString("ko-KR")}</p>
          </div>
        </div>
      </div>

      {/* Center crosshair */}
      {showVideo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-40 h-40 border border-white/10 rounded-lg" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-white/20" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-6 bg-white/20" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-px bg-white/20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-px bg-white/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-white/30 rounded-full" />
        </div>
      )}
    </div>
  )
}

interface ControlPanelProps {
  showOverlay: boolean
  onToggleOverlay: () => void
  onCapture: () => void
  isLoading: boolean
  networkOnline: boolean
}

function ControlPanel({
  showOverlay,
  onToggleOverlay,
  onCapture,
  isLoading,
  networkOnline,
}: ControlPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">제어 패널</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-px bg-border" />

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">카메라 제어</p>
          <OfflineGuardButton
            variant="secondary"
            className="w-full justify-start"
            onClick={onCapture}
            disabled={isLoading || !networkOnline}
            offlineMessage="네트워크에 연결되어야 스냅샷을 캡처할 수 있습니다"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            스냅샷 캡처
          </OfflineGuardButton>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {showOverlay ? (
                <Eye className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm text-foreground">바운딩 박스 표시</span>
            </div>
            <Switch checked={showOverlay} onCheckedChange={onToggleOverlay} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface RobotStatusPanelProps {
  status: RobotStatus | null
  isLoading: boolean
}

function RobotStatusPanel({ status, isLoading }: RobotStatusPanelProps) {
  if (isLoading || !status) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">로봇 상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const getBatteryColor = (level: number) => {
    if (level > 50) return "text-emerald-400"
    if (level > 20) return "text-amber-400"
    return "text-red-400"
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">로봇 상태</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.isOnline ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
            <span className="text-sm text-foreground">연결 상태</span>
          </div>
          <Badge
            className={
              status.isOnline
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }
          >
            {status.isOnline ? "온라인" : "오프라인"}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status.batteryLevel > 20 ? (
                <Battery className={`h-4 w-4 ${getBatteryColor(status.batteryLevel)}`} />
              ) : (
                <BatteryLow className={`h-4 w-4 ${getBatteryColor(status.batteryLevel)}`} />
              )}
              <span className="text-sm text-foreground">배터리</span>
            </div>
            <span className={`text-sm font-medium ${getBatteryColor(status.batteryLevel)}`}>{status.batteryLevel}%</span>
          </div>
          <Progress value={status.batteryLevel} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">이동 상태</span>
          <Badge variant="secondary">{status.isMoving ? "이동 중" : "정지"}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

interface EventLogProps {
  events: CameraEvent[]
  isLoading: boolean
}

function EventLog({ events, isLoading }: EventLogProps) {
  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">탐지 로그</CardTitle>
          <Badge variant="secondary" className="text-xs">
            최근 {events.length}건
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="max-h-48 overflow-y-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-border last:border-b-0">
                <div className="h-5 bg-secondary/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">{event.time}</span>
                </div>
                <span className="text-sm text-foreground">{typeLabels[event.type] || event.type}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface WarningMessagesProps {
  hasLowBattery: boolean
  batteryLevel: number
}

function WarningMessages({ hasLowBattery, batteryLevel }: WarningMessagesProps) {
  if (!hasLowBattery) return null

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">경고</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <span className="text-sm text-foreground">배터리 잔량 {batteryLevel}% 이하</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

export default function CameraPage() {
  const { isOnline: networkOnline } = useNetworkStatus()

  // All data fetching via hooks
  const { robotStatus, cameraEvents, isLoading, isDetecting, captureSnapshot } = useRobotStatus()

  // Local UI state only (no data)
  const [showOverlay, setShowOverlay] = useState(true)

  const handleCapture = async () => {
    await captureSnapshot()
  }

  const hasLowBattery = (robotStatus?.batteryLevel ?? 100) <= 30

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-[1920px] mx-auto h-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground">실시간 카메라</h1>
          <p className="text-sm text-muted-foreground mt-1">로봇 카메라 영상을 실시간으로 확인하세요</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-h-[400px] lg:min-h-[600px]">
            <LiveCameraView
              isOnline={robotStatus?.isOnline ?? false}
              networkOnline={networkOnline}
              isDetecting={isDetecting}
              showOverlay={showOverlay}
              connectionQuality={robotStatus?.connectionQuality ?? "good"}
              wsUrl={process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://I14B201.p.ssafy.io/ws/webrtc"}
              roomId={process.env.NEXT_PUBLIC_ROBOT_ROOM_ID ?? "robot_default"}
            />
          </div>

          <div className="w-full lg:w-80 xl:w-96 space-y-4">
            <ControlPanel
              showOverlay={showOverlay}
              onToggleOverlay={setShowOverlay}
              onCapture={handleCapture}
              isLoading={isLoading}
              networkOnline={networkOnline}
            />

            <RobotStatusPanel status={robotStatus} isLoading={isLoading} />

            <EventLog events={cameraEvents} isLoading={isLoading} />

            <WarningMessages hasLowBattery={hasLowBattery} batteryLevel={robotStatus?.batteryLevel ?? 100} />
          </div>
        </div>
      </div>
    </div>
  )
}
