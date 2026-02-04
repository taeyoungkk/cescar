"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { toastError, toastInfo, toastSuccess } from "@/lib/toast-helpers"
import { getErrorMessage } from "@/lib/error-messages"
import { ApiError } from "@/core/api/http"
import { CheckCircle } from "lucide-react"
import { ErrorMessage } from "@/components/ui/error-message"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/useAuth"
import * as authApi from "@/core/api/auth"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, logout } = useAuth()
  const passwordRule = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  const [profile, setProfile] = React.useState({
    email: "",
    name: "",
    nickname: "",
  })
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)
  const [profileMessageType, setProfileMessageType] = React.useState<"success" | "error" | null>(null)

  const [passwords, setPasswords] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [savingPassword, setSavingPassword] = React.useState(false)
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null)
  const [passwordMessageType, setPasswordMessageType] = React.useState<"success" | "error" | null>(null)
  const [withdrawPassword, setWithdrawPassword] = React.useState("")
  const [withdrawMessage, setWithdrawMessage] = React.useState<string | null>(null)
  const [withdrawMessageType, setWithdrawMessageType] = React.useState<"success" | "error" | null>(null)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false)
  const [withdrawSuccessOpen, setWithdrawSuccessOpen] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      setProfile({
        email: user.email,
        name: user.name ?? "",
        nickname: user.nickname ?? "",
      })
    } else {
      authApi.getCurrentUser().then((u) => {
        if (!u) return
        setProfile({
          email: u.email,
          name: u.name ?? "",
          nickname: u.nickname ?? "",
        })
      })
    }
  }, [user])

  const onSaveProfile = async () => {
    setProfileMessage(null)
    setProfileMessageType(null)
    setSavingProfile(true)
    try {
      await authApi.updateMe({ name: profile.name, nickname: profile.nickname })
      toastSuccess(toast, "저장 완료", "회원 정보가 업데이트되었습니다.")
      setProfileMessage("회원 정보가 업데이트되었습니다.")
      setProfileMessageType("success")
    } catch (e) {
      const message = getErrorMessage(e, "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.")
      toastError(toast, "저장 실패", message)
      setProfileMessage(message)
      setProfileMessageType("error")
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async () => {
    setPasswordMessage(null)
    setPasswordMessageType(null)
    if (!passwords.currentPassword || !passwords.newPassword) {
      toastInfo(toast, "입력 필요", "현재 비밀번호와 새 비밀번호를 입력해주세요.")
      setPasswordMessage("현재 비밀번호와 새 비밀번호를 입력해주세요.")
      setPasswordMessageType("error")
      return
    }
    if (!passwords.confirmPassword) {
      toastInfo(toast, "입력 필요", "새 비밀번호 확인을 입력해주세요.")
      setPasswordMessage("새 비밀번호 확인을 입력해주세요.")
      setPasswordMessageType("error")
      return
    }
    if (!passwordRule.test(passwords.newPassword)) {
      toastInfo(toast, "비밀번호 규칙", "영문/숫자/특수문자를 포함해 8자 이상으로 입력해주세요.")
      setPasswordMessage("영문/숫자/특수문자를 포함해 8자 이상으로 입력해주세요.")
      setPasswordMessageType("error")
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toastInfo(toast, "비밀번호 불일치", "새 비밀번호가 일치하지 않습니다.")
      setPasswordMessage("새 비밀번호가 일치하지 않습니다.")
      setPasswordMessageType("error")
      return
    }

    setSavingPassword(true)
    try {
      await authApi.updatePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      })
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" })
      toastSuccess(toast, "변경 완료", "비밀번호가 변경되었습니다.")
      setPasswordMessage("비밀번호가 변경되었습니다.")
      setPasswordMessageType("success")
    } catch (e) {
      let message = getErrorMessage(e, "현재 비밀번호를 확인해 주세요.")
      if (e instanceof ApiError && e.status === 401 && message === "로그인이 필요합니다.") {
        message = "로그인이 만료되었습니다. 다시 로그인해 주세요."
      }
      toastError(toast, "변경 실패", message)
      setPasswordMessage(message)
      setPasswordMessageType("error")
    } finally {
      setSavingPassword(false)
    }
  }

  const onDeleteAccount = async (): Promise<boolean> => {
    setWithdrawMessage(null)
    setWithdrawMessageType(null)
    if (!withdrawPassword.trim()) {
      toastInfo(toast, "입력 필요", "비밀번호를 입력해주세요.")
      setWithdrawMessage("비밀번호를 입력해주세요.")
      setWithdrawMessageType("error")
      return false
    }

    try {
      await authApi.deleteMe({ password: withdrawPassword })
      toastSuccess(toast, "탈퇴 완료", "회원 탈퇴가 완료되었습니다.")
      setWithdrawMessage("회원 탈퇴가 완료되었습니다.")
      setWithdrawMessageType("success")
      setWithdrawSuccessOpen(true)
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setWithdrawDialogOpen(false)
      await logout()
      router.replace("/")
      return true
    } catch (e) {
      const message = getErrorMessage(e, "탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.")
      toastError(toast, "탈퇴 실패", message)
      setWithdrawMessage(message)
      setWithdrawMessageType("error")
      return false
    } finally {
      setWithdrawPassword("")
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">설정</h1>
          <p className="text-sm text-muted-foreground mt-1">계정 정보를 관리하세요</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium">계정 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">이메일</p>
              <Input value={profile.email} disabled className="bg-input border-border" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">이름</p>
              <Input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">닉네임</p>
              <Input
                value={profile.nickname}
                onChange={(e) => setProfile((p) => ({ ...p, nickname: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={onSaveProfile} disabled={savingProfile}>
                저장
              </Button>
            </div>
            {profileMessageType === "error" && <ErrorMessage message={profileMessage} />}
            {profileMessageType === "success" && (
              <p className="text-xs text-emerald-500">{profileMessage}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium">비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">현재 비밀번호</p>
              <Input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">새 비밀번호</p>
              <Input
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                className="bg-input border-border"
              />
              <p className="text-[11px] text-muted-foreground">영문/숫자/특수문자 포함 8자 이상</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">새 비밀번호 확인</p>
              <Input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={onChangePassword} disabled={savingPassword}>
                변경
              </Button>
            </div>
            {passwordMessageType === "error" && <ErrorMessage message={passwordMessage} />}
            {passwordMessageType === "success" && (
              <p className="text-xs text-emerald-500">{passwordMessage}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-red-400">회원 탈퇴</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog
              open={withdrawDialogOpen}
              onOpenChange={(open) => {
                if (!open && withdrawSuccessOpen) return
                setWithdrawDialogOpen(open)
                if (!open) {
                  setWithdrawMessage(null)
                  setWithdrawMessageType(null)
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">회원 탈퇴</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                {withdrawSuccessOpen ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">회원 탈퇴 완료</p>
                      <p className="text-sm text-muted-foreground">로그인 화면으로 이동합니다.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        탈퇴하면 계정과 연결된 차량 연동이 해제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">비밀번호 확인</p>
                      <Input
                        type="password"
                        value={withdrawPassword}
                        onChange={(e) => setWithdrawPassword(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async (e) => {
                      e.preventDefault()
                      if (!withdrawPassword.trim()) {
                        setWithdrawMessage("비밀번호를 입력해주세요.")
                        setWithdrawMessageType("error")
                        toastInfo(toast, "입력 필요", "비밀번호를 입력해주세요.")
                        return
                      }
                      await onDeleteAccount()
                    }}
                  >
                    탈퇴
                  </AlertDialogAction>
                    </AlertDialogFooter>
                    {withdrawMessageType === "error" && <ErrorMessage message={withdrawMessage} />}
                    {withdrawMessageType === "success" && (
                      <p className="text-xs text-emerald-500">{withdrawMessage}</p>
                    )}
                  </>
                )}
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
