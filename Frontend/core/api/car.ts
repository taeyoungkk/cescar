// core/api/car.ts
import { apiFetch } from "./http"
import type { CarDetail, CarStatus, CarSummary, CarMode } from "../types"

function normalizeCarStatus(raw: any): CarStatus {
  // 1) 평탄형을 우선 신뢰
  const x = raw?.x ?? raw?.pose?.x ?? null
  const y = raw?.y ?? raw?.pose?.y ?? null
  const heading = Number(raw?.heading ?? raw?.pose?.heading ?? 0)

  const mode = (raw?.mode ?? "STOP") as CarMode
  const isOnline = Boolean(raw?.isOnline ?? raw?.is_online ?? false)
  const updatedAt = String(raw?.updatedAt ?? raw?.updated_at ?? new Date().toISOString())

  return { x, y, heading, mode, isOnline, updatedAt }
}

function normalizeCarSummary(raw: any): CarSummary {
  return {
    carId: Number(raw?.carId ?? raw?.id),
    nickname: String(raw?.nickname ?? raw?.name ?? "CESCAR"),
    mode: (raw?.mode ?? "STOP") as CarMode,
    isOnline: Boolean(raw?.isOnline ?? raw?.is_online ?? false),
  }
}

function normalizeCarDetail(raw: any): CarDetail {
  return {
    carId: Number(raw?.carId ?? raw?.id),
    deviceId: String(raw?.deviceId ?? raw?.device_id ?? ""),
    claimCode: String(raw?.claimCode ?? raw?.claim_code ?? ""),
    ownerId: raw?.ownerId ?? raw?.owner_id ?? null,
    nickname: String(raw?.nickname ?? raw?.name ?? "CESCAR"),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ""),
    status: normalizeCarStatus(raw?.status ?? {}),
  }
}

export async function getMyCars(): Promise<CarSummary[]> {
  const raw = await apiFetch<any[]>("/api/cars")
  return Array.isArray(raw) ? raw.map(normalizeCarSummary) : []
}

export async function getCarDetail(carId: number): Promise<CarDetail> {
  const raw = await apiFetch<any>(`/api/cars/${carId}`)
  return normalizeCarDetail(raw)
}

export async function getCarStatus(carId: number): Promise<CarStatus> {
  const raw = await apiFetch<any>(`/api/cars/${carId}/status`)
  const normalized = normalizeCarStatus(raw)
  console.log("[getCarStatus]", raw, "=>", normalized) // 임시
  return normalized
}
