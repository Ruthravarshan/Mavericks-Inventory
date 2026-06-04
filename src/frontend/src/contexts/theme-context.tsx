import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

// ── Types ─────────────────────────────────────────────────────────
export type ThemeVarKey =
  | "background"
  | "foreground"
  | "card"
  | "primary"
  | "border"
  | "muted-foreground";

export type ThemeVars = Record<ThemeVarKey, string>;

export type ThemeMode = "dark" | "light";

export interface ThemePreset {
  id: string;
  name: string;
  builtIn?: boolean;
  // built-in presets have both variants
  dark?: ThemeVars;
  light?: ThemeVars;
  // custom (user-saved) presets have a single mode-agnostic set
  vars?: ThemeVars;
}

// ── Color conversion ───────────────────────────────────────────────
export function hexToHsl(hex: string): string {
  if (!hex || hex.length < 7) return "0 0% 0%";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return "#000000";
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const h2r = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = h2r(p, q, h + 1 / 3);
    g = h2r(p, q, h);
    b = h2r(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function bumpL(hsl: string, delta: number): string {
  const p = hsl.trim().split(/\s+/);
  if (p.length < 3) return hsl;
  const l = Math.min(100, Math.max(0, parseFloat(p[2]) + delta));
  return `${p[0]} ${p[1]} ${l.toFixed(1)}%`;
}

// ── Helper: pick effective vars for a preset + mode ────────────────
export function getPresetVars(preset: ThemePreset, mode: ThemeMode): ThemeVars {
  if (preset.vars) return preset.vars; // custom theme, mode-agnostic
  return mode === "dark" ? preset.dark! : preset.light!;
}

// ── Built-in presets ──────────────────────────────────────────────
export const BUILT_IN_PRESETS: ThemePreset[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    builtIn: true,
    dark: {
      background:        "220 24%  6%",
      foreground:        "210 24% 96%",
      card:              "220 22% 10%",
      primary:           " 36 95% 62%",
      border:            "220 18% 16%",
      "muted-foreground":"215 14% 60%",
    },
    light: {
      background:        " 30 20% 97%",
      foreground:        "220 30% 12%",
      card:              "  0  0% 100%",
      primary:           " 25 90% 45%",
      border:            " 30 15% 88%",
      "muted-foreground":"220 12% 44%",
    },
  },
  {
    id: "slate",
    name: "Slate",
    builtIn: true,
    dark: {
      background:        "222 47% 11%",
      foreground:        "210 40% 98%",
      card:              "217 33% 17%",
      primary:           "174 72% 56%",
      border:            "217 33% 22%",
      "muted-foreground":"215 20% 65%",
    },
    light: {
      background:        "0 0% 100%",
      foreground:        "222 47% 11%",
      card:              "0 0% 100%",
      primary:           "174 84% 32%",
      border:            "214 32% 91%",
      "muted-foreground":"215 16% 47%",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    builtIn: true,
    dark: {
      background:        "222 47%  7%",
      foreground:        "210 30% 80%",
      card:              "222 44% 11%",
      primary:           "213 93% 67%",
      border:            "222 35% 17%",
      "muted-foreground":"215 20% 53%",
    },
    light: {
      background:        "220 22% 97%",
      foreground:        "222 48% 17%",
      card:              "0   0% 100%",
      primary:           "213 80% 48%",
      border:            "220 18% 84%",
      "muted-foreground":"215 18% 50%",
    },
  },
  {
    id: "forest",
    name: "Forest",
    builtIn: true,
    dark: {
      background:        "150 38%  7%",
      foreground:        "140 20% 78%",
      card:              "150 32% 11%",
      primary:           "145 48% 55%",
      border:            "150 28% 16%",
      "muted-foreground":"150 12% 50%",
    },
    light: {
      background:        "130 15% 96%",
      foreground:        "150 42% 16%",
      card:              "0   0% 100%",
      primary:           "145 40% 32%",
      border:            "130 12% 82%",
      "muted-foreground":"140 10% 47%",
    },
  },
  {
    id: "crimson",
    name: "Crimson",
    builtIn: true,
    dark: {
      background:        "345 40%  7%",
      foreground:        "340 20% 80%",
      card:              "345 35% 11%",
      primary:           "348 75% 60%",
      border:            "345 28% 16%",
      "muted-foreground":"340 12% 51%",
    },
    light: {
      background:        "340 18% 97%",
      foreground:        "345 40% 16%",
      card:              "0   0% 100%",
      primary:           "348 70% 45%",
      border:            "340 12% 84%",
      "muted-foreground":"340 10% 48%",
    },
  },
  {
    id: "amethyst",
    name: "Amethyst",
    builtIn: true,
    dark: {
      background:        "270 35%  8%",
      foreground:        "270 20% 80%",
      card:              "270 30% 12%",
      primary:           "270 60% 65%",
      border:            "270 25% 18%",
      "muted-foreground":"270 12% 52%",
    },
    light: {
      background:        "270 15% 97%",
      foreground:        "270 40% 16%",
      card:              "0   0% 100%",
      primary:           "270 55% 46%",
      border:            "270 12% 84%",
      "muted-foreground":"270 10% 48%",
    },
  },
  {
    id: "parchment",
    name: "Parchment",
    builtIn: true,
    dark: {
      background:        "30 35% 10%",
      foreground:        "30 20% 80%",
      card:              "30 28% 15%",
      primary:           "30 30% 55%",
      border:            "30 22% 20%",
      "muted-foreground":"30 12% 52%",
    },
    light: {
      background:        "30 22% 95%",
      foreground:        "28 43% 18%",
      card:              "0   0% 100%",
      primary:           "30 12% 27%",
      border:            "30 12% 78%",
      "muted-foreground":"150  1% 43%",
    },
  },
];

// ── DOM application ───────────────────────────────────────────────
const KEY_VARS: ThemeVarKey[] = [
  "background", "foreground", "card", "primary", "border", "muted-foreground",
];

// Determine if a color is on a light background (lightness > 50%)
function isLightBg(hsl: string): boolean {
  const p = hsl.trim().split(/\s+/);
  return parseFloat(p[2] ?? "0") > 50;
}

export function applyThemeToDom(vars: ThemeVars) {
  const html = document.documentElement;
  for (const key of KEY_VARS) {
    html.style.setProperty(`--${key}`, vars[key]);
  }
  const light = isLightBg(vars.background);
  // For dark themes, bump UP (lighter). For light themes, bump DOWN (subtle gray).
  const sign = light ? -1 : 1;
  // Primary foreground should contrast with the primary color
  const primaryParts = vars.primary.trim().split(/\s+/);
  const primaryL = parseFloat(primaryParts[2] ?? "0");
  const primaryFg = primaryL > 55 ? "220 30% 8%" : "0 0% 100%";

  const derived: [string, string][] = [
    ["card-foreground",      vars.foreground],
    ["popover",              vars.card],
    ["popover-foreground",   vars.foreground],
    ["primary-foreground",   primaryFg],
    ["secondary",            bumpL(vars.card, sign * 4)],
    ["secondary-foreground", vars.foreground],
    ["muted",                bumpL(vars.card, sign * 2)],
    ["muted-foreground",     vars["muted-foreground"]],
    ["accent",               bumpL(vars.card, sign * 6)],
    ["accent-foreground",    vars.foreground],
    ["destructive",          light ? "0 84% 50%" : "0 75% 60%"],
    ["destructive-foreground", "0 0% 100%"],
    ["input",                vars.border],
    ["ring",                 vars.primary],
    // chart palette
    ["chart-grid",           vars.border],
    ["chart-text",           vars["muted-foreground"]],
    ["chart-tooltip-bg",     vars.card],
    ["chart-tooltip-border", vars.border],
    ["chart-tooltip-text",   vars.foreground],
    // semantic accents — calibrated for both modes
    ["success",              light ? "158 64% 36%" : "158 64% 52%"],
    ["warning",              light ? " 32 92% 42%" : " 36 95% 58%"],
    ["info",                 light ? "212 89% 42%" : "212 89% 60%"],
  ];
  for (const [key, val] of derived) {
    html.style.setProperty(`--${key}`, val);
  }
  if (light) html.classList.add("light");
  else       html.classList.remove("light");
}

// ── Context ───────────────────────────────────────────────────────
interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  activePresetId: string;
  currentVars: ThemeVars;
  presets: ThemePreset[];
  applyPreset: (id: string) => void;
  updateColor: (key: ThemeVarKey, hex: string) => void;
  saveAsCustom: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  customizerOpen: boolean;
  openCustomizer: () => void;
  closeCustomizer: () => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

// Bumped from v3 → v4 when the default preset switched from "slate" (teal) to
// "obsidian" (amber). Old saved values are intentionally discarded so existing
// users see the new default on first load.
const STORAGE_KEY = "mavericks_theme_v4";
const LEGACY_STORAGE_KEYS = ["mavericks_theme_v3", "mavericks_theme_v2", "mavericks_theme"];

interface StoredData {
  activePresetId: string;
  mode: ThemeMode;
  savedPresets?: ThemePreset[];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [activePresetId, setActivePresetId] = useState("obsidian");
  const [currentVars, setCurrentVars] = useState<ThemeVars>(BUILT_IN_PRESETS[0].dark!);
  const [savedPresets, setSavedPresets] = useState<ThemePreset[]>([]);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const allPresets = useMemo(
    () => [...BUILT_IN_PRESETS, ...savedPresets],
    [savedPresets]
  );

  useEffect(() => {
    // Always apply default theme first so initial paint matches design tokens
    applyThemeToDom(BUILT_IN_PRESETS[0].dark!);
    // Drop any legacy theme storage (older versions used different defaults)
    try {
      for (const k of LEGACY_STORAGE_KEYS) localStorage.removeItem(k);
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored: StoredData = JSON.parse(raw);
      const customs = stored.savedPresets ?? [];
      setSavedPresets(customs);
      const all = [...BUILT_IN_PRESETS, ...customs];
      const preset = all.find((p) => p.id === stored.activePresetId);
      const m: ThemeMode = stored.mode ?? "dark";
      if (preset) {
        setModeState(m);
        setActivePresetId(preset.id);
        const vars = getPresetVars(preset, m);
        setCurrentVars(vars);
        applyThemeToDom(vars);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(presetId: string, m: ThemeMode, customs: ThemePreset[]) {
    try {
      const data: StoredData = { activePresetId: presetId, mode: m, savedPresets: customs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      const preset = allPresets.find((p) => p.id === activePresetId);
      if (preset) {
        const vars = getPresetVars(preset, m);
        setCurrentVars(vars);
        applyThemeToDom(vars);
        persist(activePresetId, m, savedPresets);
      }
    },
    [allPresets, activePresetId, savedPresets]
  );

  const applyPreset = useCallback(
    (id: string) => {
      const preset = allPresets.find((p) => p.id === id);
      if (!preset) return;
      setActivePresetId(id);
      const vars = getPresetVars(preset, mode);
      setCurrentVars(vars);
      applyThemeToDom(vars);
      persist(id, mode, savedPresets);
    },
    [allPresets, mode, savedPresets]
  );

  const updateColor = useCallback((key: ThemeVarKey, hex: string) => {
    const hsl = hexToHsl(hex);
    setCurrentVars((prev) => {
      const next = { ...prev, [key]: hsl };
      applyThemeToDom(next);
      return next;
    });
  }, []);

  const saveAsCustom = useCallback(
    (name: string) => {
      const id = `custom-${Date.now()}`;
      const preset: ThemePreset = { id, name, builtIn: false, vars: currentVars };
      const updated = [...savedPresets, preset];
      setSavedPresets(updated);
      setActivePresetId(id);
      persist(id, mode, updated);
    },
    [currentVars, savedPresets, mode]
  );

  const deleteCustomPreset = useCallback(
    (id: string) => {
      const updated = savedPresets.filter((p) => p.id !== id);
      setSavedPresets(updated);
      if (activePresetId === id) {
        const fallback = BUILT_IN_PRESETS[0];
        const vars = getPresetVars(fallback, mode);
        setActivePresetId(fallback.id);
        setCurrentVars(vars);
        applyThemeToDom(vars);
        persist(fallback.id, mode, updated);
      } else {
        persist(activePresetId, mode, updated);
      }
    },
    [savedPresets, activePresetId, mode]
  );

  return (
    <ThemeCtx.Provider value={{
      mode,
      setMode,
      activePresetId,
      currentVars,
      presets: allPresets,
      applyPreset,
      updateColor,
      saveAsCustom,
      deleteCustomPreset,
      customizerOpen,
      openCustomizer:  () => setCustomizerOpen(true),
      closeCustomizer: () => setCustomizerOpen(false),
    }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
