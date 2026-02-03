import type { AuthResponse, LoginRequest, SignupRequest, User } from "../types"
import { apiFetch } from "./http"

const AUTH_TOKEN_KEY = "accessToken"
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
  try {
    const res: any = await apiFetch<any>("/api/members/login", {
      method: "POST",
      body: JSON.stringify(request),
    })

    const accessToken = res?.accessToken ?? res?.token ?? res?.data?.accessToken ?? res?.data?.token
    if (accessToken) setAuthToken(accessToken)

    const user: User | undefined = res?.user ?? res?.data?.user ?? res?.data ?? undefined

    return {
      success: Boolean(accessToken),
      token: accessToken,
      user: user
        ? {
            id: String((user as any).id ?? ""),
            email: String((user as any).email ?? request.email ?? ""),
            name: String((user as any).name ?? ""),
            nickname: (user as any).nickname ?? undefined,
            role: (user as any).role ?? "viewer",
            createdAt: String((user as any).createdAt ?? ""),
          }
        : undefined,
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "로그인에 실패했습니다." }
  }
}

export async function signup(request: SignupRequest): Promise<AuthResponse> {
  try {
    await apiFetch<any>("/api/members/signup", {
      method: "POST",
      body: JSON.stringify(request),
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "회원가입에 실패했습니다." }
  }
}

export async function logout(): Promise<void> {
  removeAuthToken()
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken()
  if (!token) return null

  try {
    const res: any = await apiFetch<any>("/api/members/me")
    return {
      id: String(res?.id ?? ""),
      email: String(res?.email ?? ""),
      name: String(res?.name ?? ""),
      nickname: res?.nickname ?? undefined,
      role: res?.role ?? "viewer",
      createdAt: String(res?.createdAt ?? ""),
    }
  } catch {
    return null
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))
  if (!email) {
    return { success: false, error: "이메일을 입력해 주세요." }
  }
  return { success: false, error: "비밀번호 재설정 기능은 아직 지원하지 않습니다." }
}

// ============================================
// Settings API
// ============================================
export async function updateMe(request: { name: string; nickname?: string }): Promise<User | null> {
  const res: any = await apiFetch<any>("/api/members/me", {
    method: "PATCH",
    body: JSON.stringify(request),
  })
  return {
    id: String(res?.id ?? ""),
    email: String(res?.email ?? ""),
    name: String(res?.name ?? ""),
    nickname: res?.nickname ?? undefined,
    role: res?.role ?? "viewer",
    createdAt: String(res?.createdAt ?? ""),
  }
}

export async function updatePassword(request: { currentPassword: string; newPassword: string }): Promise<void> {
  await apiFetch<any>("/api/members/me/password", {
    method: "PATCH",
    body: JSON.stringify(request),
  })
}

export async function deleteMe(request: { password: string }): Promise<void> {
  await apiFetch<any>("/api/members/me", {
    method: "DELETE",
    body: JSON.stringify(request),
  })
}
