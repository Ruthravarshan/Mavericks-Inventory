import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const paddings = {
    sm: "py-8",
    md: "py-12",
    lg: "py-20",
  } as const;
  const iconSize = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  } as const;
  const wrapperSize = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        paddings[size],
        className
      )}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
          className={cn(
            "mb-4 flex items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))]",
            wrapperSize[size]
          )}
        >
          <Icon className={iconSize[size]} />
        </motion.div>
      )}
      <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
