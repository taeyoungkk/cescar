"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
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

  const [profile, setProfile] = React.useState({
    email: "",
    name: "",
    nickname: "",
  })
  const [savingProfile, setSavingProfile] = React.useState(false)

  const [passwords, setPasswords] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [savingPassword, setSavingPassword] = React.useState(false)

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
    setSavingProfile(true)
    try {
      await authApi.updateMe({ name: profile.name, nickname: profile.nickname })
      toast({ title: "저장 완료", description: "회원 정보가 업데이트되었습니다." })
    } catch (e: any) {
      toast({ title: "저장 실패", description: e?.message ?? "회원 정보 저장에 실패했습니다." })
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast({ title: "입력 필요", description: "현재 비밀번호와 새 비밀번호를 입력해주세요." })
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ title: "비밀번호 불일치", description: "새 비밀번호가 일치하지 않습니다." })
      return
    }

    setSavingPassword(true)
    try {
      await authApi.updatePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" })
      toast({ title: "변경 완료", description: "비밀번호가 변경되었습니다." })
    } catch (e: any) {
      toast({ title: "변경 실패", description: e?.message ?? "비밀번호 변경에 실패했습니다." })
    } finally {
      setSavingPassword(false)
    }
  }

  const onDeleteAccount = async () => {
    try {
      await authApi.deleteMe()
      await logout()
      router.push("/")
    } catch (e: any) {
      toast({ title: "탈퇴 실패", description: e?.message ?? "회원 탈퇴에 실패했습니다." })
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
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-red-400">회원 탈퇴</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">회원 탈퇴</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    계정과 연결된 차량 정보가 해제될 수 있으며, 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteAccount}>탈퇴</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
