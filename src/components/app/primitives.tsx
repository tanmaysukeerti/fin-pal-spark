import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/lib/money";

/** Formatted INR amount with tabular numerals. */
export function Money({
  paise,
  className,
  sign = false,
  compact = false,
  showPaise = false,
}: {
  paise: number;
  className?: string;
  sign?: boolean;
  compact?: boolean;
  showPaise?: boolean;
}) {
  const text = compact ? formatINRCompact(paise) : formatINR(paise, { sign, paise: showPaise });
  return <span className={cn("num", className)}>{text}</span>;
}

export function Panel({
  children,
  className,
  neon = false,
  ...rest
}: { children: ReactNode; className?: string; neon?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(neon ? "panel-neon" : "panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cn("chip", className)} style={style}>
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-[#00E5FF]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl leading-tight mt-1 sm:text-4xl">{title}</h1>
        {subtitle && <p className="text-white/55 mt-2 max-w-xl text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-3.5 border",
        accent
          ? "bg-[#00E5FF]/10 border-[#00E5FF]/25"
          : "bg-white/[0.03] border-white/[0.06]",
      )}
    >
      <p className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-white/50">{label}</p>
      <p className={cn("num text-2xl font-semibold mt-1", accent && "text-[#00E5FF]")}>{value}</p>
      {sub && <p className="text-[11px] text-white/50 mt-0.5">{sub}</p>}
    </div>
  );
}

export function ProgressBar({
  pct,
  accent = "#00E5FF",
  complete = false,
  className,
  height = 6,
}: {
  pct: number;
  accent?: string;
  complete?: boolean;
  className?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={cn("rounded-full bg-white/5 overflow-hidden", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          background: complete ? "#00FF9D" : `linear-gradient(90deg, ${accent}, ${accent}99)`,
          boxShadow: `0 0 12px ${complete ? "#00FF9D" : accent}66`,
        }}
      />
    </div>
  );
}

export function IconTile({
  emoji,
  accent = "#00E5FF",
  size = 44,
  className,
}: {
  emoji: string;
  accent?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg grid place-items-center shrink-0 icon-3d", className)}
      style={{
        height: size,
        width: size,
        fontSize: size * 0.5,
        background: `linear-gradient(160deg, ${accent}2e, ${accent}14)`,
        boxShadow: `inset 0 0 0 1px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.25), var(--elev-2)`,
      }}
    >
      <span aria-hidden>{emoji}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && (
        <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] grid place-items-center text-white/50 mb-4">
          {icon}
        </div>
      )}
      <p className="font-display text-xl">{title}</p>
      {hint && <p className="text-white/50 text-sm mt-1.5 max-w-xs">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
