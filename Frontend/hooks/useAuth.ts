"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const checkRequestIdRef = useRef(0)
  const loginRequestIdRef = useRef(0)
  const signupRequestIdRef = useRef(0)
  const resetRequestIdRef = useRef(0)
  const logoutRequestIdRef = useRef(0)
  const loginInFlightRef = useRef(false)
  const signupInFlightRef = useRef(false)
  const resetInFlightRef = useRef(false)
  const logoutInFlightRef = useRef(false)

  const isAuthenticated = user !== null

  useEffect(() => {
    async function checkAuth() {
      const requestId = ++checkRequestIdRef.current
      try {
        const currentUser = await authApi.getCurrentUser()
        if (checkRequestIdRef.current != requestId) return
        setUser(currentUser)
      } catch {
        if (checkRequestIdRef.current != requestId) return
        setUser(null)
      } finally {
        if (checkRequestIdRef.current != requestId) return
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const login = useCallback(
    async (request: LoginRequest): Promise<boolean> => {
      if (!online) {
        setError("오프라인 상태입니다.")
        return false
      }
      if (loginInFlightRef.current) return false
      loginInFlightRef.current = true
      const requestId = ++loginRequestIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        const response = await authApi.login(request)
        if (loginRequestIdRef.current != requestId) return false

        if (response.success) {
          if (response.user) {
            setUser(response.user)
          } else {
            const currentUser = await authApi.getCurrentUser()
            if (loginRequestIdRef.current != requestId) return false
            setUser(currentUser)
          }
          registerFcmToken({ requestPermission: true }).catch(() => {})
          router.push("/home")
          return true
        }

        setError(response.error || "로그인에 실패했습니다.")
        return false
      } catch {
        setError("\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.")
        return false
      } finally {
        if (loginRequestIdRef.current == requestId) {
          setIsLoading(false)
        }
        loginInFlightRef.current = false
      }
    },
    [online, router]
  )

  const signup = useCallback(async (request: SignupRequest): Promise<boolean> => {
    if (!online) {
      setError("오프라인 상태입니다.")
      return false
    }
    if (signupInFlightRef.current) return false
    signupInFlightRef.current = true
    const requestId = ++signupRequestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.signup(request)
      if (signupRequestIdRef.current != requestId) return false

      if (response.success) {
        return true
      } else {
        setError(response.error || "회원가입에 실패했습니다.")
        return false
      }
    } catch {
      setError("\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.")
      return false
    } finally {
      if (signupRequestIdRef.current == requestId) {
        setIsLoading(false)
      }
      signupInFlightRef.current = false
    }
  }, [online])

  const logout = useCallback(async (): Promise<void> => {
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return
      }
      if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    const requestId = ++logoutRequestIdRef.current
    setIsLoading(true)
    try {
      await unregisterFcmToken()
      await authApi.logout()
      if (logoutRequestIdRef.current != requestId) return
      setUser(null)
      router.push("/")
    } finally {
      if (logoutRequestIdRef.current == requestId) {
        setIsLoading(false)
      }
      logoutInFlightRef.current = false
    }
  }, [online, router])

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
      if (!online) {
        setError("\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.")
        return false
      }
      if (resetInFlightRef.current) return false
    resetInFlightRef.current = true
    const requestId = ++resetRequestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.requestPasswordReset(email)
      if (resetRequestIdRef.current != requestId) return false

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
      if (resetRequestIdRef.current == requestId) {
        setIsLoading(false)
      }
      resetInFlightRef.current = false
    }
  }, [online])

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
