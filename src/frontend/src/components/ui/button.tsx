import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "will-change-transform active:scale-[0.975] active:duration-75",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/35",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          [
            "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
            "shadow-[0_1px_0_0_rgb(255_255_255_/_0.08)_inset,0_4px_12px_-4px_hsl(var(--primary)_/_0.45)]",
            "hover:bg-[hsl(var(--primary))]/92 hover:-translate-y-[0.5px] hover:shadow-[0_1px_0_0_rgb(255_255_255_/_0.10)_inset,0_8px_20px_-6px_hsl(var(--primary)_/_0.55)]",
          ].join(" "),
        destructive:
          [
            "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
            "shadow-[0_1px_0_0_rgb(255_255_255_/_0.10)_inset,0_4px_12px_-4px_hsl(var(--destructive)_/_0.45)]",
            "hover:bg-[hsl(var(--destructive))]/92 hover:-translate-y-[0.5px]",
          ].join(" "),
        outline:
          [
            "border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))]",
            "hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
            "hover:border-[hsl(var(--primary))]/40 hover:-translate-y-[0.5px]",
          ].join(" "),
        secondary:
          [
            "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
            "border border-[hsl(var(--border))]/60",
            "hover:bg-[hsl(var(--accent))] hover:-translate-y-[0.5px]",
          ].join(" "),
        ghost:
          "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
        link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-[13px]",
        lg: "h-11 rounded-md px-7 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
