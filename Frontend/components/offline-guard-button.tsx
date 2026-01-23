"use client";

import * as React from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useToast } from "@/components/ui/use-toast";
import { Button, type ButtonProps } from "@/components/ui/button";

type OfflineGuardButtonProps = ButtonProps & {
  offlineMessage?: string;
};

export function OfflineGuardButton({
  offlineMessage = "오프라인 상태에서는 요청/제출이 불가능합니다. 네트워크 연결 후 다시 시도해 주세요.",
  onClick,
  disabled,
  ...rest
}: OfflineGuardButtonProps) {
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();

  const blocked = !isOnline;
  const finalDisabled = Boolean(disabled) || blocked;

  // disabled 상태에서도 안내를 띄우기 위해 wrapper 클릭을 사용
  if (finalDisabled) {
    return (
      <div
        onClick={() => {
          if (blocked) {
            toast({ title: "오프라인 상태", description: offlineMessage });
          }
        }}
      >
        <Button {...rest} disabled>
          {rest.children}
        </Button>
      </div>
    );
  }

  return (
    <Button
      {...rest}
      onClick={(e) => {
        onClick?.(e);
      }}
    />
  );
}
