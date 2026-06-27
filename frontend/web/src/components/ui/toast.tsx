"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ToastKind = "info" | "success" | "error";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  kind: ToastKind;
};

type ToastContextValue = {
  toast: (item: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function ToastCenter({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    setItems((current) => [...current, { ...item, id: crypto.randomUUID() }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport className="fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" />
        {items.map((item) => {
          const Icon = icons[item.kind];
          return (
            <ToastPrimitive.Root
              key={item.id}
              className={cn(
                "rounded-md border border-border bg-surface p-4 text-foreground shadow-[var(--shadow-shell)] motion-safe:animate-[toast-in_160ms_ease-out]",
                item.kind === "error" && "border-destructive/40",
              )}
              onOpenChange={(open) => {
                if (!open) {
                  setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
                }
              }}
            >
              <div className="flex gap-3">
                <Icon className={cn("mt-0.5 size-5", item.kind === "success" && "text-success", item.kind === "error" && "text-destructive", item.kind === "info" && "text-ride")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <ToastPrimitive.Title className="text-sm font-semibold">{item.title}</ToastPrimitive.Title>
                  {item.description ? <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">{item.description}</ToastPrimitive.Description> : null}
                </div>
                <ToastPrimitive.Close className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted" aria-label="Dismiss">
                  <X className="size-4" aria-hidden="true" />
                </ToastPrimitive.Close>
              </div>
            </ToastPrimitive.Root>
          );
        })}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastCenter");
  }
  return context;
}