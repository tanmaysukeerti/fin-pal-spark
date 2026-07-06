import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Loader2, Wallet,
  PiggyBank, BarChart3, CalendarDays, Store, Layers, Check,
} from "lucide-react";
import { toast } from "sonner";
import { getInsightsFn } from "@/api/insights";
import {
  listBudgetsFn, createBudgetFn, updateBudgetFn, deleteBudgetFn,
} from "@/api/budgets";
import {
  Money, Chip, PageHeader, StatTile, ProgressBar, EmptyState,
} from "@/components/app/primitives";
import { MiniBars, GroupedBars } from "@/components/app/charts";
import { Modal, Field } from "@/components/app/Modal";
import { formatINR, toRupees } from "@/lib/money";

export const Route = createFileRoute("/_app/insights")({
  loader: async () => ({
    insights: await getInsightsFn(),
    budgets: (await listBudgetsFn()).budgets,
  }),
  component: InsightsPage,
});

type Insights = Awaited<ReturnType<typeof getInsightsFn>>;
type BudgetRow = Awaited<ReturnType<typeof listBudgetsFn>>["budgets"][number];

const SWATCHES = [
  "#00E5FF", "#00FF9D", "#FF8A5B", "#FF6B7A",
  "#FFD166", "#C2B6FF", "#FFB4D8", "#B5FFC6",
];
const EMOJIS = ["💸", "🍔", "🛒", "🚕", "🎮", "📱", "👕", "🎬", "☕", "📚", "💊", "🏠"];

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

