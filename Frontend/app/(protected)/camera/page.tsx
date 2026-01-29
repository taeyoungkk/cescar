"use client"

import React, { useMemo, useRef, useState } from "react"
import {
  Wifi,
  WifiOff,
  Camera,
  Clock,
  Circle,
  Square,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useCarStatus } from "@/hooks/useCarStatus"
import { useRecentDetections } from "@/hooks/useRecentDetections"
import * as carApi from "@/core/api/car"
import type { CarStatus, Detection } from "@/core/types"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"

// ============================================
// Presentational Components (UI Only)
// ============================================

interface LiveCameraViewProps {
  isOnline: boolean
  networkOnline: boolean
  isDetecting: boolean
  showOverlay: boolean
  lastDetectionLabel: string
  isManual: boolean
  manualDisabled: boolean
  onDriveStart: (command: "forward" | "backward" | "left" | "right" | "stop") => void
  onDriveStop: () => void
  wsUrl: string
  roomId: string
}

function LiveCameraView({
  isOnline,
  networkOnline,
  isDetecting,
  showOverlay,
  lastDetectionLabel,
  isManual,
  manualDisabled,
  onDriveStart,
  onDriveStop,
  wsUrl,
  roomId,
}: LiveCameraViewProps) {
    const [hasStream, setHasStream] = React.useState(false)
    const [connectionState, setConnectionState] = React.useState<"offline" | "connecting" | "signaling" | "connected" | "failed">("offline")
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
      setConnectionState(networkOnline ? "connecting" : "offline")

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

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState
        if (s === "connected" || s === "completed") setConnectionState("connected")
        if (s === "disconnected") setConnectionState("connecting")
        if (s === "failed") setConnectionState("failed")
      }
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState
        if (s === "connected") setConnectionState("connected")
        if (s === "connecting") setConnectionState("connecting")
        if (s === "failed") setConnectionState("failed")
      }

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
        setConnectionState("connected")

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
      setConnectionState("connecting")

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
        setConnectionState("signaling")
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
        setConnectionState("failed")
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
        setConnectionState(networkOnline ? "connecting" : "offline")
        if (videoRef.current) videoRef.current.srcObject = null
      }
    }, [cleanupWebRTC, roomId, wsUrl])

      React.useEffect(() => {
        if (!networkOnline) {
          connectingRef.current = false
          setConnectionState("offline")
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
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
        <Badge
          className={
            showVideo ? "bg-red-500/90 text-white border-transparent" : "bg-muted/90 text-muted-foreground border-transparent"
          }
        >
          <Circle className={`h-2 w-2 mr-1.5 ${showVideo ? "fill-white animate-pulse" : "fill-muted-foreground"}`} />
          {showVideo ? "LIVE" : "OFFLINE"}
        </Badge>
        <Badge
          className={
            connectionState === "connected"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : connectionState === "failed"
                ? "bg-red-500/20 text-red-300 border-red-500/30"
                : connectionState === "offline"
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
          }
        >
          {connectionState === "connected"
            ? "스트림 연결됨"
            : connectionState === "signaling"
              ? "신호 교환 중"
              : connectionState === "connecting"
                ? "연결 중"
                : connectionState === "failed"
                  ? "연결 실패"
                  : "오프라인"}
        </Badge>
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
            <p className="text-xs text-white/60">마지막 탐지: {lastDetectionLabel}</p>
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

      {isManual && (
        <div className="absolute bottom-16 right-4 z-30 rounded-lg border border-white/10 bg-black/60 p-1.5 backdrop-blur-sm">
          <div className="grid grid-cols-3 gap-2 place-items-center">
            <div aria-hidden="true" />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={manualDisabled}
              onPointerDown={() => onDriveStart("forward")}
              onPointerUp={onDriveStop}
              onPointerLeave={onDriveStop}
              onPointerCancel={onDriveStop}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              disabled={manualDisabled}
              onPointerDown={() => onDriveStart("stop")}
              onPointerUp={onDriveStop}
              onPointerLeave={onDriveStop}
              onPointerCancel={onDriveStop}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={manualDisabled}
              onPointerDown={() => onDriveStart("left")}
              onPointerUp={onDriveStop}
              onPointerLeave={onDriveStop}
              onPointerCancel={onDriveStop}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={manualDisabled}
              onPointerDown={() => onDriveStart("backward")}
              onPointerUp={onDriveStop}
              onPointerLeave={onDriveStop}
              onPointerCancel={onDriveStop}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={manualDisabled}
              onPointerDown={() => onDriveStart("right")}
              onPointerUp={onDriveStop}
              onPointerLeave={onDriveStop}
              onPointerCancel={onDriveStop}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ControlPanelProps {
  isLoading: boolean
  networkOnline: boolean
  driveMode: "AUTO" | "MANUAL" | "STOP"
  onChangeMode: (mode: "AUTO" | "MANUAL" | "STOP") => void
  onDriveStart: (command: "forward" | "backward" | "left" | "right" | "stop") => void
  onDriveStop: () => void
  modeError: string | null
}

function ControlPanel({
  isLoading,
  networkOnline,
  driveMode,
  onChangeMode,
  onDriveStart,
  onDriveStop,
  modeError,
}: ControlPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">주행 모드</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={driveMode === "AUTO" ? "default" : "outline"}
              className="w-full"
              onClick={() => onChangeMode("AUTO")}
            >
              AUTO
            </Button>
            <Button
              variant={driveMode === "MANUAL" ? "default" : "outline"}
              className="w-full"
              onClick={() => onChangeMode("MANUAL")}
            >
              MANUAL
            </Button>
            <Button
              variant={driveMode === "STOP" ? "default" : "outline"}
              className="w-full"
              onClick={() => onChangeMode("STOP")}
            >
              STOP
            </Button>
          </div>
          {modeError && <p className="text-xs text-red-400">{modeError}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

interface RobotStatusPanelProps {
  status: CarStatus | null
  isLoading: boolean
}

function RobotStatusPanel({ status, isLoading }: RobotStatusPanelProps) {
  if (isLoading || !status) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">차량 상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
          <div className="h-8 bg-secondary/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }
  const modeLabels: Record<CarStatus["mode"], string> = { STOP: "정지", MANUAL: "수동", AUTO: "자동" }
  const updatedLabel = new Date(status.updatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const xLabel = status.x == null ? "-" : status.x.toFixed(2)
  const yLabel = status.y == null ? "-" : status.y.toFixed(2)
  const headingLabel = Number.isFinite(status.heading) ? status.heading.toFixed(0) : "-"

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">차량 상태</CardTitle>
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

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">현재 모드</span>
          <Badge variant="secondary">{modeLabels[status.mode]}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">마지막 수신</span>
          <span className="text-sm text-muted-foreground font-mono">{updatedLabel}</span>
        </div>

        <div className="rounded-md border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
          좌표: X {xLabel} / Y {yLabel} · 방향: {headingLabel}°
        </div>
      </CardContent>
    </Card>
  )
}

interface EventLogProps {
  detections: Detection[]
  isLoading: boolean
  onSelect: (id: string) => void
  baseUrl: string
}

function EventLog({ detections, isLoading, onSelect, baseUrl }: EventLogProps) {
  const typeLabels: Record<string, string> = {
    cockroach: "바퀴벌레",
    ant: "개미",
    fly: "파리",
    mosquito: "모기",
    spider: "거미",
    unknown: "미확인",
  }

  const resolveMediaUrl = (path?: string) => {
    if (!path) return null
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    return `${baseUrl}${path}`
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">탐지 로그</CardTitle>
          <Badge variant="secondary" className="text-xs">
            최근 {detections.length}건
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
            {detections.map((event) => {
              const snapshotUrl = resolveMediaUrl(event.snapshotUrl)
              return (
              <div
                key={event.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => onSelect(event.id)}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">{event.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  {snapshotUrl && (
                    <HoverCard openDelay={200}>
                      <HoverCardTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-48 p-2">
                        <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-secondary/40">
                          <img src={snapshotUrl} alt="snapshot preview" className="h-full w-full object-cover" />
                        </div>
                        <div className="mt-2 flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(snapshotUrl, "_blank")
                            }}
                          >
                            새 창 보기
                          </Button>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                  <span className="text-sm text-foreground">{typeLabels[event.type] || event.type}</span>
                </div>
              </div>
            )})}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

export default function CameraPage() {
  const { isOnline: networkOnline } = useNetworkStatus()
  const { toast } = useToast()
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

  const [cars, setCars] = useState<{ carId: number; nickname: string }[]>([])
  const [carsLoading, setCarsLoading] = useState(true)
  const [carsError, setCarsError] = useState<string | null>(null)
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null)

  const carStatus = useCarStatus(selectedCarId ?? 0, { enabled: !!selectedCarId, intervalMs: 1000 })
  const recentDetections = useRecentDetections(selectedCarId, 10)

  // Local UI state only (no data)
  const [showOverlay, setShowOverlay] = useState(true)
  const [driveMode, setDriveMode] = useState<"AUTO" | "MANUAL" | "STOP">("STOP")
  const [modeError, setModeError] = useState<string | null>(null)
  const lastDriveToastRef = useRef<number>(0)

  const driveTimerRef = useRef<number | null>(null)
  const driveCommandRef = useRef<"forward" | "backward" | "left" | "right" | "stop" | null>(null)

  React.useEffect(() => {
    let mounted = true
    setCarsLoading(true)
    carApi
      .getMyCars()
      .then((list) => {
        if (!mounted) return
        setCars(list.map((c) => ({ carId: c.carId, nickname: c.nickname })))
        setSelectedCarId((prev) => prev ?? list[0]?.carId ?? null)
        setCarsError(null)
      })
      .catch((e: any) => {
        if (!mounted) return
        setCarsError(e?.message ?? "차량 목록을 불러오는데 실패했습니다.")
      })
      .finally(() => {
        if (!mounted) return
        setCarsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const lastDetectionLabel = useMemo(() => {
    const latest = recentDetections.recentDetections[0]
    if (!latest) return "-"
    return `${latest.date} ${latest.time}`
  }, [recentDetections.recentDetections])

  const isDetecting = useMemo(() => {
    const latest = recentDetections.recentDetections[0]
    if (!latest?.timestamp) return false
    const last = new Date(latest.timestamp)
    if (Number.isNaN(last.getTime())) return false
    return Date.now() - last.getTime() < 60_000
  }, [recentDetections.recentDetections])

  React.useEffect(() => {
    if (carStatus.data?.mode) {
      setDriveMode(carStatus.data.mode)
    }
  }, [carStatus.data?.mode])

  const handleChangeMode = async (mode: "AUTO" | "MANUAL" | "STOP") => {
    if (!selectedCarId) return
    const prev = driveMode
    setDriveMode(mode)
    setModeError(null)
    if (!networkOnline) {
      setModeError("오프라인 상태에서는 모드를 변경할 수 없습니다.")
      setDriveMode(prev)
      toast({ title: "모드 변경 실패", description: "오프라인 상태입니다." })
      return
    }
    try {
      await carApi.setCarMode(selectedCarId, mode)
      toast({ title: "모드 변경 완료", description: `현재 모드: ${mode}` })
    } catch {
      setDriveMode(prev)
      setModeError("모드 변경에 실패했습니다. 다시 시도해주세요.")
      toast({ title: "모드 변경 실패", description: "잠시 후 다시 시도해주세요." })
    }
  }

  const sendDriveCommand = async (command: "forward" | "backward" | "left" | "right" | "stop") => {
    if (!selectedCarId || !networkOnline || driveMode !== "MANUAL") return
    const map: Record<typeof command, { v: number; w: number }> = {
      forward: { v: 0.3, w: 0 },
      backward: { v: -0.3, w: 0 },
      left: { v: 0, w: 0.6 },
      right: { v: 0, w: -0.6 },
      stop: { v: 0, w: 0 },
    }

    const { v, w } = map[command]
    try {
      await carApi.controlCar(selectedCarId, v, w)
    } catch {
      const now = Date.now()
      if (now - lastDriveToastRef.current > 2000) {
        toast({ title: "수동 조작 실패", description: "차량 제어 요청이 실패했습니다." })
        lastDriveToastRef.current = now
      }
    }
  }

  const handleDriveStart = (command: "forward" | "backward" | "left" | "right" | "stop") => {
    if (driveMode !== "MANUAL") return
    driveCommandRef.current = command
    if (driveTimerRef.current != null) {
      window.clearInterval(driveTimerRef.current)
      driveTimerRef.current = null
    }
    sendDriveCommand(command).catch(() => {})
    driveTimerRef.current = window.setInterval(() => {
      if (!driveCommandRef.current) return
      sendDriveCommand(driveCommandRef.current).catch(() => {})
    }, 200)
  }

  const handleDriveStop = () => {
    driveCommandRef.current = null
    if (driveTimerRef.current != null) {
      window.clearInterval(driveTimerRef.current)
      driveTimerRef.current = null
    }
    sendDriveCommand("stop").catch(() => {})
  }

  React.useEffect(() => {
    return () => {
      if (driveTimerRef.current != null) {
        window.clearInterval(driveTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-[1920px] mx-auto h-full">
        <div className="mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">실시간 카메라</h1>
            <p className="text-sm text-muted-foreground mt-1">로봇 카메라 영상을 실시간으로 확인하세요</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1">
            <div className="w-full">
              <div className="relative w-full aspect-video max-h-[60vh] lg:max-h-[70vh]">
            <LiveCameraView
              isOnline={carStatus.data?.isOnline ?? false}
              networkOnline={networkOnline}
              isDetecting={isDetecting}
              showOverlay={showOverlay}
              lastDetectionLabel={lastDetectionLabel}
              isManual={driveMode === "MANUAL"}
              manualDisabled={!networkOnline || carStatus.isLoading}
              onDriveStart={handleDriveStart}
              onDriveStop={handleDriveStop}
              wsUrl={process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://I14B201.p.ssafy.io/ws/webrtc"}
              roomId={process.env.NEXT_PUBLIC_ROBOT_ROOM_ID ?? "robot_default"}
            />
              </div>
            </div>
            <div className="mt-3">
            <ControlPanel
              isLoading={carStatus.isLoading}
              networkOnline={networkOnline}
              driveMode={driveMode}
                onChangeMode={handleChangeMode}
                onDriveStart={handleDriveStart}
                onDriveStop={handleDriveStop}
                modeError={modeError}
              />
            </div>
          </div>

          <div className="w-full lg:w-80 xl:w-96 space-y-3">
            <Card className="bg-card border-border">
              <CardContent className="space-y-1.5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">차량 선택</p>
                  {selectedCarId && (
                    <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                      {selectedCarId}
                    </Badge>
                  )}
                </div>
                <Select
                  value={selectedCarId ? String(selectedCarId) : ""}
                  onValueChange={(value) => setSelectedCarId(Number(value))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder={carsLoading ? "차량 로딩 중..." : "차량 선택"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cars.map((c) => (
                      <SelectItem key={c.carId} value={String(c.carId)}>
                        {c.nickname} · {c.carId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="min-h-[14px] text-[11px] text-muted-foreground">
                  {carsLoading ? "차량 목록 불러오는 중..." : "제어할 차량을 선택하세요."}
                </p>
                <p className="min-h-[14px] text-[11px] text-red-400">{carsError ?? ""}</p>
              </CardContent>
            </Card>
            <RobotStatusPanel status={carStatus.data} isLoading={carStatus.isLoading} />

            <EventLog
              detections={recentDetections.recentDetections}
              isLoading={recentDetections.isLoading}
              onSelect={(id) => {
                window.location.href = `/dashboard?detectionId=${id}`
              }}
              baseUrl={baseUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
