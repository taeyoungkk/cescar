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
import { getErrorMessage } from "@/lib/error-messages"

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
  if (v === "car") return "car"
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

type LogStatisticsResponse = Record<string, any>

type CarLogResponse = {
  id: number
  mapId: number | null
  mapName?: string | null
  startAt: string
  endAt: string | null
  status: string
  detectionCount: number
}

function mapToUiDetection(raw: DetectionListItemResponse, opts?: { robotId?: string }): Detection {
  const { date, time } = toDateParts(raw.createdAt)
  return {
    id: String(raw.id),
    robotId: opts?.robotId ?? "unknown",
    type: mapLabelToType(raw.label),
    confidence: raw.confidence, // UI?? 0~1 / 0~100 ?? ??
    status: "pending", // ?? ???(??)
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

function normalizeLogStats(raw: LogStatisticsResponse, fallbackLastTime?: string): DetectionStats {
  if (Array.isArray(raw)) {
    const total = raw.reduce((sum, item) => sum + Number(item?.count ?? 0), 0)
    return {
      todayCount: total,
      weekCount: total,
      falseAlarmRate: 0,
      lastDetectionTime: fallbackLastTime ?? "-",
    }
  }

  const total =
    raw?.totalDetections ??
    raw?.detectionCount ??
    raw?.totalCount ??
    raw?.count ??
    raw?.total ??
    0

  const todayCount = raw?.todayCount ?? total ?? 0
  const weekCount = raw?.weekCount ?? total ?? 0
  const falseAlarmRate = raw?.falseAlarmRate ?? raw?.falseRate ?? 0
  const lastDetectionTime =
    raw?.lastDetectionTime ??
    raw?.latestDetectionTime ??
    raw?.lastDetectedAt ??
    fallbackLastTime ??
    "-"

  return {
    todayCount: Number.isFinite(todayCount) ? Number(todayCount) : 0,
    weekCount: Number.isFinite(weekCount) ? Number(weekCount) : 0,
    falseAlarmRate: Number.isFinite(falseAlarmRate) ? Math.round(Number(falseAlarmRate)) : 0,
    lastDetectionTime: String(lastDetectionTime),
  }
}

function normalizeLog(raw: any): CarLogResponse {
  return {
    id: Number(raw?.id),
    mapId:
      raw?.mapId != null || raw?.map_id != null
        ? Number(raw?.mapId ?? raw?.map_id)
        : null,
    mapName: raw?.mapName ?? raw?.map_name ?? null,
    startAt: String(raw?.startAt ?? raw?.start_at ?? raw?.createdAt ?? ""),
    endAt: raw?.endAt ?? raw?.end_at ?? null,
    status: String(raw?.status ?? "UNKNOWN"),
    detectionCount: Number(raw?.detectionCount ?? raw?.detection_count ?? raw?.count ?? 0),
  }
}

// ?? ?? ????? ???(??)
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
    return fail(getErrorMessage(e, "최근 감지 조회 실패"))
  }
}

export async function getLatestLogStatistics(
  carId: number,
  fallbackLastTime?: string
): Promise<ApiResponse<DetectionStats | null>> {
  try {
    const logs = await apiFetch<SpringPage<any>>(`/api/cars/${carId}/logs?page=0&size=1&sort=startAt,desc`)
    const latestLog = logs.content?.[0]
    if (!latestLog?.id) return ok(null)

    const raw = await apiFetch<LogStatisticsResponse>(`/api/logs/${latestLog.id}/statistics`)
    return ok(normalizeLogStats(raw, fallbackLastTime))
  } catch (e: any) {
    return fail(getErrorMessage(e, "통계 조회 실패"))
  }
}

export async function getCarLogs(carId: number, size: number = 20): Promise<ApiResponse<CarLogResponse[]>> {
  try {
    const page = await apiFetch<SpringPage<any>>(`/api/cars/${carId}/logs?page=0&size=${size}&sort=startAt,desc`)
    const logs = Array.isArray(page?.content) ? page.content.map(normalizeLog) : []
    return ok(logs)
  } catch (e: any) {
    return fail(getErrorMessage(e, "운행 기록 조회 실패"))
  }
}

