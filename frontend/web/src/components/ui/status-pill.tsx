import { AlertCircle, CheckCircle2, Clock3, Radio } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusTone, string> = {
  success: "border-success/30 text-success bg-success/10",
  warning: "border-warning/30 text-warning bg-warning/10",
  danger: "border-destructive/30 text-destructive bg-destructive/10",
  info: "border-ride/30 text-ride bg-ride/10",
};

const icons = {
  success: CheckCircle2,
  warning: Clock3,
  danger: AlertCircle,
  info: Radio,
};

export function StatusPill({ label, tone = "info", className }: { label: string; tone?: StatusTone; className?: string }) {
  const Icon = icons[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}