/**
 * Centralized chart styling that follows the app theme tokens.
 * Read CSS variables at runtime so charts respond to light/dark switches.
 */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

export function getChartTheme() {
  return {
    grid: readVar("--chart-grid", "hsl(217 33% 22%)"),
    text: readVar("--chart-text", "hsl(215 20% 65%)"),
    tooltipBg: readVar("--chart-tooltip-bg", "hsl(222 47% 12%)"),
    tooltipBorder: readVar("--chart-tooltip-border", "hsl(217 33% 22%)"),
    tooltipText: readVar("--chart-tooltip-text", "hsl(210 40% 98%)"),
    primary: readVar("--primary", "hsl(174 72% 56%)"),
  };
}

export function getChartTooltipProps() {
  const t = getChartTheme();
  return {
    contentStyle: {
      backgroundColor: t.tooltipBg,
      border: `1px solid ${t.tooltipBorder}`,
      borderRadius: "8px",
      color: t.tooltipText,
      boxShadow: "0 8px 24px -8px rgba(0,0,0,0.45)",
    },
    labelStyle: { color: t.text, fontSize: 12 },
    itemStyle: { color: t.tooltipText, fontSize: 12 },
    cursor: { fill: "hsl(var(--muted) / 0.4)" },
  };
}

export const CHART_PALETTE = [
  "hsl(174 72% 56%)", // teal/primary
  "hsl(199 89% 56%)", // info-blue
  "hsl(38 92% 50%)",  // warning-amber
  "hsl(269 70% 65%)", // purple
  "hsl(158 64% 52%)", // success-emerald
  "hsl(0 72% 60%)",   // destructive-red
  "hsl(24 90% 60%)",  // orange
  "hsl(215 20% 65%)", // muted-foreground
];
