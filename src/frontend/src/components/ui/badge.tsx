import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/35 focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
        secondary:
          "border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
        destructive:
          "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]",
        success:
          "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
        warning:
          "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
        info:
          "border-[hsl(var(--info))]/30 bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]",
        outline:
          "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))]",
        solid:
          "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