function InsightsPage() {
  const { insights, budgets }: { insights: Insights; budgets: BudgetRow[] } = Route.useLoaderData();
  useReveal();
  const r = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (b: BudgetRow) => { setEditing(b); setModalOpen(true); };

  const removeBudget = async (b: BudgetRow) => {
    setDeletingId(b.id);
    try {
      const res = await deleteBudgetFn({ data: { id: b.id } });
      if (!res.ok) { toast.error(res.error ?? "Could not delete budget"); return; }
      await r.invalidate();
      toast.success("Budget deleted");
    } catch {
      toast.error("Could not delete budget");
    } finally {
      setDeletingId(null);
    }
  };

  const iv = insights.incomeVsExpense;

  return (
    <div className="space-y-4 xl:space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Insights"
        subtitle="Where your money went this month — spending by category, daily burn, income vs expense, and every budget you've set."
        actions={
          <button className="btn-primary text-sm" onClick={openCreate}>
            <Plus size={16} /> Add budget
          </button>
        }
      />

      {/* KPI row */}
      <div className="reveal grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          accent
          label="Income · this month"
          value={<Money paise={iv.income} />}
          sub={<>vs <Money paise={iv.prevIncome} /> last month</>}
        />
        <StatTile
          label="Spent · this month"
          value={<Money paise={iv.expense} />}
          sub={<>vs <Money paise={iv.prevExpense} /> last month</>}
        />
        <StatTile
          label="Net"
          value={<Money paise={iv.net} className={iv.net >= 0 ? "text-[#00FF9D]" : "text-[#FF6B7A]"} />}
          sub={iv.net >= 0 ? "in the green" : "overspending"}
        />
        <StatTile
          label="Savings Rate"
          value={<span className={insights.savingsRate >= 0 ? "text-[#00FF9D]" : "text-[#FF6B7A]"}>{insights.savingsRate}%</span>}
          sub={<><Money paise={insights.monthSaved} /> auto-saved</>}
        />
      </div>

      {/* context chips */}
      <div className="reveal flex flex-wrap gap-2">
        <Chip><PiggyBank size={11} className="text-[#00E5FF]" /> Round-ups all time · <Money className="text-white" paise={insights.totalRoundupSaved} /></Chip>
        <Chip><Layers size={11} className="text-[#00FF9D]" /> {insights.podsCount} savings pods</Chip>
        <Chip><BarChart3 size={11} className="text-[#FF8A5B]" /> {budgets.length} active budgets</Chip>
      </div>

      <div className="grid grid-cols-12 gap-4 xl:gap-5">
        {/* Category breakdown */}
        <section className="reveal panel p-6 col-span-12 xl:col-span-7">
          <div className="flex items-center justify-between">
            <Chip><Wallet size={10} /> By Category</Chip>
            <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">THIS MONTH</span>
          </div>
          <h3 className="font-display text-2xl mt-2">Where it went</h3>
          {insights.categoryBreakdown.length === 0 ? (
            <EmptyState icon={<Wallet size={22} />} title="No spending yet" hint="Once you log expenses this month, your category split shows up here." />
          ) : (
            <ul className="mt-5 space-y-4 max-h-[22rem] overflow-y-auto pr-1">
              {insights.categoryBreakdown.map((c) => (
                <li key={c.category}>
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-lg grid place-items-center text-lg shrink-0" style={{ background: `${c.color}22`, boxShadow: `inset 0 0 0 1px ${c.color}33` }} aria-hidden>{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm truncate">{c.category}</p>
                        <span className="num text-sm font-semibold shrink-0"><Money paise={c.amount} /></span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar className="flex-1" pct={c.pct} accent={c.color} height={5} />
                        <span className="num text-[10px] font-mono-tech tracking-wider w-9 text-right" style={{ color: c.color }}>{c.pct}%</span>
                      </div>
                      {c.cap != null && (
                        <p className="num text-[10px] text-white/40 mt-1">cap <Money paise={c.cap} /></p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Daily spend */}
        <section className="reveal panel p-6 col-span-12 xl:col-span-5">
          <div className="flex items-center justify-between">
            <Chip><CalendarDays size={10} /> Daily Burn</Chip>
            <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">LAST 14 DAYS</span>
          </div>
          <h3 className="font-display text-2xl mt-2">Spend per day</h3>
          <div className="mt-6">
            <MiniBars
              data={insights.dailySpend.map((d) => ({ label: String(new Date(d.date).getDate()), value: d.value }))}
              formatValue={(v) => formatINR(v)}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-3">Hover a bar to see the exact amount. Numbers are day-of-month.</p>
        </section>

        {/* 6-month trend */}
        <section className="reveal panel p-6 col-span-12 xl:col-span-7">
          <div className="flex items-center justify-between">
            <Chip><BarChart3 size={10} /> Trend</Chip>
            <div className="flex items-center gap-3 text-[11px] text-white/60">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00FF9D]" /> Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FF8A5B]" /> Expense</span>
            </div>
          </div>
          <h3 className="font-display text-2xl mt-2">Last 6 months</h3>
          <div className="mt-6">
            <GroupedBars data={insights.monthlyTrend} />
          </div>
        </section>

        {/* Top merchants */}
        <section className="reveal panel p-6 col-span-12 xl:col-span-5">
          <div className="flex items-center justify-between">
            <Chip><Store size={10} /> Top Merchants</Chip>
            <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">ALL TIME</span>
          </div>
          <h3 className="font-display text-2xl mt-2">Biggest spends</h3>
          {insights.topMerchants.length === 0 ? (
            <EmptyState icon={<Store size={22} />} title="No merchants yet" hint="Your most-visited spots will rank here as you spend." />
          ) : (
            <ul className="mt-4 -mx-2 max-h-[22rem] overflow-y-auto">
              {insights.topMerchants.map((m) => (
                <li key={m.name} className="flex items-center gap-3 px-2 py-3 border-t border-white/5 hover:bg-white/[0.02] rounded-lg transition">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-lg shrink-0" aria-hidden>{m.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.name}</p>
                    <p className="text-[11px] text-white/40">{m.count} {m.count === 1 ? "time" : "times"}</p>
                  </div>
                  <span className="num text-sm font-semibold shrink-0"><Money paise={m.amount} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Budgets */}
        <section className="reveal panel p-6 col-span-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Chip><BarChart3 size={10} /> Budgets</Chip>
              <h3 className="font-display text-2xl mt-2">Weekly caps <span className="text-white/40">— {budgets.length}</span></h3>
            </div>
            <button className="btn-ghost text-sm" onClick={openCreate}>
              <Plus size={15} /> Add budget
            </button>
          </div>

          {budgets.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={22} />}
              title="No budgets yet"
              hint="Set a per-category cap and finAI-Buddy will track how much of it you've spent."
              action={<button className="btn-primary text-sm" onClick={openCreate}><Plus size={16} /> Create your first budget</button>}
            />
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {budgets.map((b) => {
                const over = b.pct > 100;
                return (
                  <div key={b.id} className="group rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 card-interactive">
                    <div className="flex items-start gap-3">
                      <span className="h-11 w-11 rounded-lg grid place-items-center text-2xl shrink-0" style={{ background: `${b.color}22`, boxShadow: `inset 0 0 0 1px ${b.color}33` }} aria-hidden>{b.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.category}</p>
                        <p className="num text-[11px] text-white/50 mt-0.5">
                          <Money paise={b.spent} /> <span className="text-white/30">/ <Money paise={b.cap} /></span>
                          <span className="text-white/30"> · {b.period}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                        <button className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-white/60 hover:text-white hover:bg-white/[0.08] transition cursor-pointer" aria-label={`Edit ${b.category}`} onClick={() => openEdit(b)}>
                          <Pencil size={14} />
                        </button>
                        <button className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-white/60 hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 transition cursor-pointer disabled:opacity-50" aria-label={`Delete ${b.category}`} onClick={() => removeBudget(b)} disabled={deletingId === b.id}>
                          {deletingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                    <ProgressBar className="mt-3" pct={b.pct} accent={b.color} complete={b.pct >= 100 && !over} />
                    <p className="num text-[10px] font-mono-tech tracking-wider mt-2" style={{ color: over ? "#FF6B7A" : b.color }}>
                      {b.pct}% USED{over ? " · OVER" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <BudgetModal open={modalOpen} onOpenChange={setModalOpen} budget={editing} />
    </div>
  );
}

function BudgetModal({
  open, onOpenChange, budget,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  budget: BudgetRow | null;
}) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [cap, setCap] = useState("");
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(SWATCHES[0]);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(budget?.category ?? "");
    setCap(budget ? String(toRupees(budget.cap)) : "");
    setIcon(budget?.icon ?? EMOJIS[0]);
    setColor(budget?.color ?? SWATCHES[0]);
    setPeriod(budget?.period === "monthly" ? "monthly" : "weekly");
  }, [open, budget]);

  const submit = async () => {
    const name = category.trim();
    const capNum = Number(cap);
    if (!name) { toast.error("Name the category"); return; }
    if (!Number.isFinite(capNum) || capNum <= 0) { toast.error("Set a cap above ₹0"); return; }
    setBusy(true);
    try {
      const res = budget
        ? await updateBudgetFn({ data: { id: budget.id, category: name, cap: capNum, icon, color } })
        : await createBudgetFn({ data: { category: name, cap: capNum, icon, color, period } });
      if (!res.ok) { toast.error(res.error ?? "Could not save budget"); return; }
      await router.invalidate();
      toast.success(budget ? "Budget updated" : "Budget created");
      onOpenChange(false);
    } catch {
      toast.error("Could not save budget");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={budget ? "Edit budget" : "New budget"}
      description={budget ? "Tune this category's cap, icon or colour." : "Set a spending cap for a category and track it automatically."}
      footer={
        <>
          <button className="btn-ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {budget ? "Save changes" : "Create budget"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Category" htmlFor="budget-category">
          <input
            id="budget-category"
            className="input-field"
            placeholder="e.g. Food, Transport, Fun"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </Field>

        <Field label="Cap (₹)" htmlFor="budget-cap" hint="The amount you don't want to cross this period.">
          <input
            id="budget-cap"
            type="number"
            min={1}
            className="input-field num"
            placeholder="2000"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </Field>

        {!budget && (
          <Field label="Period">
            <div className="flex gap-2">
              {(["weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition cursor-pointer ${period === p ? "border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#00E5FF]" : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Icon">
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                aria-label={`Icon ${e}`}
                className={`h-10 w-10 rounded-lg grid place-items-center text-xl border transition cursor-pointer ${icon === e ? "border-[#00E5FF]/50 bg-[#00E5FF]/10" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <span aria-hidden>{e}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setColor(s)}
                aria-label={`Colour ${s}`}
                className="h-9 w-9 rounded-lg grid place-items-center transition cursor-pointer"
                style={{ background: `${s}22`, boxShadow: `inset 0 0 0 ${color === s ? 2 : 1}px ${s}${color === s ? "" : "55"}` }}
              >
                {color === s && <Check size={15} style={{ color: s }} />}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
