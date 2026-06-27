"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string; side?: "left" | "right" | "bottom" }
>(({ className, children, title, description, side = "right", ...props }, ref) => {
  const sideClass =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg border-t"
      : side === "left"
        ? "inset-y-0 left-0 w-[min(24rem,calc(100vw-2rem))] border-r"
        : "inset-y-0 right-0 w-[min(24rem,calc(100vw-2rem))] border-l";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 motion-safe:animate-[overlay-in_140ms_ease-out]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("fixed z-50 border-border bg-surface p-5 text-foreground shadow-[var(--shadow-shell)] motion-safe:animate-[content-in_160ms_ease-out]", sideClass, className)}
        {...props}
      >
        <div className="pr-10">
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
        </div>
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DrawerContent.displayName = "DrawerContent";