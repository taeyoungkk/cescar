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
    confidence: raw.confidence, // UI에서 0~1 / 0~100 모두 처리
    status: "pending", // 서버 미지원(현 단계)
    timestamp: raw.createdAt,
    date,
    time,
    snapshotUrl: raw.imageUrl ?? undefined,
    notes: "",
  }
}

function toIsoStart(dateStr: string) {
  return `${dateStr}T00:00:00`
}
function toIsoEnd(dateStr: string) {
  return `${dateStr}T23:59:59`
}

// 서버 통계 엔드포인트 생기기 전 더미
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
    return fail(e?.message ?? "최근 탐지 조회 실패")
  }
}

export async function getDetectionHistory(filters?: DetectionHistoryFilters): Promise<ApiResponse<Detection[]>> {
  try {
    const now = new Date()
    const endDate = filters?.dateTo ?? now.toISOString().slice(0, 10)
    const startDate =
      filters?.dateFrom ??
      (() => {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        return d.toISOString().slice(0, 10)
      })()

    const params = new URLSearchParams()
    params.set("startDate", toIsoStart(startDate))
    params.set("endDate", toIsoEnd(endDate))

    // pageable 지원 확실할 때만 유지 (지원하면 정렬/개수 체감이 좋아짐)
    params.set("page", "0")
    params.set("size", "50")
    params.set("sort", "createdAt,desc")

    const INSECT_LABELS = new Set(["cockroach","ant","fly","mosquito","spider"])

    if (filters?.type && filters.type !== "all") {
      if (INSECT_LABELS.has(filters.type)) {
        params.set("label", filters.type)
      } else {
        // unknown 같은 건 label로 보내지 말고 전체 검색
        params.delete("label")
      }
    }


    const page = await apiFetch<SpringPage<DetectionListItemResponse>>(`/api/detections/search?${params.toString()}`)
    let items = page.content.map((d) => mapToUiDetection(d))

    if (filters?.searchId) {
      const q = filters.searchId.toLowerCase()
      items = items.filter((d) => d.id.toLowerCase().includes(q))
    }

    // status는 서버 미지원이라 필터링하지 않음 (UI에서 disabled 권장)
    return ok(items)
  } catch (e: any) {
    return fail(e?.message ?? "탐지 기록 조회 실패")
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

// 서버 미지원 → 로컬 업데이트용
export async function updateDetectionStatus(id: string, status: DetectionStatus): Promise<ApiResponse<Detection>> {
  return ok({ id, status } as any)
}

export async function updateDetectionNotes(id: string, notes: string): Promise<ApiResponse<Detection>> {
  return ok({ id, notes } as any)
}