export async function getDetectionsByLog(logId: number, limit: number = 50, carId?: number): Promise<ApiResponse<Detection[]>> {
  try {
    const detPage = await apiFetch<SpringPage<DetectionListItemResponse>>(
      `/api/logs/${logId}/detections?page=0&size=${limit}&sort=createdAt,desc`
    )
    const robotId = carId ? `car-${carId}` : "unknown"
    return ok(detPage.content.map((d) => mapToUiDetection(d, { robotId })))
  } catch (e: any) {
    return fail(getErrorMessage(e, "감지 목록 조회 실패"))
  }
}

export async function getAllDetectionsForCar(
  carId: number,
  opts?: { logPageSize?: number; detectionsPerLog?: number }
): Promise<ApiResponse<Detection[]>> {
  try {
    const logPageSize = opts?.logPageSize ?? 50
    const detectionsPerLog = opts?.detectionsPerLog ?? 1000

    let page = 0
    const allDetections: Detection[] = []

    while (true) {
      const logsPage = await apiFetch<SpringPage<any>>(
        `/api/cars/${carId}/logs?page=${page}&size=${logPageSize}&sort=startAt,desc`
      )
      const logs = Array.isArray(logsPage?.content) ? logsPage.content : []
      for (const log of logs) {
        const logId = Number(log?.id)
        if (!logId) continue
        const detPage = await apiFetch<SpringPage<DetectionListItemResponse>>(
          `/api/logs/${logId}/detections?page=0&size=${detectionsPerLog}&sort=createdAt,desc`
        )
        const robotId = `car-${carId}`
        const items = Array.isArray(detPage?.content)
          ? detPage.content.map((d) => mapToUiDetection(d, { robotId }))
          : []
        allDetections.push(...items)
      }

      if (logsPage?.last || logs.length === 0) break
      page += 1
    }

    allDetections.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      return tb - ta
    })

    return ok(allDetections)
  } catch (e: any) {
    return fail(getErrorMessage(e, "감지 기록 조회 실패"))
  }
}

export async function getDetectionCountByLog(logId: number): Promise<ApiResponse<number>> {
  try {
    const page = await apiFetch<SpringPage<any>>(`/api/logs/${logId}/detections?page=0&size=1`)
    return ok(Number(page?.totalElements ?? 0))
  } catch (e: any) {
    return fail(getErrorMessage(e, "감지 건수 조회 실패"))
  }
}

export async function getLogStatistics(logId: number, fallbackLastTime?: string): Promise<ApiResponse<DetectionStats | null>> {
  try {
    const raw = await apiFetch<LogStatisticsResponse>(`/api/logs/${logId}/statistics`)
    return ok(normalizeLogStats(raw, fallbackLastTime))
  } catch (e: any) {
    return fail(getErrorMessage(e, "통계 조회 실패"))
  }
}

export async function deleteDetection(id: string): Promise<ApiResponse<void>> {
  try {
    await apiFetch(`/api/detections/${id}`, { method: "DELETE" })
    return ok(undefined)
  } catch (e: any) {
    return fail(getErrorMessage(e, "감지 삭제 실패"))
  }
}

export async function searchDetections(params: {
  startDate?: string
  endDate?: string
  label?: string
}): Promise<ApiResponse<Detection[]>> {
  try {
    const query = new URLSearchParams()
    const normalizeDateTime = (value?: string, fallbackTime?: string) => {
      if (!value) return undefined
      if (value.includes("T")) return value
      return `${value}${fallbackTime ?? "T00:00:00"}`
    }
    const start = normalizeDateTime(params.startDate, "T00:00:00")
    const end = normalizeDateTime(params.endDate, "T23:59:59")
    if (start) query.set("startDate", start)
    if (end) query.set("endDate", end)
    if (params.label) query.set("label", params.label)

    const res = await apiFetch<any>(`/api/detections/search?${query.toString()}`)
    const content = Array.isArray(res) ? res : Array.isArray(res?.content) ? res.content : []
    return ok(content.map((d: any) => mapToUiDetection(d)))
  } catch (e: any) {
    return fail(getErrorMessage(e, "통합 감지 검색 실패"))
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

// ?? ?? ????? ???(??)
    return ok(items)
  } catch (e: any) {
    return fail(getErrorMessage(e, "감지 기록 조회 실패"))
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

// ?? ?? ????? ???(??)
export async function updateDetectionStatus(id: string, status: DetectionStatus): Promise<ApiResponse<Detection>> {
  return ok({ id, status } as any)
}

export async function updateDetectionNotes(id: string, notes: string): Promise<ApiResponse<Detection>> {
  return ok({ id, notes } as any)
}

