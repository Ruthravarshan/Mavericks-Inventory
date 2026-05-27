import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Trash2, Palette, Sun, Moon, Plus } from "lucide-react";
import {
  useTheme,
  hslToHex,
  getPresetVars,
  BUILT_IN_PRESETS,
  type ThemePreset,
  type ThemeVarKey,
  type ThemeMode,
} from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

// ── Color metadata ────────────────────────────────────────────────
const COLOR_META: Record<ThemeVarKey, { label: string; hint: string }> = {
  background:         { label: "Background",    hint: "Main page bg" },
  foreground:         { label: "Text",           hint: "Primary text" },
  card:               { label: "Sidebar / Card", hint: "Panels & cards" },
  primary:            { label: "Accent",         hint: "Buttons, active nav" },
  border:             { label: "Border",         hint: "Dividers & outlines" },
  "muted-foreground": { label: "Dim Text",       hint: "Secondary text" },
};

const VAR_ORDER: ThemeVarKey[] = [
  "background", "foreground", "card", "primary", "border", "muted-foreground",
];

// ── Dark / Light mode pill toggle ─────────────────────────────────
function ModeToggle({
  mode,
  onChange,
}: {
  mode: ThemeMode;
  onChange: (m: ThemeMode) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-0.5">
      {(["dark", "light"] as ThemeMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
            mode === m
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          {m === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
          <span className="capitalize">{m}</span>
        </button>
      ))}
    </div>
  );
}

// ── Preset mini-card ──────────────────────────────────────────────
function PresetCard({
  preset,
  mode,
  isActive,
  onClick,
}: {
  preset: ThemePreset;
  mode: ThemeMode;
  isActive: boolean;
  onClick: () => void;
}) {
  const vars = getPresetVars(preset, mode);
  const bg   = hslToHex(vars.background);
  const card = hslToHex(vars.card);
  const acc  = hslToHex(vars.primary);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all duration-150",
        isActive
          ? "border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/30"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50"
      )}
    >
      {/* 3-band color preview */}
      <div
        className="flex h-8 w-full overflow-hidden rounded-sm"
        style={{ outline: "1px solid rgba(128,128,128,0.12)" }}
      >
        <div style={{ flex: 3, background: bg }} />
        <div style={{ flex: 2, background: card }} />
        <div style={{ flex: 2, background: acc }} />
      </div>
      {/* Name + active indicator */}
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium text-[hsl(var(--foreground))]">
          {preset.name}
        </span>
        {isActive && <Check className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />}
      </div>
    </button>
  );
}

