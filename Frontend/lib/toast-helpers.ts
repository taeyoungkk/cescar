"use client"

type ToastFn = (options: { title?: string; description?: string; variant?: "default" | "destructive" }) => void

function normalizeSuccessTitle(title: string) {
  return title.includes("완료") ? title : `${title} 완료`
}

function normalizeErrorTitle(title: string) {
  if (title.includes("실패") || title.includes("불가") || title.includes("필요")) return title
  return `${title} 실패`
}

export function toastError(toast: ToastFn, title: string, description: string) {
  toast({ title: normalizeErrorTitle(title), description, variant: "destructive" })
}

export function toastSuccess(toast: ToastFn, title: string, description: string) {
  toast({ title: normalizeSuccessTitle(title), description })
}

export function toastInfo(toast: ToastFn, title: string, description: string) {
  toast({ title, description })
}
