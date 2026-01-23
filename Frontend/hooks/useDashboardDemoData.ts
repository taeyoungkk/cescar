"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_MODE } from "@/core/demo/config";
import { robotDemoEngine } from "@/core/demo/robotDemoEngine";
import type { CameraEvent } from "@/core/types";

type SeriesPoint = { ts: number; value: number };
type TypeCount = { type: CameraEvent["type"]; count: number };

export function useDashboardDemoData() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!DEMO_MODE) return;

    robotDemoEngine.start();
    const unsub = robotDemoEngine.subscribe(() => setTick((v) => v + 1));
    return () => unsub();
  }, []);

  return useMemo(() => {
    if (!DEMO_MODE) {
      return {
        batterySeries: [] as SeriesPoint[],
        detectionsPerMinute: [] as SeriesPoint[],
        detectionByType: [] as TypeCount[],
        isDemo: false,
      };
    }

    const snap = robotDemoEngine.getSnapshot();
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10분
    const from = now - windowMs;

    // 1) 배터리 추이
    const batterySeries: SeriesPoint[] = snap.statusHistory
      .filter((p) => p.ts >= from)
      .map((p) => ({ ts: p.ts, value: p.batteryLevel }));

    // 2) 분당 탐지 건수 (최근 10분, 1분 버킷)
    const buckets = new Map<number, number>();
    for (const d of snap.detectionHistory) {
      if (d.ts < from) break;
      const minuteKey = Math.floor(d.ts / 60000) * 60000;
      buckets.set(minuteKey, (buckets.get(minuteKey) ?? 0) + 1);
    }
    const detectionsPerMinute: SeriesPoint[] = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, count]) => ({ ts, value: count }));

    // 3) 타입별 탐지 건수 (최근 200건)
    const typeCountMap = new Map<CameraEvent["type"], number>();
    for (const d of snap.detectionHistory) {
      typeCountMap.set(d.type, (typeCountMap.get(d.type) ?? 0) + 1);
    }
    const detectionByType: TypeCount[] = Array.from(typeCountMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      batterySeries,
      detectionsPerMinute,
      detectionByType,
      isDemo: true,
    };
  }, [tick]);
}
