"use client"

import React from "react"
import { Play, Square } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OfflineGuardButton } from "@/components/offline-guard-button"

type Props = {
  isDetecting: boolean
  isLoading: boolean
  onStart: () => Promise<boolean> | void
  onStop: () => Promise<boolean> | void

  networkOnline: boolean
  robotOnline: boolean
  mapReady: boolean
}

export function DetectionControls({
  isDetecting,
  isLoading,
  onStart,
  onStop,
  networkOnline,
  robotOnline,
  mapReady,
}: Props) {
  // ✅ 시작 가능 조건: 네트워크 + 로봇 + 지도 완료
  const canStart = networkOnline && robotOnline && mapReady
  const canStop = networkOnline && robotOnline // (탐지 중지는 지도 여부와 무관하게 허용하는 게 보통 자연스러움)

  const startBlockMessage = !networkOnline
    ? "네트워크에 연결되어야 탐지를 시작할 수 있습니다"
    : !robotOnline
    ? "로봇이 오프라인 상태입니다. 로봇 연결 후 다시 시도해 주세요"
    : !mapReady
    ? "지도가 생성 완료된 이후에 탐지를 시작할 수 있습니다"
    : "탐지를 시작할 수 없습니다"

  const stopBlockMessage = !networkOnline
    ? "네트워크에 연결되어야 탐지를 중지할 수 있습니다"
    : "로봇이 오프라인 상태입니다. 로봇 연결 후 다시 시도해 주세요."

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          탐지 제어
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <OfflineGuardButton
            className={`flex-1 ${
              isDetecting ? "bg-secondary hover:bg-secondary/80" : "bg-primary hover:bg-primary/90"
            }`}
            onClick={() => onStart()}
            disabled={isDetecting || isLoading || !canStart}
            offlineMessage={startBlockMessage}
          >
            <Play className="mr-2 h-4 w-4" />
            탐지 시작
          </OfflineGuardButton>

          <OfflineGuardButton
            variant="destructive"
            className="flex-1"
            onClick={() => onStop()}
            disabled={!isDetecting || isLoading || !canStop}
            offlineMessage={stopBlockMessage}
          >
            <Square className="mr-2 h-4 w-4" />
            탐지 중지
          </OfflineGuardButton>
        </div>
      </CardContent>
    </Card>
  )
}