// ── Color picker row ──────────────────────────────────────────────
function ColorRow({
  varKey,
  hsl,
  onChange,
}: {
  varKey: ThemeVarKey;
  hsl: string;
  onChange: (key: ThemeVarKey, hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hex  = hslToHex(hsl);
  const meta = COLOR_META[varKey];

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => inputRef.current?.click()}
        className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[hsl(var(--border))] transition-all hover:scale-110 hover:border-[hsl(var(--primary))]/60"
        style={{ background: hex }}
        title={`Edit ${meta.label}`}
      >
        <input
          ref={inputRef}
          type="color"
          value={hex}
          onChange={(e) => onChange(varKey, e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </button>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[hsl(var(--foreground))]">{meta.label}</div>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{meta.hint}</div>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="shrink-0 font-mono text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        {hex.toUpperCase()}
      </button>
    </div>
  );
}

// ── Create theme inline form ───────────────────────────────────────
function CreateThemeForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--card))] p-3"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">
        Name Your Theme
      </p>
      <p className="mb-2.5 text-[11px] text-[hsl(var(--muted-foreground))]">
        Current color adjustments will be saved as a reusable theme.
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="e.g. My Dark Teal…"
        className="mb-2 h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--primary))] text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          <Check className="h-3.5 w-3.5" />
          Save Theme
        </button>
        <button
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main panel ────────────────────────────────────────────────────
export function ThemeCustomizer() {
  const {
    customizerOpen,
    closeCustomizer,
    mode,
    setMode,
    activePresetId,
    currentVars,
    presets,
    applyPreset,
    updateColor,
    saveAsCustom,
    deleteCustomPreset,
  } = useTheme();

  const panelRef   = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);

  const builtInPresets = BUILT_IN_PRESETS;
  const customPresets  = presets.filter((p) => !p.builtIn);

  // Outside click → close
  useEffect(() => {
    if (!customizerOpen) return;
    function handle(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeCustomizer();
      }
    }
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [customizerOpen, closeCustomizer]);

  // Escape → close
  useEffect(() => {
    if (!customizerOpen) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") closeCustomizer();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [customizerOpen, closeCustomizer]);

  function handleCreate(name: string) {
    saveAsCustom(name);
    setCreating(false);
  }

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {customizerOpen && (
          <motion.div
            key="tc-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={closeCustomizer}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {customizerOpen && (
          <motion.div
            ref={panelRef}
            key="tc-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-[320px] flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span
                  className="text-[11px] font-bold uppercase text-[hsl(var(--foreground))]"
                  style={{ letterSpacing: "0.22em" }}
                >
                  Theme Studio
                </span>
              </div>
              <button
                onClick={closeCustomizer}
                className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Mode toggle ── */}
            <div className="shrink-0 border-b border-[hsl(var(--border))] px-4 py-3">
              <ModeToggle mode={mode} onChange={setMode} />
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* Presets */}
              <div className="px-4 pt-4 pb-3">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]/60">
                  Presets
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {builtInPresets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      mode={mode}
                      isActive={activePresetId === preset.id}
                      onClick={() => applyPreset(preset.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="mx-4 h-px bg-[hsl(var(--border))]" />

              {/* Customize colors */}
              <div className="px-4 py-3">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]/60">
                  Customize Colors
                </p>
                <div className="flex flex-col gap-3.5">
                  {VAR_ORDER.map((key) => (
                    <ColorRow
                      key={key}
                      varKey={key}
                      hsl={currentVars[key]}
                      onChange={updateColor}
                    />
                  ))}
                </div>
              </div>

              <div className="mx-4 h-px bg-[hsl(var(--border))]" />

              {/* Create Custom Theme */}
              <div className="px-4 py-3">
                <AnimatePresence mode="wait">
                  {creating ? (
                    <CreateThemeForm
                      key="form"
                      onSave={handleCreate}
                      onCancel={() => setCreating(false)}
                    />
                  ) : (
                    <motion.button
                      key="btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setCreating(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/8 py-2.5 text-xs font-semibold text-[hsl(var(--primary))] transition-all hover:bg-[hsl(var(--primary))]/15 hover:border-[hsl(var(--primary))]/70"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Custom Theme
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* My Themes */}
              {customPresets.length > 0 && (
                <>
                  <div className="mx-4 h-px bg-[hsl(var(--border))]" />
                  <div className="px-4 py-3">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]/60">
                      My Themes
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {customPresets.map((preset) => {
                        const vars = preset.vars!;
                        const isActive = activePresetId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            className={cn(
                              "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                              isActive
                                ? "border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/8"
                                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/40"
                            )}
                          >
                            {/* 3-dot preview */}
                            <div className="flex gap-1">
                              {(["background", "card", "primary"] as ThemeVarKey[]).map((k) => (
                                <div
                                  key={k}
                                  className="h-3 w-3 rounded-full"
                                  style={{
                                    background: hslToHex(vars[k]),
                                    outline: "1px solid rgba(128,128,128,0.2)",
                                  }}
                                />
                              ))}
                            </div>

                            <button
                              className="flex-1 text-left text-xs font-medium text-[hsl(var(--foreground))]"
                              onClick={() => applyPreset(preset.id)}
                            >
                              {preset.name}
                              {isActive && (
                                <Check className="ml-1.5 inline h-3 w-3 text-[hsl(var(--primary))]" />
                              )}
                            </button>

                            <button
                              onClick={() => deleteCustomPreset(preset.id)}
                              className="flex h-5 w-5 items-center justify-center rounded text-[hsl(var(--muted-foreground))]/40 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                              title="Delete theme"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-2.5">
              <p
                className="text-[10px] text-[hsl(var(--muted-foreground))]/50"
                style={{ letterSpacing: "0.06em" }}
              >
                Colors preview live · Save to persist
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
