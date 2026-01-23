import type { ApiResponse, RobotStatus, SystemAlert, CameraEvent } from "../types"
import { mockRobotStatus, mockAlerts, mockCameraEvents } from "../mockData"

const MOCK_DELAY = 500

// ============================================
// Robot Status API
// ============================================
export async function getRobotStatus(): Promise<ApiResponse<RobotStatus>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: {
      ...mockRobotStatus,
      lastSeen: new Date().toISOString(),
    },
  }
}

export async function startDetection(): Promise<ApiResponse<{ started: boolean }>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: { started: true },
  }
}

export async function stopDetection(): Promise<ApiResponse<{ stopped: boolean }>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: { stopped: true },
  }
}

export async function captureSnapshot(): Promise<ApiResponse<{ snapshotUrl: string }>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: { snapshotUrl: `/snapshots/snap-${Date.now()}.jpg` },
  }
}

// ============================================
// Alerts API
// ============================================
export async function getAlerts(): Promise<ApiResponse<SystemAlert[]>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: mockAlerts,
  }
}

export async function markAlertAsRead(alertId: string): Promise<ApiResponse<{ success: boolean }>> {
  await new Promise((resolve) => setTimeout(resolve, 300))

  return {
    success: true,
    data: { success: true },
  }
}

// ============================================
// Camera Events API
// ============================================
export async function getCameraEvents(): Promise<ApiResponse<CameraEvent[]>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  return {
    success: true,
    data: mockCameraEvents,
  }
}
