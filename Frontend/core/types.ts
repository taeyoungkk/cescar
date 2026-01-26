// ============================================
// Auth Types
// ============================================
export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "operator" | "viewer"
  createdAt: string
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: User
  error?: string
}

export interface SignupRequest {
  name: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

// ============================================
// Robot Types
// ============================================
export type RobotMode = "detecting" | "idle" | "moving"
export type ConnectionQuality = "excellent" | "good" | "poor"

export interface RobotStatus {
  id: string
  name: string
  isOnline: boolean
  batteryLevel: number
  mode: RobotMode
  connectionQuality: ConnectionQuality
  lastSeen: string
  speed: number
  isMoving: boolean
}

// ============================================
// Detection Types
// ============================================
export type DetectionType = "cockroach" | "ant" | "fly" | "mosquito" | "spider" | "unknown"
export type DetectionStatus = "detected" | "confirmed" | "false_alarm" | "resolved" | "pending" | "dismissed"

export interface Detection {
  id: string
  robotId: string
  type: DetectionType
  confidence: number
  status: DetectionStatus
  timestamp: string
  date: string
  time: string
  snapshotUrl?: string
  notes: string
}

export interface DetectionHistoryFilters {
  dateFrom?: string
  dateTo?: string
  type?: DetectionType | "all"
  status?: DetectionStatus | "all"
  searchId?: string
}

export interface DetectionStats {
  todayCount: number
  weekCount: number
  falseAlarmRate: number
  lastDetectionTime: string
}

// ============================================
// Alert Types
// ============================================
export type AlertType = "warning" | "error" | "info"

export interface SystemAlert {
  id: string
  type: AlertType
  title: string
  message: string
  timestamp: string
  isRead: boolean
}

// ============================================
// Camera Types
// ============================================
export interface CameraEvent {
  id: string
  time: string
  type: DetectionType
  confidence: number
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
