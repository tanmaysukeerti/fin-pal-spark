import { useEffect } from "react";

const SELECTOR = ".card-interactive, .panel-neon";
const MAX_DEG = 6;

/**
 * Global 3D tilt controller. Uses a single delegated pointer listener so every
 * `.card-interactive` / `.panel-neon` element gets cursor-following tilt + glare
 * with zero per-component wiring. Disabled for reduced-motion and touch/coarse
 * pointers (where hover has no meaning and tilt would feel janky).
 */
export function Tilt3D() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (reduce || coarse) return;

    let raf = 0;
    let active: HTMLElement | null = null;

    const reset = (el: HTMLElement) => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.(SELECTOR) as HTMLElement | null;
      if (el !== active && active) reset(active);
      active = el;
      if (!el) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        el.style.setProperty("--ry", `${(px - 0.5) * MAX_DEG * 2}deg`);
        el.style.setProperty("--rx", `${-(py - 0.5) * MAX_DEG * 2}deg`);
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
    };

    const onLeave = () => {
      if (active) {
        reset(active);
        active = null;
      }
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("blur", onLeave);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
