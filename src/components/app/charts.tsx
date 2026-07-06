import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
  Legend,
} from "recharts";

/** Recharts only measures on the client; render a matching-height placeholder
 *  until mounted so SSR and first client render agree (no hydration mismatch). */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const tooltipStyle = {
  background: "#0D0D1F",
  border: "1px solid rgba(0,229,255,0.25)",
  borderRadius: 12,
  fontSize: 12,
  color: "#E8ECFF",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.8)",
} as const;

/** Smooth neon area chart (used for net-worth trend). Recharts-backed. */
export function AreaSparkline({
  points,
  color = "#00E5FF",
  className,
  format,
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showEndDot?: boolean;
  format?: (v: number) => string;
}) {
  const gradId = useId().replace(/:/g, "");
  const mounted = useMounted();
  const data = points.map((v, i) => ({ i, v }));
  if (!mounted) {
    return <div className={className} aria-hidden style={{ opacity: 0 }} />;
  }
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.3 }}
            contentStyle={tooltipStyle}
            labelFormatter={() => ""}
            formatter={(v: number) => [format ? format(v) : String(v), ""]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: "#06060F" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Circular progress donut (SVG — crisp, SSR-safe, supports centered content). */
export function Donut({
  pct,
  color = "#00E5FF",
  size = 72,
  stroke = 6,
  children,
  track = "rgba(255,255,255,0.06)",
}: {
  pct: number;
  color?: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ height: size, width: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </div>
  );
}

/** Vertical bar chart with hover tooltip (Recharts-backed). */
export function MiniBars({
  data,
  color = "#00E5FF",
  height = 140,
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const gradId = useId().replace(/:/g, "");
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} aria-hidden />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }} barCategoryGap="20%">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatValue ? formatValue(v) : String(v), "Spent"]}
          />
          <Bar dataKey="value" fill={`url(#${gradId})`} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grouped income/expense bars with legend + tooltip (Recharts-backed). */
export function GroupedBars({
  data,
  incomeColor = "#00FF9D",
  expenseColor = "#FF8A5B",
  height = 160,
  formatValue,
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  incomeColor?: string;
  expenseColor?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} aria-hidden />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }} barGap={2}>
          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={tooltipStyle}
            formatter={(v: number, name) => [formatValue ? formatValue(v) : String(v), name === "income" ? "Income" : "Expense"]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}
            formatter={(value) => (value === "income" ? "Income" : "Expense")}
          />
          <Bar dataKey="income" fill={incomeColor} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" fill={expenseColor} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Categorical distribution bar (kept for reuse; Recharts Cell colors). */
export function CategoryBars({
  data,
  height = 160,
  formatValue,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} aria-hidden />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={tooltipStyle} formatter={(v: number) => [formatValue ? formatValue(v) : String(v), ""]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Activity heatmap grid (CSS — SSR-safe). */
export function Heatmap({
  values,
  columns = 7,
  color = "0,229,255",
}: {
  values: number[];
  columns?: number;
  color?: string;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-md"
          style={{
            background: `rgba(${color}, ${v > 0 ? 0.2 + v * 0.8 : 0.06})`,
            border: "1px solid rgba(255,255,255,0.04)",
          }}
          title={v > 0 ? "Saved" : "No activity"}
        />
      ))}
    </div>
  );
}
