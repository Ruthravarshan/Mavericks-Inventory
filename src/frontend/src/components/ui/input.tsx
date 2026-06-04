import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-3 py-2 text-sm text-[hsl(var(--foreground))]",
          "shadow-[inset_0_1px_0_0_rgb(0_0_0_/_0.10)]",
          "transition-[border-color,box-shadow,background] duration-150",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-[hsl(var(--muted-foreground))]/70",
          "hover:border-[hsl(var(--border))]/80 hover:bg-[hsl(var(--card))]/80",
          "focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/25 focus-visible:bg-[hsl(var(--card))]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-[hsl(var(--destructive))] aria-[invalid=true]:ring-[hsl(var(--destructive))]/25",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
