"use client";

import type { ReactNode } from "react";

import { ErrorState, RetryButton, Skeleton } from "@/components/ui";

export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load"
        description={error instanceof Error ? error.message : "The request could not be completed."}
        action={<RetryButton onRetry={onRetry} />}
      />
    );
  }

  return <>{children}</>;
}