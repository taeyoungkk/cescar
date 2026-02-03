"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useCarStatus } from "@/hooks/useCarStatus"
import { useRecentDetections } from "@/hooks/useRecentDetections"
import * as carApi from "@/core/api/car"
import * as mapApi from "@/core/api/map"
import type { CarDetail, CarStatus, Detection, DetectionStats } from "@/core/types"
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
  activeDriveCommand: "forward" | "backward" | "left" | "right" | "stop" | null
  wsUrl: string
  detectionWsUrl: string
  roomId: string
  cameraConnected: boolean
  onToggleCameraConnection: () => void
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
  activeDriveCommand,
  wsUrl,
  detectionWsUrl,
  roomId,
  cameraConnected,
  onToggleCameraConnection,
}: LiveCameraViewProps) {
  const [hasStream, setHasStream] = React.useState(false)
  const [connectionState, setConnectionState] = React.useState<"offline" | "connecting" | "signaling" | "connected" | "failed">("offline")
  const showVideo = hasStream
  const closingRef = React.useRef(false)

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const wsRef = React.useRef<WebSocket | null>(null)
  const detectionWsRef = React.useRef<WebSocket | null>(null)
  const pcRef = React.useRef<RTCPeerConnection | null>(null)
  const pendingCandidatesRef = React.useRef<RTCIceCandidateInit[]>([])

  const connectingRef = React.useRef(false)
  const detectionConnectingRef = React.useRef(false)
  const detectionReconnectRef = React.useRef<number | null>(null)
  const [detections, setDetections] = React.useState<
    { x: number; y: number; w: number; h: number; label?: string; confidence?: number }[]
  >([])

  const cleanupWebRTC = React.useCallback(() => {
    connectingRef.current = false
    closingRef.current = true
    setConnectionState(networkOnline ? "connecting" : "offline")

    const pc = pcRef.current
    const ws = wsRef.current

    // ?몃뱾???쒓굅
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

    try { pc?.close() } catch { }
    try { ws?.close() } catch { }

    pcRef.current = null
    wsRef.current = null
    pendingCandidatesRef.current = []
    setHasStream(false)
    if (videoRef.current) videoRef.current.srcObject = null

    // ?ㅼ쓬 connect瑜??꾪빐 蹂듦뎄
    // setTimeout(() => { closingRef.current = false }, 0)
  }, [networkOnline])

  const cleanupDetections = React.useCallback(() => {
    detectionConnectingRef.current = false
    if (detectionReconnectRef.current != null) {
      window.clearTimeout(detectionReconnectRef.current)
      detectionReconnectRef.current = null
    }

    const ws = detectionWsRef.current
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try { ws.close() } catch { }
    }
    detectionWsRef.current = null
    setDetections([])

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  const normalizeDetections = React.useCallback((payload: any) => {
    if (!payload) return []
    const pickArray = (value: any) => (Array.isArray(value) ? value : null)
    const candidates =
      pickArray(payload) ??
      pickArray(payload?.detections) ??
      pickArray(payload?.boxes) ??
      pickArray(payload?.bboxes) ??
      pickArray(payload?.data?.detections) ??
      pickArray(payload?.data?.boxes) ??
      pickArray(payload?.data)

    const list = candidates ?? [payload]

    const toNumber = (value: any) => {
      const num = typeof value === "string" ? Number(value) : value
      return Number.isFinite(num) ? num : null
    }

    const toBox = (box: any) => {
      if (!box) return null
      const x1 = toNumber(box.x1 ?? box.left)
      const y1 = toNumber(box.y1 ?? box.top)
      const x2 = toNumber(box.x2 ?? box.right)
      const y2 = toNumber(box.y2 ?? box.bottom)
      const x = toNumber(box.x ?? x1)
      const y = toNumber(box.y ?? y1)
      const w = toNumber(box.w ?? box.width ?? (x1 != null && x2 != null ? x2 - x1 : null))
      const h = toNumber(box.h ?? box.height ?? (y1 != null && y2 != null ? y2 - y1 : null))

      if (x == null || y == null || w == null || h == null) return null
      if (w <= 0 || h <= 0) return null

      return {
        x,
        y,
        w,
        h,
        label: box.label ?? box.class ?? box.type,
        confidence: toNumber(box.confidence ?? box.score),
      }
    }

    return list.map(toBox).filter(Boolean) as {
      x: number
      y: number
      w: number
      h: number
      label?: string
      confidence?: number
    }[]
  }, [])

  const drawDetections = React.useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const rect = video.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (!showOverlay || detections.length === 0) return

    const videoWidth = video.videoWidth || rect.width
    const videoHeight = video.videoHeight || rect.height
    const scaleX = rect.width / videoWidth
    const scaleY = rect.height / videoHeight

    ctx.lineWidth = 2
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"

    detections.forEach((det) => {
      let { x, y, w, h } = det
      const normalized = [x, y, w, h].every((value) => value >= 0 && value <= 1)

      if (normalized) {
        x = x * rect.width
        y = y * rect.height
        w = w * rect.width
        h = h * rect.height
      } else {
        x = x * scaleX
        y = y * scaleY
        w = w * scaleX
        h = h * scaleY
      }

      ctx.strokeStyle = "rgba(52, 211, 153, 0.9)"
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
      ctx.strokeRect(x, y, w, h)

      if (det.label) {
        const confidenceText =
          det.confidence != null && Number.isFinite(det.confidence) ? ` ${(det.confidence * 100).toFixed(0)}%` : ""
        const text = `${det.label}${confidenceText}`
        const textWidth = ctx.measureText(text).width
        const paddingX = 6
        const paddingY = 4
        const labelX = x
        const labelY = Math.max(0, y - 18)

        ctx.fillRect(labelX, labelY, textWidth + paddingX * 2, 18)
        ctx.fillStyle = "rgba(52, 211, 153, 0.95)"
        ctx.fillText(text, labelX + paddingX, labelY + 13)
      }
    })
  }, [detections, showOverlay])

  React.useEffect(() => {
    drawDetections()
  }, [drawDetections])

  React.useEffect(() => {
    const handleResize = () => drawDetections()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [drawDetections])

  const connectDetections = React.useCallback(() => {
    if (detectionWsRef.current && (detectionWsRef.current.readyState === WebSocket.OPEN || detectionWsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }
    if (!detectionWsUrl || !roomId) return

    detectionConnectingRef.current = true

    const ws = new WebSocket(detectionWsUrl)
    detectionWsRef.current = ws

    ws.onopen = () => {
      detectionConnectingRef.current = false
      ws.send(JSON.stringify({ type: "join", roomId }))
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        setDetections(normalizeDetections(msg))
      } catch {
        setDetections([])
      }
    }

    ws.onerror = () => {
      try { ws.close() } catch { }
    }

    ws.onclose = () => {
      detectionWsRef.current = null
      if (!networkOnline) return
      const delay = 1000 + Math.random() * 2000
      if (detectionReconnectRef.current != null) {
        window.clearTimeout(detectionReconnectRef.current)
      }
      detectionReconnectRef.current = window.setTimeout(() => {
        connectDetections()
      }, delay)
    }
  }, [detectionWsUrl, networkOnline, normalizeDetections, roomId])

  React.useEffect(() => {
    if (!networkOnline || !cameraConnected) {
      cleanupDetections()
      return
    }
    connectDetections()
    return () => {
      cleanupDetections()
    }
  }, [networkOnline, cameraConnected, connectDetections, cleanupDetections])

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
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
      // Jetson??湲곕??섎뒗 candidate ?щ㎎?쇰줈 蹂대깂
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
      video.play().catch(() => { })

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

    // offer ?꾩뿉 ?볦씤 candidate 泥섎━
    for (const c of pendingCandidatesRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c))
    }
    pendingCandidatesRef.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Jetson??湲곕??섎뒗 answer ?щ㎎ (data.sdp瑜?戮묒븘?)
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

    // ?댁쟾 pc媛 ?⑥븘?덉쑝硫??リ퀬 ?덈줈 ?쒖옉
    if (pcRef.current) {
      try { pcRef.current.close() } catch { }
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

      // Spring??由대젅?대쭔 ?섎땲源?msg.data媛 ?덈뱺 ?녿뱺 諛⑹뼱
      if (msg.type === "offer") await handleOffer(msg.data ?? msg)
      if (msg.type === "candidate") await handleCandidate(msg.data ?? msg)
      // answer??viewer媛 諛쏅뒗 履쎌씠硫?蹂댄넻 ????offer 二쇰룄 Jetson?대씪??
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
    if (!networkOnline || !cameraConnected) {
      connectingRef.current = false
      setConnectionState(cameraConnected ? "offline" : "offline")
      cleanupWebRTC()
      return
    }

    if (connectingRef.current) return
    connectingRef.current = true

    connectWebRTC()

    return () => {
      connectingRef.current = false
      cleanupWebRTC()
    }
  }, [networkOnline, cameraConnected, connectWebRTC, cleanupWebRTC])

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
      <canvas ref={canvasRef} className="absolute inset-0 z-30 pointer-events-none" aria-hidden="true" />

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

        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-center space-y-4 pointer-events-auto relative z-50">
            {!cameraConnected ? (
              <>
                <Camera className="h-16 w-16 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground">카메라가 연결되지 않았습니다</p>
                <button
                  type="button"
                  onClick={() => {
                    console.log("[Camera] Connect button clicked!")
                    onToggleCameraConnection()
                  }}
                  className="mt-3 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium shadow-lg shadow-blue-500/30 cursor-pointer pointer-events-auto relative z-50
                    hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/50 hover:scale-105 hover:-translate-y-0.5
                    active:from-blue-700 active:to-blue-600 active:scale-95 active:shadow-blue-500/20
                    focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-zinc-900
                    transition-all duration-150 ease-out flex items-center gap-2 mx-auto"
                >
                  <Camera className="h-4 w-4" />
                  카메라 연결
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <WifiOff className="h-16 w-16 text-amber-400/60 mx-auto animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                </div>
                <p className="text-sm text-amber-400">카메라 스트림 연결 중...</p>
                <p className="text-xs text-muted-foreground">WebRTC 연결을 시도하고 있습니다</p>
                <button
                  type="button"
                  onClick={() => {
                    console.log("[Camera] Cancel button clicked!")
                    onToggleCameraConnection()
                  }}
                  className="mt-2 px-4 py-2 rounded-lg border border-white/30 text-white/80 text-sm cursor-pointer
                    hover:bg-white/15 hover:border-white/50 hover:text-white hover:scale-105
                    active:bg-white/25 active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-white/50
                    transition-all duration-150"
                >
                  연결 취소
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top left badges */}
      <div className="absolute top-3 left-3 z-40 flex flex-wrap items-center gap-2 sm:top-4 sm:left-4">
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
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2 sm:top-4 sm:right-4">
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
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-5">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${isDetecting ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className={`text-[11px] font-medium sm:text-sm ${isDetecting ? "text-emerald-400" : "text-amber-400"}`}>
                {isDetecting ? "탐지 중" : "대기 중"}
              </span>
            </div>
            <p className="text-[10px] text-white/60 sm:text-xs">마지막 탐지: {lastDetectionLabel}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[10px] text-white/80 font-mono sm:text-xs">
              {currentTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-[9px] text-white/50 font-mono sm:text-[10px]">{currentTime.toLocaleDateString("ko-KR")}</p>
          </div>
        </div>
      </div>

      {/* Center crosshair */}
      {showVideo && (
        <div className="absolute top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-40 h-40 border border-white/10 rounded-lg" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-white/20" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-6 bg-white/20" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-px bg-white/20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-px bg-white/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-white/30 rounded-full" />
        </div>
      )}

      {isManual && (
        <div className="absolute bottom-16 right-3 z-40 hidden select-none sm:block">
          {/* Control pad container */}
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent blur-md" />

            {/* Main control pad - 2 row keyboard-style layout */}
            <div className="relative rounded-lg border border-white/15 bg-black/60 backdrop-blur-md p-1.5 shadow-lg">
              {/* Keyboard hint */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-[8px] text-white/25 font-medium">⌨️</span>
              </div>

              {/* Row 1: Up arrow centered */}
              <div className="flex justify-center mb-1">
                <button
                  type="button"
                  disabled={manualDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.setPointerCapture?.(e.pointerId)
                    onDriveStart("forward")
                  }}
                  onPointerUp={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onPointerLeave={(e) => {
                    onDriveStop()
                    e.currentTarget.blur()
                  }}
                  onPointerCancel={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  className={`group h-7 w-7 touch-none rounded bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:from-white/25 hover:to-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-75 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none ${
                    activeDriveCommand === "forward" ? "ring-2 ring-emerald-400/80 bg-emerald-500/20 border-emerald-400/60" : ""
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5 text-white/70 group-hover:text-white group-active:text-blue-200" />
                </button>
              </div>

              {/* Row 2: Left, Down, Right */}
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={manualDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.setPointerCapture?.(e.pointerId)
                    onDriveStart("left")
                  }}
                  onPointerUp={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onPointerLeave={(e) => {
                    onDriveStop()
                    e.currentTarget.blur()
                  }}
                  onPointerCancel={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  className={`group h-7 w-7 touch-none rounded bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:from-white/25 hover:to-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-75 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none ${
                    activeDriveCommand === "left" ? "ring-2 ring-emerald-400/80 bg-emerald-500/20 border-emerald-400/60" : ""
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-white/70 group-hover:text-white group-active:text-blue-200" />
                </button>
                <button
                  type="button"
                  disabled={manualDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.setPointerCapture?.(e.pointerId)
                    onDriveStart("backward")
                  }}
                  onPointerUp={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onPointerLeave={(e) => {
                    onDriveStop()
                    e.currentTarget.blur()
                  }}
                  onPointerCancel={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  className={`group h-7 w-7 touch-none rounded bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:from-white/25 hover:to-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-75 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none ${
                    activeDriveCommand === "backward" ? "ring-2 ring-emerald-400/80 bg-emerald-500/20 border-emerald-400/60" : ""
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5 text-white/70 group-hover:text-white group-active:text-blue-200" />
                </button>
                <button
                  type="button"
                  disabled={manualDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.setPointerCapture?.(e.pointerId)
                    onDriveStart("right")
                  }}
                  onPointerUp={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.blur()
                    onDriveStop()
                  }}
                  onPointerLeave={(e) => {
                    onDriveStop()
                    e.currentTarget.blur()
                  }}
                  onPointerCancel={(e) => {
                    onDriveStop()
                    e.currentTarget.releasePointerCapture?.(e.pointerId)
                    e.currentTarget.blur()
                  }}
                  className={`group h-7 w-7 touch-none rounded bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:from-white/25 hover:to-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-75 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none ${
                    activeDriveCommand === "right" ? "ring-2 ring-emerald-400/80 bg-emerald-500/20 border-emerald-400/60" : ""
                  }`}
                >
                  <ArrowRight className="h-3.5 w-3.5 text-white/70 group-hover:text-white group-active:text-blue-200" />
                </button>
              </div>
            </div>
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
  manualDisabled: boolean
  activeDriveCommand: "forward" | "backward" | "left" | "right" | "stop" | null
  onStartMission: () => void
  onStopMission: () => void
  missionDisabled: boolean
  missionStopDisabled: boolean
  missionInput: string
  onMissionInputChange: (value: string) => void
  missionPointCount: number
  missionError: string | null
  missionPoints: { x: number; y: number }[]
  invalidLines: string[]
  onAddMissionPoints: () => void
  onRemoveMissionPoint: (index: number) => void
  onAddFromDetections: () => void
  onMoveMissionPoint: (from: number, to: number) => void
  maxMissionPoints: number
  modeError: string | null
}

function ControlPanel({
  isLoading,
  networkOnline,
  driveMode,
  onChangeMode,
  onDriveStart,
  onDriveStop,
  manualDisabled,
  activeDriveCommand,
  onStartMission,
  onStopMission,
  missionDisabled,
  missionStopDisabled,
  missionInput,
  onMissionInputChange,
  missionPointCount,
  missionError,
  missionPoints,
  invalidLines,
  onAddMissionPoints,
  onRemoveMissionPoint,
  onAddFromDetections,
  onMoveMissionPoint,
  maxMissionPoints,
  modeError,
}: ControlPanelProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const reachedLimit = missionPointCount >= maxMissionPoints

  return (
    <Card className="bg-card border-border">
      <CardContent className="space-y-4 sm:space-y-5">
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

      {driveMode === "MANUAL" && (
        <div className="space-y-2 sm:hidden">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">수동 조작</p>
          <div className="grid grid-cols-3 gap-2 place-items-center">
            <div />
            <Button
              variant="outline"
              size="icon"
              disabled={manualDisabled}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onDriveStart("forward")
              }}
              onPointerUp={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onMouseUp={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onTouchEnd={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onTouchCancel={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onPointerLeave={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onPointerCancel={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onClick={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              className="h-10 w-10 touch-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <div />
            <Button
              variant="outline"
              size="icon"
              disabled={manualDisabled}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onDriveStart("left")
              }}
              onPointerUp={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onMouseUp={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onTouchEnd={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onTouchCancel={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onPointerLeave={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onPointerCancel={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onClick={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              className="h-10 w-10 touch-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={manualDisabled}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onDriveStart("backward")
              }}
              onPointerUp={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onMouseUp={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onTouchEnd={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onTouchCancel={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onPointerLeave={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onPointerCancel={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onClick={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              className="h-10 w-10 touch-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={manualDisabled}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onDriveStart("right")
              }}
              onPointerUp={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onMouseUp={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onTouchEnd={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onTouchCancel={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              onPointerLeave={(e) => {
                onDriveStop()
                e.currentTarget.blur()
              }}
              onPointerCancel={(e) => {
                onDriveStop()
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                e.currentTarget.blur()
              }}
              onClick={(e) => {
                e.currentTarget.blur()
                onDriveStop()
              }}
              className="h-10 w-10 touch-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
            {manualDisabled && (
              <p className="text-[11px] text-muted-foreground">네트워크 연결 시 수동 조작이 활성화됩니다.</p>
            )}
          </div>
        )}

        <div className="h-px bg-border" />

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">자율주행 제어</p>
          <div className="space-y-2">
            <textarea
              value={missionInput}
              onChange={(e) => onMissionInputChange(e.target.value)}
              rows={3}
              className="w-full min-h-[88px] sm:min-h-[120px] rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={`좌표를 줄마다 입력\n예시:\n12.3, 45.6\n14 48`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onAddMissionPoints} disabled={reachedLimit}>
                좌표 추가
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onAddFromDetections} disabled={reachedLimit}>
                최근 탐지 좌표 추가
              </Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                좌표 {missionPointCount}개 / {maxMissionPoints}개
              </span>
              <span>x,y 순서로 입력</span>
            </div>
            {invalidLines.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-red-400">잘못된 줄</p>
                <div className="space-y-1">
                  {invalidLines.map((line, idx) => (
                    <div key={`${line}-${idx}`} className="rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {missionError && <p className="text-[11px] text-red-400">{missionError}</p>}
          </div>
          {missionPoints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {missionPoints.map((point, index) => (
                <div
                  key={`${point.x}-${point.y}-${index}`}
                  className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] text-foreground"
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex == null) return
                    onMoveMissionPoint(dragIndex, index)
                    setDragIndex(null)
                  }}
                >
                  <span>
                    ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onRemoveMissionPoint(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={onStartMission}
              disabled={missionDisabled}
            >
              탐지 시작
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onStopMission}
              disabled={missionStopDisabled}
            >
              탐지 중지
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">AUTO 모드에서 좌표가 있어야 시작됩니다.</p>
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

interface DetectionStatsPanelProps {
  stats: DetectionStats | null
  isLoading: boolean
}

function DetectionStatsPanel({ stats, isLoading }: DetectionStatsPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">탐지 통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading || !stats ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">오늘 탐지</span>
              <span className="font-medium text-foreground">{stats.todayCount}건</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">이번 주 탐지</span>
              <span className="font-medium text-foreground">{stats.weekCount}건</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">마지막 탐지</span>
              <span className="text-xs text-muted-foreground font-mono">{stats.lastDetectionTime}</span>
            </div>
          </>
        )}
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

  function SnapshotPreview({ snapshotUrl }: { snapshotUrl: string }) {
    const [open, setOpen] = useState(false)
    const [previewSrc, setPreviewSrc] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (!open || previewSrc) return
      const controller = new AbortController()
      const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
      let objectUrl: string | null = null

      setLoading(true)
      fetch(snapshotUrl, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("snapshot fetch failed")
          const blob = await res.blob()
          objectUrl = URL.createObjectURL(blob)
          setPreviewSrc(objectUrl)
        })
        .catch(() => {
          setPreviewSrc(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })

      return () => {
        controller.abort()
        setLoading(false)
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }
    }, [open, previewSrc, snapshotUrl])

    const handleOpenFull = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (previewSrc) {
        window.open(previewSrc, "_blank", "noopener,noreferrer")
        return
      }

      const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
      try {
        setLoading(true)
        const res = await fetch(snapshotUrl, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        })
        if (!res.ok) throw new Error("snapshot fetch failed")
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, "_blank", "noopener,noreferrer")
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      } finally {
        setLoading(false)
      }
    }

    return (
      <HoverCard open={open} onOpenChange={setOpen} openDelay={200}>
        <HoverCardTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((prev) => !prev)
            }}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-48 p-2">
          <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-secondary/40">
            {previewSrc ? (
              <img src={previewSrc} alt="snapshot preview" className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                {loading ? "불러오는 중..." : "미리보기 없음"}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={handleOpenFull} disabled={loading}>
              사진 보기
            </Button>
          </div>
        </HoverCardContent>
      </HoverCard>
    )
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
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono">{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {snapshotUrl && (
                      <SnapshotPreview snapshotUrl={snapshotUrl} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(event.id)
                      }}
                    >
                      {typeLabels[event.type] || event.type}
                    </Button>
                  </div>
                </div>
              )
            })}
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
  const wsBaseUrl = useMemo(() => (baseUrl ? baseUrl.replace(/^http/, "ws") : ""), [baseUrl])
  const detectionWsUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_DETECTION_WS_URL ?? (wsBaseUrl ? `${wsBaseUrl}/ws/detections` : "")
  }, [wsBaseUrl])
  const signalingUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_SIGNALING_URL ?? (wsBaseUrl ? `${wsBaseUrl}/ws/webrtc` : "")
  }, [wsBaseUrl])
  const [cars, setCars] = useState<{ carId: number; nickname: string }[]>([])
  const [carsLoading, setCarsLoading] = useState(true)
  const [carsError, setCarsError] = useState<string | null>(null)
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null)
  const [carDetail, setCarDetail] = useState<CarDetail | null>(null)
  const [carDetailLoading, setCarDetailLoading] = useState(false)
  const [currentMap, setCurrentMap] = useState<{ width: number; height: number; resolution: number; originX: number; originY: number } | null>(null)
  const fallbackRoomId = process.env.NEXT_PUBLIC_ROBOT_ROOM_ID ?? "robot_default"
  const roomId = carDetail?.deviceId || (selectedCarId ? `car-${selectedCarId}` : fallbackRoomId)

  const carStatus = useCarStatus(selectedCarId ?? 0, { enabled: !!selectedCarId, intervalMs: 1000 })
  const recentDetections = useRecentDetections(selectedCarId, 10)

  // Local UI state only (no data)
  const [showOverlay, setShowOverlay] = useState(true)
  const [cameraConnected, setCameraConnected] = useState(false)
  const [driveMode, setDriveMode] = useState<"AUTO" | "MANUAL" | "STOP">("STOP")
  const [activeDriveCommand, setActiveDriveCommand] = useState<"forward" | "backward" | "left" | "right" | "stop" | null>(null)
  const [modeError, setModeError] = useState<string | null>(null)
  const [missionInput, setMissionInput] = useState("")
  const [missionError, setMissionError] = useState<string | null>(null)
  const [missionPoints, setMissionPoints] = useState<{ x: number; y: number }[]>([])
  const [invalidMissionLines, setInvalidMissionLines] = useState<string[]>([])
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
        setCarsError(e?.message ?? "차량 목록을 불러오는 데 실패했습니다.")
      })
      .finally(() => {
        if (!mounted) return
        setCarsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  React.useEffect(() => {
    if (!selectedCarId) {
      setCarDetail(null)
      return
    }

    let mounted = true
    setCarDetailLoading(true)
    carApi
      .getCarDetail(selectedCarId)
      .then((detail) => {
        if (!mounted) return
        setCarDetail(detail)
      })
      .catch((e: any) => {
        if (!mounted) return
        setCarDetail(null)
        toast({ title: "차량 정보 불러오기 실패", description: e?.message ?? "차량 정보를 불러오지 못했습니다." })
      })
      .finally(() => {
        if (!mounted) return
        setCarDetailLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [selectedCarId, toast])

  React.useEffect(() => {
    if (!selectedCarId) {
      setCurrentMap(null)
      return
    }
    let mounted = true
    mapApi
      .getCurrentMap(selectedCarId)
      .then((map) => {
        if (!mounted) return
        if (!map) {
          setCurrentMap(null)
          return
        }
        setCurrentMap({
          width: map.width,
          height: map.height,
          resolution: map.resolution,
          originX: map.originX,
          originY: map.originY,
        })
      })
      .catch(() => {
        if (!mounted) return
        setCurrentMap(null)
      })
    return () => {
      mounted = false
    }
  }, [selectedCarId])

  React.useEffect(() => {
    if (!selectedCarId) return
    const key = `missionPoints:${selectedCarId}`
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      setMissionPoints([])
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const points = parsed
          .map((item: any) => {
            if (!item) return null
            const x = Number(item.x ?? item[0])
            const y = Number(item.y ?? item[1])
            return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
          })
          .filter(Boolean) as { x: number; y: number }[]
        setMissionPoints(points)
      }
    } catch {
      setMissionPoints([])
    }
  }, [selectedCarId])

  React.useEffect(() => {
    if (!selectedCarId) return
    const key = `missionPoints:${selectedCarId}`
    if (!missionPoints.length) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(missionPoints))
  }, [missionPoints, selectedCarId])

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

  const MAX_MISSION_POINTS = 20

  const missionBounds = useMemo(() => {
    if (currentMap && currentMap.width > 0 && currentMap.height > 0 && currentMap.resolution > 0) {
      const widthMeters = currentMap.width * currentMap.resolution
      const heightMeters = currentMap.height * currentMap.resolution
      return {
        minX: currentMap.originX,
        minY: currentMap.originY,
        maxX: currentMap.originX + widthMeters,
        maxY: currentMap.originY + heightMeters,
      }
    }

    const parse = (value?: string) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    }
    return {
      minX: parse(process.env.NEXT_PUBLIC_MISSION_MIN_X) ?? 0,
      minY: parse(process.env.NEXT_PUBLIC_MISSION_MIN_Y) ?? 0,
      maxX: parse(process.env.NEXT_PUBLIC_MISSION_MAX_X),
      maxY: parse(process.env.NEXT_PUBLIC_MISSION_MAX_Y),
    }
  }, [currentMap])

  const isPointInBounds = useCallback(
    (point: { x: number; y: number }) => {
      if (missionBounds.minX != null && point.x < missionBounds.minX) return false
      if (missionBounds.minY != null && point.y < missionBounds.minY) return false
      if (missionBounds.maxX != null && point.x > missionBounds.maxX) return false
      if (missionBounds.maxY != null && point.y > missionBounds.maxY) return false
      return true
    },
    [missionBounds]
  )

  const parsedMissionInput = useMemo(() => {
    const raw = missionInput.trim()
    if (!raw) {
      return { points: [] as { x: number; y: number }[], invalidLines: [] as string[] }
    }

    if (raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw)
        const list = Array.isArray(parsed) ? parsed : []
        const points = list
          .map((item: any) => {
            if (Array.isArray(item) && item.length >= 2) {
              const x = Number(item[0])
              const y = Number(item[1])
              return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
            }
            if (item && typeof item === "object") {
              const x = Number(item.x)
              const y = Number(item.y)
              return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
            }
            return null
          })
          .filter(Boolean) as { x: number; y: number }[]

        return { points, invalidLines: points.length ? [] : ["JSON 형식 좌표가 비어있습니다."] }
      } catch {
        return { points: [] as { x: number; y: number }[], invalidLines: ["JSON 형식이 올바르지 않습니다."] }
      }
    }

    const lines = raw
      .split(/[\n;]+/)
      .map((line) => line.trim())
      .filter(Boolean)

    const invalidLines: string[] = []
    const points = lines
      .map((line) => {
        const parts = line.split(/[,\s]+/).filter(Boolean)
        if (parts.length < 2) {
          invalidLines.push(line)
          return null
        }
        const x = Number(parts[0])
        const y = Number(parts[1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          invalidLines.push(line)
          return null
        }
        return { x, y }
      })
      .filter(Boolean) as { x: number; y: number }[]

    const outOfRange = points.filter((p) => !isPointInBounds(p)).map((p) => `범위 밖: ${p.x}, ${p.y}`)
    return { points, invalidLines: [...invalidLines, ...outOfRange] }
  }, [isPointInBounds, missionInput])

  const appendMissionPoints = useCallback((points: { x: number; y: number }[]) => {
    if (points.length === 0) return
    setMissionPoints((prev) => {
      const next = [...prev]
      points.forEach((point) => {
        const exists = next.some((p) => p.x === point.x && p.y === point.y)
        if (!exists) next.push(point)
      })
      if (next.length > MAX_MISSION_POINTS) {
        setMissionError(`좌표는 최대 ${MAX_MISSION_POINTS}개까지 추가할 수 있습니다.`)
        return next.slice(0, MAX_MISSION_POINTS)
      }
      return next
    })
  }, [MAX_MISSION_POINTS])

  const handleAddMissionPoints = useCallback(() => {
    if (parsedMissionInput.invalidLines.length > 0) {
      setInvalidMissionLines(parsedMissionInput.invalidLines)
      setMissionError("좌표를 확인해 주세요.")
      return
    }
    setInvalidMissionLines([])
    setMissionError(null)
    appendMissionPoints(parsedMissionInput.points)
    setMissionInput("")
  }, [appendMissionPoints, parsedMissionInput])

  const handleAddFromDetections = useCallback(() => {
    const points = recentDetections.recentDetections
      .filter((d) => d.x != null && d.y != null)
      .map((d) => ({ x: d.x as number, y: d.y as number }))
    if (!points.length) {
      toast({ title: "탐지 좌표 없음", description: "최근 탐지 좌표가 없습니다." })
      return
    }
    setMissionError(null)
    setInvalidMissionLines([])
    const validPoints = points.filter(isPointInBounds)
    appendMissionPoints(validPoints)
    if (validPoints.length !== points.length) {
      toast({ title: "범위 밖 좌표 제외", description: "유효 범위 밖 좌표는 제외되었습니다." })
    } else {
      toast({ title: "좌표 추가 완료", description: "최근 탐지 좌표가 추가되었습니다." })
    }
  }, [appendMissionPoints, isPointInBounds, recentDetections.recentDetections, toast])

  const handleRemoveMissionPoint = useCallback((index: number) => {
    setMissionPoints((prev) => prev.filter((_, i) => i !== index))
    setMissionError(null)
  }, [])

  const handleMoveMissionPoint = useCallback((from: number, to: number) => {
    setMissionPoints((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

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
      setModeError("모드 변경에 실패했습니다. 다시 시도해 주세요.")
      toast({ title: "모드 변경 실패", description: "잠시 후 다시 시도해 주세요." })
    }
  }

  const handleStartMission = async () => {
    if (!selectedCarId) return
    if (driveMode !== "AUTO") {
      toast({ title: "AUTO 모드 필요", description: "AUTO 모드에서만 미션을 시작할 수 있습니다." })
      return
    }
    if (!networkOnline) {
      toast({ title: "미션 시작 실패", description: "오프라인 상태입니다." })
      return
    }
    if (missionPoints.length === 0) {
      toast({ title: "미션 좌표 없음", description: "미션 좌표를 입력한 뒤 다시 시도해 주세요." })
      return
    }
    try {
      await carApi.startMission(selectedCarId, { points: missionPoints })
      toast({ title: "미션 시작 완료", description: "미션이 차량으로 전송되었습니다." })
    } catch {
      toast({ title: "미션 시작 실패", description: "미션 전송에 실패했습니다." })
    }
  }

  const handleStopMission = async () => {
    if (!selectedCarId) return
    if (!networkOnline) {
      toast({ title: "탐지 중지 실패", description: "오프라인 상태입니다." })
      return
    }
    try {
      await carApi.setCarMode(selectedCarId, "STOP")
      toast({ title: "탐지 중지 완료", description: "차량이 정지 모드로 전환되었습니다." })
    } catch {
      toast({ title: "탐지 중지 실패", description: "요청에 실패했습니다." })
    }
  }

  const sendDriveCommand = useCallback(async (command: "forward" | "backward" | "left" | "right" | "stop") => {
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
        toast({ title: "수동 조작 실패", description: "차량 제어 요청에 실패했습니다." })
        lastDriveToastRef.current = now
      }
    }
  }, [selectedCarId, networkOnline, driveMode, toast])

  const handleDriveStart = (command: "forward" | "backward" | "left" | "right" | "stop") => {
    if (driveMode !== "MANUAL") return
    driveCommandRef.current = command
    setActiveDriveCommand(command)
    if (driveTimerRef.current != null) {
      window.clearInterval(driveTimerRef.current)
      driveTimerRef.current = null
    }
    sendDriveCommand(command).catch(() => { })
    driveTimerRef.current = window.setInterval(() => {
      if (!driveCommandRef.current) return
      sendDriveCommand(driveCommandRef.current).catch(() => { })
    }, 200)
  }

  const handleDriveStop = () => {
    driveCommandRef.current = null
    setActiveDriveCommand(null)
    if (driveTimerRef.current != null) {
      window.clearInterval(driveTimerRef.current)
      driveTimerRef.current = null
    }
    sendDriveCommand("stop").catch(() => { })
  }

  React.useEffect(() => {
    return () => {
      if (driveTimerRef.current != null) {
        window.clearInterval(driveTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    const handleGlobalStop = () => {
      if (driveCommandRef.current) {
        handleDriveStop()
      }
    }
    window.addEventListener("pointerup", handleGlobalStop)
    window.addEventListener("pointercancel", handleGlobalStop)
    window.addEventListener("blur", handleGlobalStop)
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") handleGlobalStop()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("pointerup", handleGlobalStop)
      window.removeEventListener("pointercancel", handleGlobalStop)
      window.removeEventListener("blur", handleGlobalStop)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [handleDriveStop])

  // Keyboard arrow key support for manual control
  React.useEffect(() => {
    if (driveMode !== "MANUAL" || !networkOnline || !selectedCarId) return

    const keyToCommand: Record<string, "forward" | "backward" | "left" | "right"> = {
      ArrowUp: "forward",
      ArrowDown: "backward",
      ArrowLeft: "left",
      ArrowRight: "right",
    }

    const pressedKeys = new Set<string>()

    const startCommand = (command: "forward" | "backward" | "left" | "right") => {
      // Clear any existing timer (from mouse or previous keyboard)
      if (driveTimerRef.current != null) {
        window.clearInterval(driveTimerRef.current)
        driveTimerRef.current = null
      }

      driveCommandRef.current = command
      setActiveDriveCommand(command)
      sendDriveCommand(command).catch(() => { })

      driveTimerRef.current = window.setInterval(() => {
        if (!driveCommandRef.current) return
        sendDriveCommand(driveCommandRef.current).catch(() => { })
      }, 200)
    }

    const stopCommand = () => {
      driveCommandRef.current = null
      setActiveDriveCommand(null)
      if (driveTimerRef.current != null) {
        window.clearInterval(driveTimerRef.current)
        driveTimerRef.current = null
      }
      sendDriveCommand("stop").catch(() => { })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const command = keyToCommand[e.code]
      console.log("[Keyboard] keydown:", e.code, "command:", command, "driveMode:", driveMode)
      if (!command) return

      e.preventDefault()

      // Avoid repeated keydown events from holding the key
      if (pressedKeys.has(e.code)) return
      pressedKeys.add(e.code)

      console.log("[Keyboard] startCommand:", command)
      startCommand(command)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const command = keyToCommand[e.code]
      if (!command) return

      pressedKeys.delete(e.code)

      // Only stop if no direction keys are still pressed
      const stillPressed = Array.from(pressedKeys).some(key => keyToCommand[key])
      if (!stillPressed) {
        stopCommand()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [driveMode, networkOnline, selectedCarId, sendDriveCommand])

  const carSelectCard = (
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
  )

  const carDetailCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">차량 정보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {carDetailLoading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : carDetail ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">닉네임</span>
              <span className="font-medium text-foreground">{carDetail.nickname}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">디바이스 ID</span>
              <span className="text-xs text-foreground font-mono">{carDetail.deviceId || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">클레임 코드</span>
              <span className="text-xs text-foreground font-mono">{carDetail.claimCode || "-"}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">차량을 선택해 주세요.</p>
        )}
      </CardContent>
    </Card>
  )

  const statusCard = <RobotStatusPanel status={carStatus.data} isLoading={carStatus.isLoading} />
  const statsCard = <DetectionStatsPanel stats={recentDetections.stats} isLoading={recentDetections.isLoading} />
  const eventLogCard = (
    <EventLog
      detections={recentDetections.recentDetections}
      isLoading={recentDetections.isLoading}
      onSelect={(id) => {
        window.location.href = `/dashboard?detectionId=${id}`
      }}
      baseUrl={baseUrl}
    />
  )

  return (
    <div className="p-3 sm:p-4 lg:p-6">
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
              <div className="relative w-full aspect-video max-h-[45vh] sm:max-h-[55vh] lg:max-h-[70vh]">
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
                  activeDriveCommand={activeDriveCommand}
                  wsUrl={signalingUrl || "ws://I14B201.p.ssafy.io/ws/webrtc"}
                  detectionWsUrl={detectionWsUrl}
                  roomId={roomId}
                  cameraConnected={cameraConnected}
                  onToggleCameraConnection={() => {
                    setCameraConnected((prev) => {
                      const next = !prev
                      toast({
                        title: next ? "카메라 연결 시도" : "카메라 연결 해제",
                        description: next ? "WebRTC 연결을 시작합니다..." : "카메라 연결을 해제했습니다.",
                      })
                      return next
                    })
                  }}
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
                onStartMission={handleStartMission}
                onStopMission={handleStopMission}
                manualDisabled={!networkOnline || carStatus.isLoading}
                activeDriveCommand={activeDriveCommand}
                missionDisabled={!selectedCarId || !networkOnline || driveMode !== "AUTO" || missionPoints.length === 0}
                missionStopDisabled={!selectedCarId || !networkOnline || driveMode !== "AUTO"}
                missionInput={missionInput}
                onMissionInputChange={setMissionInput}
                missionPointCount={missionPoints.length}
                missionError={missionError}
                missionPoints={missionPoints}
                invalidLines={invalidMissionLines}
                onAddMissionPoints={handleAddMissionPoints}
                onRemoveMissionPoint={handleRemoveMissionPoint}
                onAddFromDetections={handleAddFromDetections}
                onMoveMissionPoint={handleMoveMissionPoint}
                maxMissionPoints={MAX_MISSION_POINTS}
                modeError={modeError}
              />
            </div>
          </div>

          <div className="w-full lg:w-80 xl:w-96 space-y-3">
            <div className="lg:hidden space-y-3">
              <Accordion type="multiple" defaultValue={["status"]} className="space-y-2">
                <AccordionItem value="car">
                  <AccordionTrigger>차량 선택</AccordionTrigger>
                  <AccordionContent>{carSelectCard}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="detail">
                  <AccordionTrigger>차량 정보</AccordionTrigger>
                  <AccordionContent>{carDetailCard}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="status">
                  <AccordionTrigger>차량 상태</AccordionTrigger>
                  <AccordionContent>{statusCard}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="stats">
                  <AccordionTrigger>탐지 통계</AccordionTrigger>
                  <AccordionContent>{statsCard}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="log">
                  <AccordionTrigger>탐지 로그</AccordionTrigger>
                  <AccordionContent>{eventLogCard}</AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="hidden lg:block space-y-3">
              {carSelectCard}
              {carDetailCard}
              {statusCard}
              {statsCard}
              {eventLogCard}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


