import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

const TONE_MAP = {
  primary: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
  teal:    "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]",
  blue:    "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]",
  amber:   "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
  red:     "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]",
  green:   "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  purple:  "bg-violet-500/15 text-violet-400",
  slate:   "bg-[hsl(var(--muted))]/40 text-[hsl(var(--muted-foreground))]",
} as const;

export type StatTone = keyof typeof TONE_MAP;

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return count;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  tone?: StatTone;
  onClick?: () => void;
  index?: number;
  animate?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  trend,
  tone = "primary",
  onClick,
  index = 0,
  animate = true,
  className,
}: StatCardProps) {
  const numericValue = typeof value === "number" ? value : NaN;
  const animated = useCountUp(Number.isNaN(numericValue) ? 0 : numericValue);
  const displayValue =
    Number.isNaN(numericValue) ? value : formatNumber(animate ? animated : numericValue);

  const wrapper = animate ? motion.div : ("div" as const);
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] as const },
        whileHover: onClick ? { y: -2, transition: { duration: 0.18 } } : undefined,
      }
    : {};

  const CardEl = React.createElement(
    wrapper as React.ElementType,
    wrapperProps,
    <Card
      className={cn(
        "group transition-all",
        onClick &&
          "cursor-pointer hover:border-[hsl(var(--primary))]/40 hover:shadow-md hover:shadow-[hsl(var(--primary))]/5",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {title}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums leading-none text-[hsl(var(--foreground))]">
              {displayValue}
            </p>
            {trend && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[hsl(var(--destructive))]" />
                )}
                <span className={trend.positive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}>
                  {trend.value}%
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">vs last month</span>
              </div>
            )}
            {hint && !trend && (
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                TONE_MAP[tone]
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return CardEl;
}
