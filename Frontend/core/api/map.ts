// core/api/map.ts
import { apiFetch } from "./http"
import type { CarMap } from "../types"

function normalizeMap(raw: any): CarMap {
  return {
    id: Number(raw?.id),
    carId: Number(raw?.carId ?? raw?.car_id ?? raw?.car?.id ?? 0),
    name: String(raw?.name ?? "MAP"),
    imageUrl: raw?.imageUrl ?? raw?.image_url ?? null,
    width: Number(raw?.width ?? 0),
    height: Number(raw?.height ?? 0),
    resolution: Number(raw?.resolution ?? 0),
    originX: Number(raw?.originX ?? raw?.origin_x ?? 0),
    originY: Number(raw?.originY ?? raw?.origin_y ?? 0),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ""),
  }
}

export async function getMaps(carId: number): Promise<CarMap[]> {
  const raw = await apiFetch<any[]>(`/api/cars/${carId}/maps`)
  return Array.isArray(raw) ? raw.map(normalizeMap) : []
}

export async function getCurrentMap(carId: number): Promise<CarMap | null> {
  try {
    const raw = await apiFetch<any>(`/api/cars/${carId}/maps/current`)
    if (!raw) return null
    return normalizeMap(raw)
  } catch {
    return null
  }
}

export async function setCurrentMap(carId: number, mapId: number): Promise<void> {
  await apiFetch<any>(`/api/cars/${carId}/maps/current`, {
    method: "PATCH",
    body: JSON.stringify({ mapId }),
  })
}

export async function deleteMap(carId: number, mapId: number): Promise<void> {
  await apiFetch<any>(`/api/cars/${carId}/maps/${mapId}`, {
    method: "DELETE",
  })
}

export async function getMapDetail(carId: number, mapId: number): Promise<CarMap | null> {
  try {
    const raw = await apiFetch<any>(`/api/cars/${carId}/maps/${mapId}`)
    if (!raw) return null
    return normalizeMap(raw)
  } catch {
    return null
  }
}
