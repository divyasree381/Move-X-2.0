import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/75 disabled:cursor-not-allowed disabled:opacity-60",
      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";