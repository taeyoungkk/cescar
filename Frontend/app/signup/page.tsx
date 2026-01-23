"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle } from "lucide-react"
import { CescarLogo } from "@/components/cescar-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

// ============================================
// Presentational Components
// ============================================

interface SignupFormProps {
  name: string
  email: string
  password: string
  confirmPassword: string
  showPassword: boolean
  isLoading: boolean
  error: string | null
  validationErrors: Record<string, string>
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onSubmit: (e: React.FormEvent) => void
}

function SignupForm({
  name,
  email,
  password,
  confirmPassword,
  showPassword,
  isLoading,
  error,
  validationErrors,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onSubmit,
}: SignupFormProps) {
  return (
    <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <CescarLogo size={40} className="text-primary" />
          <span className="text-xl font-bold text-foreground">Cescar</span>
        </div>
        <CardTitle className="text-xl">회원가입</CardTitle>
        <CardDescription>새 계정을 만들어주세요</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              required
              className="bg-input border-border"
            />
            {validationErrors.name && (
              <p className="text-xs text-destructive">{validationErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              className="bg-input border-border"
            />
            {validationErrors.email && (
              <p className="text-xs text-destructive">{validationErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="8자 이상 입력"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
                className="bg-input border-border pr-10"
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
            {validationErrors.password && (
              <p className="text-xs text-destructive">{validationErrors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호 재입력"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              required
              className="bg-input border-border"
            />
            {validationErrors.confirmPassword && (
              <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                처리 중...
              </div>
            ) : (
              "회원가입"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function SuccessView() {
  return (
    <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border/50">
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">회원가입 완료</h3>
          <p className="text-sm text-muted-foreground">
            계정이 생성되었습니다. 로그인 페이지로 이동합니다.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Page Component (connects UI to hooks)
// ============================================

export default function SignupPage() {
  const router = useRouter()
  const { signup, isLoading, error, clearError } = useAuth()
  
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isSuccess, setIsSuccess] = useState(false)

  // Clear errors when inputs change
  useEffect(() => {
    if (error) {
      clearError()
    }
    setValidationErrors({})
  }, [name, email, password, confirmPassword])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = "이름을 입력해주세요."
    }

    if (!email.trim()) {
      errors.email = "이메일을 입력해주세요."
    }

    if (password.length < 8) {
      errors.password = "비밀번호는 8자 이상이어야 합니다."
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다."
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const success = await signup({ name, email, password })
    if (success) {
      setIsSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      {isSuccess ? (
        <SuccessView />
      ) : (
        <SignupForm
          name={name}
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          showPassword={showPassword}
          isLoading={isLoading}
          error={error}
          validationErrors={validationErrors}
          onNameChange={setName}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
