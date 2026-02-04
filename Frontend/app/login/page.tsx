"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ShieldCheck, Camera, Wifi, Bug } from "lucide-react"
import { CescarLogo } from "@/components/cescar-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ErrorMessage } from "@/components/ui/error-message"
import { useToast } from "@/components/ui/use-toast"
import { toastError } from "@/lib/toast-helpers"
import { useAuth } from "@/hooks/useAuth"

// ============================================
// Presentational Components
// ============================================

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
      <div className="p-2 rounded-md bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function BrandingSection() {
  return (
    <div className="hidden lg:flex lg:flex-1 flex-col justify-center p-12 bg-gradient-to-br from-secondary/50 via-background to-secondary/30">
      <div className="max-w-md mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <CescarLogo size={56} className="text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cescar</h1>
            <p className="text-muted-foreground">벌레 감지 로봇 모니터링 시스템</p>
          </div>
        </div>

        <p className="text-lg text-muted-foreground leading-relaxed">
          AI 기반 실시간 감지와 모니터링 환경으로 시설을 안전하게 관리하세요.
        </p>

        <div className="space-y-3">
          <FeatureCard icon={Camera} title="실시간 카메라" description="로봇 카메라를 통한 실시간 모니터링" />
          <FeatureCard icon={Bug} title="AI 감지" description="딥러닝 기반 해충 자동 인식" />
          <FeatureCard icon={Wifi} title="원격 제어" description="어디서나 로봇을 제어하고 관리" />
        </div>
      </div>
    </div>
  )
}

interface LoginFormProps {
  email: string
  password: string
  showPassword: boolean
  isLoading: boolean
  error: string | null
  validationErrors: Record<string, string>
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onSubmit: (e: React.FormEvent) => void
}

function LoginForm({
  email,
  password,
  showPassword,
  isLoading,
  error,
  validationErrors,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}: LoginFormProps) {
  const validationMessages = Object.values(validationErrors).filter(Boolean)
  const combinedError = error
    ? error
    : validationMessages.length
    ? (
        <ul className="list-disc pl-4 space-y-1">
          {validationMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )
    : null

  return (
    <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-3 mb-4 lg:hidden">
          <CescarLogo size={40} className="text-primary" />
          <span className="text-xl font-bold text-foreground">Cescar</span>
        </div>
        <CardTitle className="text-xl">로그인</CardTitle>
        <CardDescription>계정 정보를 입력해 주세요</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="bg-input border-border"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                className="bg-input border-border pr-10"
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={onTogglePassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <ErrorMessage message={combinedError} />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                로그인 중...
              </div>
            ) : (
              "로그인"
            )}
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-center text-sm">
            <Link href="/signup" className="text-primary hover:underline">
              계정이 없으신가요? 회원가입
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>안전한 연결로 보호합니다</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuth()
  const { toast } = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const lastToastRef = React.useRef<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/home")
    }
  }, [isAuthenticated, router])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (error) {
      clearError()
    }
    setValidationErrors({})
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (error) {
      clearError()
    }
    setValidationErrors({})
  }

  useEffect(() => {
    if (!error || error === lastToastRef.current) return
    toastError(toast, "로그인 실패", error)
    lastToastRef.current = error
  }, [error, toast])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!email.trim()) {
      errors.email = "이메일을 입력해주세요."
    }
    if (!password.trim()) {
      errors.password = "비밀번호를 입력해주세요."
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    await login({ email, password })
  }

  return (
    <div className="min-h-screen flex">
      <BrandingSection />

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          isLoading={isLoading}
          error={error}
          validationErrors={validationErrors}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
