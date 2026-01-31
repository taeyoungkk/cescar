"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, CheckCircle, Info } from "lucide-react"
import { CescarLogo } from "@/components/cescar-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

interface ForgotPasswordFormProps {
  email: string
  isLoading: boolean
  error: string | null
  onEmailChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  resetSupported: boolean
}

function ForgotPasswordForm({
  email,
  isLoading,
  error,
  onEmailChange,
  onSubmit,
  resetSupported,
}: ForgotPasswordFormProps) {
  return (
    <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <CescarLogo size={40} className="text-primary" />
          <span className="text-xl font-bold text-foreground">Cescar</span>
        </div>
        <CardTitle className="text-xl">비밀번호 재설정</CardTitle>
        <CardDescription>가입한 이메일 주소를 입력해 주세요</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                required
                className="bg-input border-border pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !resetSupported}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                전송 중...
              </div>
            ) : (
              "재설정 링크 전송"
            )}
          </Button>
        </form>

        {!resetSupported && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-muted-foreground" />
            비밀번호 재설정 API가 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function SuccessView({ email }: { email: string }) {
  return (
    <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border/50">
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">이메일 전송 완료</h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{email}</span>로
            <br />
            비밀번호 재설정 링크를 보냈습니다.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="mt-4 bg-transparent">
            로그인으로 돌아가기
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

export default function ForgotPasswordPage() {
  const { requestPasswordReset, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const resetSupported = false

  useEffect(() => {
    if (error) clearError()
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetSupported) return
    const success = await requestPasswordReset(email)
    if (success) setIsSuccess(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      {isSuccess ? (
        <SuccessView email={email} />
      ) : (
        <ForgotPasswordForm
          email={email}
          isLoading={isLoading}
          error={error}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          resetSupported={resetSupported}
        />
      )}
    </div>
  )
}
