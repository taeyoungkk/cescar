"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2 text-sm">
        <div className="font-medium">오프라인 상태입니다.</div>
        <div className="text-muted-foreground">
          제출/요청 기능은 비활성화됩니다.
        </div>
      </div>
    </div>
  );
}
