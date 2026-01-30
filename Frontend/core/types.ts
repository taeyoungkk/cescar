// ============================================
// Auth Types
// ============================================
export interface User {
  id: string
  email: string
  name: string
  nickname?: string
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

export type CarMode = "STOP" | "MANUAL" | "AUTO"


export interface CarStatus {
  x: number | null;
  y: number | null;
  heading: number;
  mode: CarMode;
  isOnline: boolean;
  updatedAt: string;
}

export interface CarSummary {
  carId: number;
  nickname: string;
  mode: CarMode;
  isOnline: boolean;
}

export interface CarDetail {
  carId: number;
  deviceId: string;
  claimCode: string;
  ownerId: number | null;
  nickname: string;
  createdAt: string;
  status: CarStatus;
}


// ============================================
// Detection Types
// ============================================
export type DetectionType = "cockroach" | "ant" | "fly" | "mosquito" | "spider" | "person" | "unknown"
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
  x?: number | null
  y?: number | null
  snapshotUrl?: string
  videoUrl?: string | null
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

// ============================================
// Map Types
// ============================================
export interface CarMap {
  id: number
  carId: number
  name: string
  imageUrl?: string | null
  width: number
  height: number
  resolution: number
  originX: number
  originY: number
  createdAt: string
}
