const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

if (!BASE_URL) console.warn("NEXT_PUBLIC_API_BASE_URL is not set")

function hasJsonBody(init?: RequestInit) {
  // body가 있고, FormData가 아닌 경우에만 JSON으로 취급
  const b: any = init?.body
  return b != null && !(b instanceof FormData)
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null

  const headers: Record<string, string> = {
    ...(init?.headers as any),
  }

  // ✅ body가 있을 때만 Content-Type 세팅
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
    throw new Error(`API ${res.status} ${res.statusText} - ${text}`)
  }

  // 204 대비 (혹시 생기면)
  if (res.status === 204) return null as T

  return (await res.json()) as T
}
