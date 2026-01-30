// core/api/detection.ts
import type {
  ApiResponse,
  Detection,
  DetectionHistoryFilters,
  DetectionStats,
  DetectionStatus,
  DetectionType,
} from "../types"
import { apiFetch } from "./http"

const ok = <T,>(data: T): ApiResponse<T> => ({ success: true, data })
const fail = <T,>(error: string): ApiResponse<T> => ({ success: false, error })

function mapLabelToType(label: any): DetectionType {
  const v = String(label ?? "").toLowerCase()
  if (v === "cockroach") return "cockroach"
  if (v === "ant") return "ant"
  if (v === "fly") return "fly"
  if (v === "mosquito") return "mosquito"
  if (v === "spider") return "spider"
  if (v === "person") return "person"
  return "unknown"
}

function toDateParts(createdAt: string) {
  const s = String(createdAt ?? "")
  const date = s.slice(0, 10)
  const time = s.slice(11, 16)
  return { date, time }
}

type SpringPage<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

type DetectionListItemResponse = {
  id: number
  label: string
  confidence: number
  x: any
  y: any
  imageUrl: string
  createdAt: string
}

type DetectionDetailResponse = DetectionListItemResponse & {
  videoUrl: string | null
}

function mapToUiDetection(raw: DetectionListItemResponse, opts?: { robotId?: string }): Detection {
  const { date, time } = toDateParts(raw.createdAt)
  return {
    id: String(raw.id),
    robotId: opts?.robotId ?? "unknown",
    type: mapLabelToType(raw.label),
    confidence: raw.confidence, // UI?먯꽌 0~1 / 0~100 紐⑤몢 泥섎━
    status: "pending", // ?쒕쾭 誘몄??????④퀎)
    timestamp: raw.createdAt,
    date,
    time,
    x: typeof raw.x === "number" ? raw.x : raw.x != null ? Number(raw.x) : null,
    y: typeof raw.y === "number" ? raw.y : raw.y != null ? Number(raw.y) : null,
    snapshotUrl: raw.imageUrl ?? undefined,
    videoUrl: (raw as any).videoUrl ?? undefined,
    notes: "",
  }
}

function toIsoStart(dateStr: string) {
  return `${dateStr}T00:00:00`
}
function toIsoEnd(dateStr: string) {
  return `${dateStr}T23:59:59`
}

// ?쒕쾭 ?듦퀎 ?붾뱶?ъ씤???앷린湲????붾?
export async function getDetectionStats(): Promise<ApiResponse<DetectionStats>> {
  return ok({ todayCount: 0, weekCount: 0, falseAlarmRate: 0, lastDetectionTime: "" })
}

export async function getRecentDetections(carId: number, limit: number = 5): Promise<ApiResponse<Detection[]>> {
  try {
    const logs = await apiFetch<SpringPage<any>>(`/api/cars/${carId}/logs?page=0&size=1&sort=startAt,desc`)
    const latestLog = logs.content?.[0]
    if (!latestLog?.id) return ok([])

    const detPage = await apiFetch<SpringPage<DetectionListItemResponse>>(
      `/api/logs/${latestLog.id}/detections?page=0&size=${limit}&sort=createdAt,desc`
    )

    const robotId = `car-${carId}`
    return ok(detPage.content.map((d) => mapToUiDetection(d, { robotId })))
  } catch (e: any) {
    return fail(e?.message ?? "理쒓렐 ?먯? 議고쉶 ?ㅽ뙣")
  }
}

export async function getDetectionHistory(
  carId: number | null,
  filters?: DetectionHistoryFilters
): Promise<ApiResponse<Detection[]>> {
  try {
    if (!carId) return ok([])

    const logs = await apiFetch<SpringPage<any>>(`/api/cars/${carId}/logs?page=0&size=1&sort=startAt,desc`)
    const latestLog = logs.content?.[0]
    if (!latestLog?.id) return ok([])

    const page = await apiFetch<SpringPage<DetectionListItemResponse>>(
      `/api/logs/${latestLog.id}/detections?page=0&size=50&sort=createdAt,desc`
    )

    let items = page.content.map((d) => mapToUiDetection(d, { robotId: `car-${carId}` }))

    if (filters?.searchId) {
      const q = filters.searchId.toLowerCase()
      items = items.filter((d) => d.id.toLowerCase().includes(q))
    }

    if (filters?.type && filters.type !== "all") {
      items = items.filter((d) => d.type === filters.type)
    }

    if (filters?.dateFrom) {
      const from = new Date(toIsoStart(filters.dateFrom))
      items = items.filter((d) => new Date(d.timestamp) >= from)
    }
    if (filters?.dateTo) {
      const to = new Date(toIsoEnd(filters.dateTo))
      items = items.filter((d) => new Date(d.timestamp) <= to)
    }

    // status???쒕쾭 誘몄??먯씠???꾪꽣留곹븯吏 ?딆쓬
    return ok(items)
  } catch (e: any) {
    return fail(e?.message ?? "?먯? 湲곕줉 議고쉶 ?ㅽ뙣")
  }
}

export async function getDetectionById(id: string): Promise<ApiResponse<Detection | null>> {
  try {
    const raw = await apiFetch<DetectionDetailResponse>(`/api/detections/${id}`)
    return ok(mapToUiDetection(raw))
  } catch {
    return ok(null)
  }
}

// ?쒕쾭 誘몄?????濡쒖뺄 ?낅뜲?댄듃??
export async function updateDetectionStatus(id: string, status: DetectionStatus): Promise<ApiResponse<Detection>> {
  return ok({ id, status } as any)
}

export async function updateDetectionNotes(id: string, notes: string): Promise<ApiResponse<Detection>> {
  return ok({ id, notes } as any)
}

