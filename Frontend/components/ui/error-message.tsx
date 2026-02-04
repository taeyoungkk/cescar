"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  message?: React.ReactNode | null
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div className={cn("p-3 rounded-lg bg-destructive/10 border border-destructive/30", className)}>
      <div className="text-sm text-destructive">{message}</div>
    </div>
  )
}

interface ErrorAlertProps {
  title?: string
  message?: React.ReactNode | null
  className?: string
}

export function ErrorAlert({ title, message, className }: ErrorAlertProps) {
  if (!message) return null
  return (
    <div className={cn("p-3 rounded-lg bg-destructive/10 border border-destructive/30", className)}>
      {title && <p className="text-sm font-medium text-destructive">{title}</p>}
      <p className="text-sm text-destructive/90 mt-1">{message}</p>
    </div>
  )
}
