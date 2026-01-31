"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { User, LoginRequest, SignupRequest } from "@/core/types"
import * as authApi from "@/core/api/auth"
import { registerFcmToken, unregisterFcmToken } from "@/lib/fcm"

interface UseAuthReturn {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (request: LoginRequest) => Promise<boolean>
  signup: (request: SignupRequest) => Promise<boolean>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<boolean>
  clearError: () => void
}

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = user !== null

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (!user) return
    registerFcmToken({ requestPermission: false }).catch(() => {})
  }, [user?.id])

  const login = useCallback(
    async (request: LoginRequest): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await authApi.login(request)

        if (response.success) {
          if (response.user) {
            setUser(response.user)
          } else {
            const currentUser = await authApi.getCurrentUser()
            setUser(currentUser)
          }
          registerFcmToken({ requestPermission: true }).catch(() => {})
          router.push("/home")
          return true
        }

        setError(response.error || "로그인에 실패했습니다.")
        return false
      } catch {
        setError("로그인 중 오류가 발생했습니다.")
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  const signup = useCallback(async (request: SignupRequest): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.signup(request)

      if (response.success) {
        return true
      } else {
        setError(response.error || "회원가입에 실패했습니다.")
        return false
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      await unregisterFcmToken()
      await authApi.logout()
      setUser(null)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.requestPasswordReset(email)

      if (response.success) {
        return true
      } else {
        setError(response.error || "요청에 실패했습니다.")
        return false
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
    requestPasswordReset,
    clearError,
  }
}
