import { cn } from "@/lib/utils";

interface HealthBadgeProps {
  score?: number;
  status?: "healthy" | "warning" | "critical";
  className?: string;
}

function getStatus(score?: number, status?: "healthy" | "warning" | "critical"): "healthy" | "warning" | "critical" {
  if (status) return status;
  if (score === undefined) return "critical";
  if (score >= 70) return "healthy";
  if (score >= 40) return "warning";
  return "critical";
}

const statusConfig = {
  healthy: {
    label: "Healthy",
    className: "bg-green-500/20 text-green-400 border border-green-500/30",
    dot: "bg-green-400",
  },
  warning: {
    label: "Warning",
    className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    dot: "bg-yellow-400",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/20 text-red-400 border border-red-500/30",
    dot: "bg-red-400",
  },
};

export function HealthBadge({ score, status, className }: HealthBadgeProps) {
  const resolvedStatus = getStatus(score, status);
  const config = statusConfig[resolvedStatus];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
      {score !== undefined && (
        <span className="opacity-75">({score})</span>
      )}
    </span>
  );
}
