import type { AuthResponse, LoginRequest, SignupRequest, User } from "../types"
import { mockUser } from "../mockData"

const AUTH_TOKEN_KEY = "cescar_access_token"
const MOCK_DELAY = 800

// ============================================
// Token Management
// ============================================
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}

// ============================================
// Auth API Functions
// ============================================
export async function login(request: LoginRequest): Promise<AuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))
  
  // Mock validation - accept any credentials for demo
  if (!request.email || !request.password) {
    return {
      success: false,
      error: "이메일과 비밀번호를 입력해주세요.",
    }
  }

  const token = `mock-token-${Date.now()}`
  setAuthToken(token)

  return {
    success: true,
    token,
    user: mockUser,
  }
}

export async function signup(request: SignupRequest): Promise<AuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  if (!request.name || !request.email || !request.password) {
    return {
      success: false,
      error: "모든 필드를 입력해주세요.",
    }
  }

  if (request.password.length < 8) {
    return {
      success: false,
      error: "비밀번호는 8자 이상이어야 합니다.",
    }
  }

  // Mock signup success - don't auto-login
  return {
    success: true,
    user: {
      ...mockUser,
      id: `user-${Date.now()}`,
      email: request.email,
      name: request.name,
    },
  }
}

export async function logout(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  removeAuthToken()
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken()
  if (!token) return null

  await new Promise((resolve) => setTimeout(resolve, 200))
  return mockUser
}

export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))

  if (!email) {
    return {
      success: false,
      error: "이메일을 입력해주세요.",
    }
  }

  return {
    success: true,
  }
}
