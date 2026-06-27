import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

import { Button } from "./button";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center">
      <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-foreground">{title}</h2>
      {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-destructive/35 bg-surface p-6">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("min-h-4 rounded-md bg-surface-muted", "motion-safe:animate-pulse", className)} aria-hidden="true" />;
}

export function RetryButton({ onRetry, label = "Retry" }: { onRetry: () => void; label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={onRetry}>
      <RefreshCw className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}