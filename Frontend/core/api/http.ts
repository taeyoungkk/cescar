const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

if (!BASE_URL) console.warn("NEXT_PUBLIC_API_BASE_URL is not set")

function hasJsonBody(init?: RequestInit) {
  // If body exists and is not FormData, treat as JSON
  const body: any = init?.body
  return body != null && !(body instanceof FormData)
}

export class ApiError extends Error {
  status: number
  statusText: string
  body: string

  constructor(status: number, statusText: string, body: string) {
    super(`API ${status} ${statusText}`)
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null

  const headers: Record<string, string> = {
    ...(init?.headers as any),
  }

  // Set Content-Type for JSON body
  if (hasJsonBody(init) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new ApiError(res.status, res.statusText, text)
  }

  // 204 No Content
  if (res.status === 204) return null as T

  return (await res.json()) as T
}
