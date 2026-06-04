import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Soft radial glow that follows the cursor with a gentle spring lag.
 * Self-disables on touch / coarse-pointer devices and on `prefers-reduced-motion`.
 *
 * Drop it once near the top of a page; it positions itself `fixed` and is
 * pointer-events:none, so it never interferes with clicks.
 */
export function CursorGlow({
  color = "#f5a623",
  size = 520,
  opacity = 0.22,
  blendMode = "screen",
  zIndex = 5,
  stiffness = 80,
  damping = 18,
  mass = 0.4,
}: {
  color?: string;
  size?: number;
  opacity?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
  zIndex?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}) {
  const [enabled, setEnabled] = useState(false);

  // Track raw cursor with motion values, then apply a spring for smooth lag.
  const rawX = useMotionValue(-1000);
  const rawY = useMotionValue(-1000);
  const x = useSpring(rawX, { stiffness, damping, mass });
  const y = useSpring(rawY, { stiffness, damping, mass });

  useEffect(() => {
    // Skip on touch devices and when user prefers reduced motion
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    function onMove(e: MouseEvent) {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    }
    function onLeave() {
      // park it well off-screen so it fades out
      rawX.set(-1000);
      rawY.set(-1000);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [rawX, rawY]);

  if (!enabled) return null;

  // Convert hex + 0-1 opacity to an rgba-ish gradient. Easier to just inline
  // the color and lean on the gradient itself for the falloff.
  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: size,
        height: size,
        x,
        y,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        pointerEvents: "none",
        zIndex,
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity,
        filter: "blur(18px)",
        mixBlendMode: blendMode,
        willChange: "transform",
      }}
    />
  );
}
