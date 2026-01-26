import type { RobotStatus, CameraEvent, ConnectionQuality } from "@/core/types";

type Listener = () => void;

const insectTypes: CameraEvent["type"][] = ["cockroach", "ant", "fly", "mosquito", "spider", "unknown"];
const qualities: ConnectionQuality[] = ["excellent", "good", "poor"];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const now = () => new Date();
const nowTime = () =>
  new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export type RobotStatusPoint = {
  ts: number;                // epoch ms
  batteryLevel: number;
  isOnline: boolean;
  connectionQuality: ConnectionQuality;
  isMoving: boolean;
};

export type DetectionPoint = {
  ts: number;                // epoch ms
  type: CameraEvent["type"];
};

export class RobotDemoEngine {
  private listeners = new Set<Listener>();

  private status: RobotStatus = {
    isOnline: true,
    batteryLevel: 86,
    isMoving: false,
    connectionQuality: "good",
  };

  private events: CameraEvent[] = [];
  private detecting = false;

  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private detectTimer: ReturnType<typeof setInterval> | null = null;

  // === dashboard용 히스토리 (최근만 유지) ===
  private statusHistory: RobotStatusPoint[] = [];
  private detectionHistory: DetectionPoint[] = [];

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  getSnapshot() {
    return {
      robotStatus: this.status,
      cameraEvents: this.events,
      isDetecting: this.detecting,
      statusHistory: this.statusHistory,
      detectionHistory: this.detectionHistory,
    };
  }

  start() {
    if (this.statusTimer) return;

    // 초기 히스토리 1개라도 넣어둠
    this.pushStatusPoint();

    this.statusTimer = setInterval(() => {
      // 가끔 온라인/오프라인 토글
      if (Math.random() < 0.02) this.status.isOnline = !this.status.isOnline;

      // 배터리 소모
      const drain = this.detecting ? rand(0.25, 0.5) : rand(0.05, 0.15);
      this.status.batteryLevel = Math.max(0, Math.round((this.status.batteryLevel - drain) * 10) / 10);

      // 배터리 낮으면 품질 저하 확률 증가
      const lowBattery = this.status.batteryLevel <= 20;
      this.status.connectionQuality = lowBattery ? pick(["good", "poor"]) : pick(qualities);

      // 이동 상태 랜덤
      if (Math.random() < 0.15) this.status.isMoving = !this.status.isMoving;

      this.pushStatusPoint();
      this.emit();
    }, 2000);
  }

  stop() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    if (this.detectTimer) clearInterval(this.detectTimer);
    this.statusTimer = null;
    this.detectTimer = null;
  }

  startDetection() {
    this.detecting = true;

    if (this.detectTimer) clearInterval(this.detectTimer);
    this.detectTimer = setInterval(() => {
      // 오프라인이면 탐지 이벤트 생성 안 함
      if (!this.status.isOnline) return;

      const type = pick(insectTypes);
      const event: CameraEvent = {
        id: crypto.randomUUID(),
        type,
        time: nowTime(),
      };

      this.events = [event, ...this.events].slice(0, 20);

      this.detectionHistory.unshift({ ts: now().getTime(), type });
      this.detectionHistory = this.detectionHistory.slice(0, 200); // 최근 200건만 유지

      this.emit();
    }, 3500);

    this.emit();
  }

  stopDetection() {
    this.detecting = false;
    if (this.detectTimer) clearInterval(this.detectTimer);
    this.detectTimer = null;
    this.emit();
  }

  captureSnapshot() {
    // 데모: 캡처도 이벤트로 남김
    const event: CameraEvent = {
      id: crypto.randomUUID(),
      type: "unknown",
      time: nowTime(),
    };
    this.events = [event, ...this.events].slice(0, 20);
    this.emit();
  }

  private pushStatusPoint() {
    const p: RobotStatusPoint = {
      ts: now().getTime(),
      batteryLevel: this.status.batteryLevel,
      isOnline: this.status.isOnline,
      connectionQuality: this.status.connectionQuality,
      isMoving: this.status.isMoving,
    };
    this.statusHistory.push(p);
    // 최근 10분치 정도(2초 간격이면 300개 = 10분)
    if (this.statusHistory.length > 300) this.statusHistory = this.statusHistory.slice(-300);
  }
}

export const robotDemoEngine = new RobotDemoEngine();
