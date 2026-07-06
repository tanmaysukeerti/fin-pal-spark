import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowUpRight, ArrowDownRight, ChevronRight, Plus, Target, Wallet, Trophy,
  Flame, TrendingUp, Users, CheckCircle2, PiggyBank, BarChart3,
} from "lucide-react";
import { getDashboardFn } from "@/api/dashboard";
import { Money, Chip, ProgressBar, StatTile } from "@/components/app/primitives";
import { AreaSparkline, Donut, Heatmap } from "@/components/app/charts";
import { BuddyPanel } from "@/components/app/BuddyPanel";
import { Coin3D } from "@/components/app/Coin3D";
import { achievementIcon } from "@/components/app/achievement-icons";
import { formatINR } from "@/lib/money";

export const Route = createFileRoute("/_app/")({
  loader: async () => await getDashboardFn(),
  component: DashboardPage,
});

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function DashboardPage() {
  const d = Route.useLoaderData() as Awaited<ReturnType<typeof getDashboardFn>>;
  useReveal();
  const positive = d.weekChange >= 0;

  return (
    <div className="grid grid-cols-12 gap-4 xl:gap-5">
      {/* Net worth hero */}
      <div className="reveal panel-neon col-span-12 xl:col-span-8 p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/60 to-transparent scan-line" />
        <Coin3D className="absolute top-2 right-3 h-24 w-24 sm:h-28 sm:w-28 pointer-events-none z-10 hidden sm:block" />
        <div className="relative flex flex-wrap items-start justify-between gap-4 sm:pr-28">
          <div>
            <Chip><span className="h-1.5 w-1.5 rounded-full bg-[#00FF9D]" /> Live Net Worth</Chip>
            <div className="mt-4 flex items-baseline gap-1">
              <Money paise={d.netWorth} showPaise className="text-5xl sm:text-6xl font-light tracking-tight" />
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm flex-wrap">
              <span className={`flex items-center gap-1 ${positive ? "text-[#00FF9D]" : "text-[#FF8A5B]"}`}>
                {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <Money paise={Math.abs(d.weekChange)} sign={false} />
                <span className="text-white/40 ml-1">this week</span>
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/50">{Math.abs(d.weekChangePct).toFixed(1)}% vs last week</span>
            </div>
          </div>
          <span className="font-mono-tech text-[10px] text-white/40 tracking-widest self-start">UPI · SBI · HDFC linked</span>
        </div>

        <div className="relative mt-6">
          <AreaSparkline points={d.series.map((s) => s.value)} className="w-full h-28 sm:h-32" format={(v) => formatINR(v)} />
        </div>

        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile accent label="Auto-Saved" value={<Money paise={d.stats.autoSavedThisMonth} />} sub="this month" />
          <StatTile label="Roundups" value={d.stats.roundupCount} sub="transactions" />
          <StatTile label="Streak" value={`${d.stats.streak}d`} sub="🔥 keep it up" />
          <StatTile label="Pods Active" value={d.stats.podsActive} sub={`${d.stats.podsNearGoal} near goal`} />
        </div>
      </div>

      {/* Buddy */}
      <div className="reveal panel col-span-12 xl:col-span-4 p-6 flex flex-col">
        <BuddyPanel compact />
      </div>

      {/* Pods */}
      <div className="reveal panel col-span-12 xl:col-span-7 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Chip><Target size={10} /> Savings Pods</Chip>
            <h3 className="font-display text-2xl mt-2">
              Goals in flight <span className="text-white/40">— {d.pods.filter((p) => p.status === "active").length} of {d.pods.length}</span>
            </h3>
          </div>
          <Link to="/pods" className="flex items-center gap-1 text-sm text-[#00E5FF] hover:gap-2 transition-all">
            New pod <Plus size={14} />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {d.pods.slice(0, 4).map((p) => (
            <Link to="/pods" key={p.id} className="group relative rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 card-interactive overflow-hidden block">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-lg grid place-items-center text-2xl shrink-0" style={{ background: `${p.accent}22`, boxShadow: `inset 0 0 0 1px ${p.accent}33` }}>{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="num text-[11px] text-white/50 mt-0.5"><Money paise={p.savedAmount} /> <span className="text-white/30">/ <Money paise={p.goalAmount} /></span></p>
                </div>
                <span className={`num text-xs font-semibold ${p.pct >= 100 ? "text-[#00FF9D]" : "text-white/70"}`}>{p.pct}%</span>
              </div>
              <ProgressBar className="mt-3" pct={p.pct} accent={p.accent} complete={p.pct >= 100} />
              {p.pct >= 100 && (
                <span className="absolute top-2 right-2 chip !py-0.5 !px-1.5 !bg-[#00FF9D]/15 !border-[#00FF9D]/30 !text-[#00FF9D]"><Trophy size={9} /> Unlocked</span>
              )}
            </Link>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between px-1 text-xs text-white/50">
          <span className="font-mono-tech tracking-wider">TOTAL COMMITTED · <Money className="text-white" paise={d.stats.totalCommitted} /></span>
          <Link to="/pods" className="flex items-center gap-1 hover:text-white">See all pods <ChevronRight size={12} /></Link>
        </div>
      </div>

      {/* Streak */}
      <div className="reveal panel col-span-12 xl:col-span-5 p-6">
        <div className="flex items-center justify-between">
          <Chip><Flame size={10} className="text-[#FF8A5B]" /> Streak</Chip>
          <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">LAST 7 WEEKS</span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="num text-5xl font-light">{d.stats.streak}</span>
          <span className="text-white/50">day streak</span>
          <span className="ml-auto text-[#FF8A5B] text-2xl" aria-hidden>🔥</span>
        </div>
        <div className="mt-5"><Heatmap values={d.heatmap} columns={7} /></div>
        <div className="hairline mt-5 pt-4 flex items-center justify-between">
          <div>
            <p className="font-mono-tech text-[10px] uppercase tracking-widest text-white/50">Total saved in pods</p>
            <p className="text-sm mt-0.5"><Money className="text-white" paise={d.stats.totalSaved} /> across {d.pods.length} pods</p>
          </div>
          <TrendingUp size={20} className="text-[#00E5FF]" />
        </div>
      </div>

      {/* Budgets */}
      <div className="reveal panel col-span-12 xl:col-span-5 p-6">
        <div className="flex items-center justify-between">
          <Chip><BarChart3 size={10} /> Weekly Budget</Chip>
          <Link to="/insights" className="font-mono-tech text-[10px] text-[#00E5FF] tracking-wider hover:underline">MANAGE</Link>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {d.budgets.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <Donut pct={Math.min(100, b.pct)} color={b.pct > 100 ? "#FF6B7A" : b.color} size={64} stroke={6}>
                <span className="text-lg" aria-hidden>{b.icon}</span>
              </Donut>
              <div className="min-w-0">
                <p className="text-sm truncate">{b.category}</p>
                <p className="num text-xs text-white/50 mt-0.5"><Money paise={b.spent} /> <span className="text-white/30">of <Money paise={b.cap} /></span></p>
                <p className="num text-[10px] font-mono-tech tracking-wider mt-1" style={{ color: b.pct > 100 ? "#FF6B7A" : b.color }}>{b.pct}% USED</p>
              </div>
            </div>
          ))}
          {d.budgets.length === 0 && <p className="text-sm text-white/40">No budgets yet. Add some in Insights.</p>}
        </div>
      </div>

      {/* Transactions */}
      <div className="reveal panel col-span-12 xl:col-span-7 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Chip><Wallet size={10} /> Live Feed</Chip>
            <h3 className="font-display text-2xl mt-2">Recent activity</h3>
          </div>
          <Link to="/transactions" className="flex items-center gap-1 text-sm text-[#00E5FF] hover:gap-2 transition-all">All <ChevronRight size={14} /></Link>
        </div>
        <div className="mt-4 -mx-2">
          {d.recentTx.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-2 py-3 border-t border-white/5 hover:bg-white/[0.02] rounded-lg transition">
              <div className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-lg shrink-0" aria-hidden>{t.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.name}</p>
                <p className="text-[11px] text-white/40">{t.category}</p>
              </div>
              {t.roundupSaved > 0 && (
                <span className="chip !text-[#00E5FF] !border-[#00E5FF]/25 !bg-[#00E5FF]/10"><PiggyBank size={9} /> +<Money paise={t.roundupSaved} /></span>
              )}
              <span className={`num text-sm font-semibold w-20 text-right ${t.type === "income" ? "text-[#00FF9D]" : "text-white"}`}>
                {t.type === "income" ? "+" : "−"}<Money paise={t.amount} />
              </span>
            </div>
          ))}
          {d.recentTx.length === 0 && <p className="text-sm text-white/40 px-2 py-6">No transactions yet.</p>}
        </div>
      </div>

      {/* Family */}
      <div className="reveal panel col-span-12 xl:col-span-4 p-6">
        <div className="flex items-center justify-between">
          <Chip><Users size={10} /> Family Hub</Chip>
          <Link to="/family" className="font-mono-tech text-[10px] text-[#00FF9D] hover:underline">● MANAGE</Link>
        </div>
        <div className="mt-4 space-y-3">
          {d.family.allowance && (
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
              <div>
                <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/50">Weekly Allowance</p>
                <p className="text-sm mt-0.5"><Money className="font-semibold" paise={d.family.allowance.amount} /> every week</p>
              </div>
              <span className="h-6 w-11 rounded-full bg-[#00E5FF] relative shadow-[0_0_12px_#00E5FF80]">
                <span className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-[#06060F]" />
              </span>
            </div>
          )}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/50">Chore Rewards</p>
            <ul className="mt-2 space-y-2 text-sm">
              {d.family.completedChores.slice(0, 1).map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">{c.icon} {c.title} <CheckCircle2 size={12} className="text-[#00FF9D]" /></span>
                  <span className="num text-[#00FF9D]">+<Money paise={c.reward} /></span>
                </li>
              ))}
              {d.family.pendingChores.slice(0, 2).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-white/60">
                  <span>{c.icon} {c.title}</span>
                  <span className="num"><Money paise={c.reward} /></span>
                </li>
              ))}
              {d.family.pendingChores.length === 0 && d.family.completedChores.length === 0 && (
                <li className="text-white/40">No chores yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="reveal panel col-span-12 xl:col-span-4 p-6">
        <div className="flex items-center justify-between">
          <Chip><Trophy size={10} /> Trophy Case</Chip>
          <span className="font-mono-tech text-[10px] text-white/40">{d.achievements.unlocked} / {d.achievements.total}</span>
        </div>
        <p className="mt-3 font-display text-xl leading-tight">Every rupee saved is a badge earned.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {d.achievements.recent.map((b) => {
            const Icon = achievementIcon(b.icon);
            return (
              <div key={b.id} title={b.label} className={`aspect-square rounded-xl grid place-items-center border transition ${b.unlocked ? "bg-[#00E5FF]/10 border-[#00E5FF]/25 text-[#00E5FF]" : "bg-white/[0.02] border-white/[0.05] text-white/20"}`}>
                <Icon size={22} />
              </div>
            );
          })}
        </div>
        <Link to="/rewards" className="mt-4 w-full text-center text-sm text-white/60 hover:text-white flex items-center justify-center gap-1">
          View all trophies <ChevronRight size={13} />
        </Link>
      </div>

      {/* Goals strip */}
      <div className="reveal panel col-span-12 xl:col-span-8 p-6">
        <div className="flex items-center justify-between">
          <Chip><Target size={10} /> Long-term Goals</Chip>
          <Link to="/goals" className="flex items-center gap-1 text-sm text-[#00E5FF] hover:gap-2 transition-all">Manage <ChevronRight size={14} /></Link>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {d.goals.slice(0, 3).map((g) => (
            <div key={g.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{g.icon}</span>
                <p className="text-sm font-medium truncate flex-1">{g.title}</p>
              </div>
              <p className="num text-xs text-white/50 mt-2"><Money paise={g.currentAmount} /> <span className="text-white/30">/ <Money paise={g.targetAmount} /></span></p>
              <ProgressBar className="mt-2" pct={g.pct} complete={g.pct >= 100} />
              <p className="num text-[10px] font-mono-tech tracking-wider mt-2 text-[#00E5FF]">{g.pct}%</p>
            </div>
          ))}
          {d.goals.length === 0 && <p className="text-sm text-white/40">No goals yet — set your first on the Goals page.</p>}
        </div>
      </div>
    </div>
  );
}
