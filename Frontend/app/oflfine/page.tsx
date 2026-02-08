export default function OfflinePage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">오프라인 상태입니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        네트워크 연결이 없어 일부 기능이 제한됩니다. 연결 후 다시 시도해 주세요.
      </p>
    </div>
  )
}
