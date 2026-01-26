"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_MODE } from "@/core/demo/config";
import { robotDemoEngine } from "@/core/demo/robotDemoEngine";

export function useHomeDemoSummary() {
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
        isDemo: false,
        status: null,
        lastEvent: null,
        detectionsLast10m: 0,
      };
    }

    const snap = robotDemoEngine.getSnapshot();
    const status = snap.robotStatus;

    const lastEvent = snap.cameraEvents[0] ?? null;

    const now = Date.now();
    const from = now - 10 * 60 * 1000;
    const detectionsLast10m = snap.detectionHistory.filter((d) => d.ts >= from).length;

    return {
      isDemo: true,
      status,
      lastEvent,
      detectionsLast10m,
    };
  }, [tick]);
}
