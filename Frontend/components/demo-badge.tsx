"use client";
import { DEMO_MODE } from "@/core/demo/config";
import { Badge } from "@/components/ui/badge";

export function DemoBadge() {
  if (!DEMO_MODE) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
        DEMO MODE
      </Badge>
    </div>
  );
}
