"use client"

import { ApiError } from "@/core/api/http"

function extractBodyMessage(body: string): string | null {
  if (!body) return null
  const trimmed = body.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("<")) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === "string") return parsed
    if (typeof parsed?.message === "string") return parsed.message
    if (typeof parsed?.error === "string") return parsed.error
    if (typeof parsed?.detail === "string") return parsed.detail
    if (Array.isArray(parsed?.errors)) {
      const messages = parsed.errors
        .map((item: any) => item?.message ?? item?.defaultMessage ?? item?.reason ?? null)
        .filter(Boolean)
      if (messages.length) return messages.join("\n")
    }
    if (Array.isArray(parsed?.fieldErrors)) {
      const messages = parsed.fieldErrors
        .map((item: any) => item?.message ?? item?.defaultMessage ?? item?.reason ?? null)
        .filter(Boolean)
      if (messages.length) return messages.join("\n")
    }
  } catch {
    // not JSON
  }

  if (trimmed.length <= 200) return trimmed
  return null
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const bodyMessage = extractBodyMessage(error.body)
    if (bodyMessage) return bodyMessage
    switch (error.status) {
      case 400:
        return "요청 형식을 확인해 주세요."
      case 401:
        return "로그인이 필요합니다."
      case 403:
        return "권한이 없습니다."
      case 404:
        return "요청한 정보를 찾을 수 없습니다."
      case 408:
        return "요청 시간이 초과되었습니다. 다시 시도해 주세요."
      case 409:
        return "이미 처리된 요청입니다."
      case 429:
        return "요청이 많습니다. 잠시 후 다시 시도해 주세요."
      case 500:
      case 502:
      case 503:
      case 504:
        return "서버 문제로 실패했습니다. 잠시 후 다시 시도해 주세요."
      default:
        return fallback
    }
  }
  return fallback
}
