import type {
  ApiResponse,
  Detection,
  DetectionHistoryFilters,
  DetectionStats,
  DetectionStatus,
} from "../types"
import { mockRecentDetections, mockDetectionHistory, mockDetectionStats } from "../mockData"

const MOCK_DELAY = 500

// ============================================
// Detection Stats API
// ============================================
export async function getDetectionStats(): Promise<ApiResponse<DetectionStats>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: mockDetectionStats,
  }
}

// ============================================
// Recent Detections API (for Home)
// ============================================
export async function getRecentDetections(limit: number = 5): Promise<ApiResponse<Detection[]>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: mockRecentDetections.slice(0, limit),
  }
}

// ============================================
// Detection History API (for Dashboard)
// ============================================
export async function getDetectionHistory(
  filters?: DetectionHistoryFilters
): Promise<ApiResponse<Detection[]>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  let filteredData = [...mockDetectionHistory]

  if (filters) {
    if (filters.type && filters.type !== "all") {
      filteredData = filteredData.filter((d) => d.type === filters.type)
    }

    if (filters.status && filters.status !== "all") {
      filteredData = filteredData.filter((d) => d.status === filters.status)
    }

    if (filters.searchId) {
      filteredData = filteredData.filter((d) =>
        d.id.toLowerCase().includes(filters.searchId!.toLowerCase())
      )
    }

    if (filters.dateFrom) {
      filteredData = filteredData.filter((d) => d.date >= filters.dateFrom!)
    }

    if (filters.dateTo) {
      filteredData = filteredData.filter((d) => d.date <= filters.dateTo!)
    }
  }

  return {
    success: true,
    data: filteredData,
  }
}

// ============================================
// Detection Detail API
// ============================================
export async function getDetectionById(id: string): Promise<ApiResponse<Detection | null>> {
  await new Promise((resolve) => setTimeout(resolve, 300))

  const detection = mockDetectionHistory.find((d) => d.id === id)

  return {
    success: true,
    data: detection || null,
  }
}

// ============================================
// Detection Actions API
// ============================================
export async function updateDetectionStatus(
  id: string,
  status: DetectionStatus
): Promise<ApiResponse<Detection>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  const detection = mockDetectionHistory.find((d) => d.id === id)

  if (!detection) {
    return {
      success: false,
      error: "탐지 기록을 찾을 수 없습니다.",
    }
  }

  return {
    success: true,
    data: { ...detection, status },
  }
}

export async function updateDetectionNotes(
  id: string,
  notes: string
): Promise<ApiResponse<Detection>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  const detection = mockDetectionHistory.find((d) => d.id === id)

  if (!detection) {
    return {
      success: false,
      error: "탐지 기록을 찾을 수 없습니다.",
    }
  }

  return {
    success: true,
    data: { ...detection, notes },
  }
}
