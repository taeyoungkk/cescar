export function parseBackendDate(value?: string | null): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized)
  const iso = hasTimezone ? normalized : `${normalized}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function getKstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
}
