import type {
  User,
  RobotStatus,
  Detection,
  SystemAlert,
  DetectionStats,
  CameraEvent,
} from "./types"

// ============================================
// Mock User
// ============================================
export const mockUser: User = {
  id: "user-001",
  email: "admin@cescar.io",
  name: "관리자",
  role: "admin",
  createdAt: "2024-01-01T00:00:00Z",
}

// ============================================
// Mock Robot Status
// ============================================
export const mockRobotStatus: RobotStatus = {
  id: "robot-001",
  name: "Cescar-01",
  isOnline: true,
  batteryLevel: 78,
  mode: "detecting",
  connectionQuality: "excellent",
  lastSeen: new Date().toISOString(),
  speed: 0.5,
  isMoving: false,
}

// ============================================
// Mock Detection Stats
// ============================================
export const mockDetectionStats: DetectionStats = {
  todayCount: 12,
  weekCount: 47,
  falseAlarmRate: 8.5,
  lastDetectionTime: "14:32",
}

// ============================================
// Mock Recent Detections (for Home page)
// ============================================
export const mockRecentDetections: Detection[] = [
  {
    id: "det-001",
    robotId: "robot-001",
    type: "cockroach",
    confidence: 94,
    status: "confirmed",
    timestamp: "2024-01-15T14:32:00Z",
    date: "2024-01-15",
    time: "14:32",
    notes: "주방 근처에서 발견됨",
  },
  {
    id: "det-002",
    robotId: "robot-001",
    type: "ant",
    confidence: 87,
    status: "pending",
    timestamp: "2024-01-15T13:45:00Z",
    date: "2024-01-15",
    time: "13:45",
    notes: "창가 근처",
  },
  {
    id: "det-003",
    robotId: "robot-001",
    type: "fly",
    confidence: 72,
    status: "dismissed",
    timestamp: "2024-01-15T12:20:00Z",
    date: "2024-01-15",
    time: "12:20",
    notes: "오탐으로 확인됨",
  },
]

// ============================================
// Mock Detection History (for Dashboard)
// ============================================
export const mockDetectionHistory: Detection[] = [
  {
    id: "DET-2024-001",
    robotId: "robot-001",
    type: "cockroach",
    confidence: 94,
    status: "confirmed",
    timestamp: "2024-01-15T14:32:00Z",
    date: "2024-01-15",
    time: "14:32",
    notes: "주방 싱크대 아래에서 발견됨. 즉시 방역 조치 필요.",
  },
  {
    id: "DET-2024-002",
    robotId: "robot-001",
    type: "ant",
    confidence: 87,
    status: "resolved",
    timestamp: "2024-01-15T13:45:00Z",
    date: "2024-01-15",
    time: "13:45",
    notes: "창가 틈새에서 개미 행렬 발견. 방역 완료.",
  },
  {
    id: "DET-2024-003",
    robotId: "robot-001",
    type: "fly",
    confidence: 45,
    status: "false_alarm",
    timestamp: "2024-01-15T12:20:00Z",
    date: "2024-01-15",
    time: "12:20",
    notes: "먼지로 인한 오탐.",
  },
  {
    id: "DET-2024-004",
    robotId: "robot-001",
    type: "cockroach",
    confidence: 91,
    status: "confirmed",
    timestamp: "2024-01-14T22:15:00Z",
    date: "2024-01-14",
    time: "22:15",
    notes: "화장실 배수구 근처에서 발견.",
  },
  {
    id: "DET-2024-005",
    robotId: "robot-001",
    type: "spider",
    confidence: 78,
    status: "resolved",
    timestamp: "2024-01-14T18:30:00Z",
    date: "2024-01-14",
    time: "18:30",
    notes: "천장 모서리에서 발견. 제거 완료.",
  },
  {
    id: "DET-2024-006",
    robotId: "robot-001",
    type: "mosquito",
    confidence: 65,
    status: "confirmed",
    timestamp: "2024-01-14T16:45:00Z",
    date: "2024-01-14",
    time: "16:45",
    notes: "창문 근처에서 다수 발견.",
  },
  {
    id: "DET-2024-007",
    robotId: "robot-001",
    type: "ant",
    confidence: 82,
    status: "resolved",
    timestamp: "2024-01-13T11:20:00Z",
    date: "2024-01-13",
    time: "11:20",
    notes: "식료품 저장고 입구.",
  },
  {
    id: "DET-2024-008",
    robotId: "robot-001",
    type: "cockroach",
    confidence: 38,
    status: "false_alarm",
    timestamp: "2024-01-13T09:10:00Z",
    date: "2024-01-13",
    time: "09:10",
    notes: "그림자로 인한 오탐.",
  },
]

// ============================================
// Mock System Alerts
// ============================================
export const mockAlerts: SystemAlert[] = [
  {
    id: "alert-001",
    type: "warning",
    title: "배터리 부족",
    message: "로봇 배터리가 20% 이하입니다. 충전이 필요합니다.",
    timestamp: "2024-01-15T14:00:00Z",
    isRead: false,
  },
  {
    id: "alert-002",
    type: "info",
    title: "탐지 완료",
    message: "구역 A-3 탐지가 완료되었습니다.",
    timestamp: "2024-01-15T13:30:00Z",
    isRead: true,
  },
  {
    id: "alert-003",
    type: "error",
    title: "센서 오류",
    message: "전방 카메라 센서 점검이 필요합니다.",
    timestamp: "2024-01-15T12:00:00Z",
    isRead: false,
  },
]

// ============================================
// Mock Camera Events
// ============================================
export const mockCameraEvents: CameraEvent[] = [
  { id: "evt-001", time: "14:32:15", type: "cockroach", confidence: 94 },
  { id: "evt-002", time: "14:28:42", type: "ant", confidence: 87 },
  { id: "evt-003", time: "14:15:03", type: "fly", confidence: 72 },
  { id: "evt-004", time: "13:58:21", type: "ant", confidence: 81 },
  { id: "evt-005", time: "13:42:55", type: "cockroach", confidence: 89 },
]
