import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { runDueAutomations } from "./automations";
import {
  netWorth,
  netWorthSeries,
  podsSaved,
  incomeInRange,
  spentInRange,
  spentThisWeek,
  roundupsSaved,
  roundupCount,
  streakDays,
  startOfDay,
  weekStart,
  monthStart,
  sum,
} from "../lib/finance";

/** Everything the Overview dashboard needs, in one request. */
export const getDashboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();

  // Apply any due allowances / pod auto-saves before reading the snapshot.
  await runDueAutomations(repo, user.id).catch(() => {});

  const [accounts, txs, pods, budgets, goals, contributions, achievements, allowances, chores] =
    await Promise.all([
      repo.accounts.listByUser(user.id),
      repo.transactions.listByUser(user.id),
      repo.pods.listByUser(user.id),
      repo.budgets.listByUser(user.id),
      repo.goals.listByUser(user.id),
      repo.podContributions.listByUser(user.id),
      repo.achievements.listByUser(user.id),
      repo.allowances.listByUser(user.id),
      repo.chores.listByUser(user.id),
    ]);

  const nw = netWorth(accounts, pods);
  const ws = weekStart();
  const ms = monthStart();

  const weekChange = incomeInRange(txs, ws) - spentInRange(txs, ws);
  const lastWeekBase = Math.max(1, nw - weekChange);
  const weekChangePct = (weekChange / lastWeekBase) * 100;

  const sortedTx = [...txs].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const podsWithPct = pods
    .map((p) => ({
      ...p,
      pct: Math.min(100, Math.round((p.savedAmount / Math.max(1, p.goalAmount)) * 100)),
    }))
    .sort((a, b) => b.pct - a.pct);

  const budgetsWithSpent = budgets.map((b) => {
    const spent = spentThisWeek(txs, b.category);
    return { ...b, spent, pct: Math.min(999, Math.round((spent / Math.max(1, b.cap)) * 100)) };
  });

  // Saving events (roundups + contributions) → streak + 49-day heatmap.
  const savingDates: Array<Date | string> = [
    ...txs.filter((t) => t.roundupSaved > 0).map((t) => t.occurredAt),
    ...contributions.map((c) => c.createdAt),
  ];
  const streak = streakDays(savingDates);

  const today = startOfDay(new Date());
  const dayAmount = new Map<number, number>();
  for (const t of txs) if (t.roundupSaved > 0) {
    const k = startOfDay(t.occurredAt).getTime();
    dayAmount.set(k, (dayAmount.get(k) ?? 0) + t.roundupSaved);
  }
  for (const c of contributions) {
    const k = startOfDay(c.createdAt).getTime();
    dayAmount.set(k, (dayAmount.get(k) ?? 0) + c.amount);
  }
  const heatmap: number[] = [];
  const maxDay = Math.max(1, ...Array.from(dayAmount.values()));
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    heatmap.push((dayAmount.get(d.getTime()) ?? 0) / maxDay);
  }

  const activeAllowance = allowances.find((a) => a.active) ?? null;
  const pendingChores = chores.filter((c) => c.status === "pending");
  const completedChores = chores.filter((c) => c.status === "completed");

  return {
    user,
    netWorth: nw,
    weekChange,
    weekChangePct,
    series: netWorthSeries(txs, 30, nw),
    stats: {
      autoSavedThisMonth: roundupsSaved(txs, ms) + sum(
        contributions.filter((c) => new Date(c.createdAt) >= ms).map((c) => c.amount),
      ),
      roundupCount: roundupCount(txs),
      streak,
      podsActive: pods.filter((p) => p.status === "active").length,
      podsNearGoal: podsWithPct.filter((p) => p.pct >= 80 && p.pct < 100).length,
      totalSaved: podsSaved(pods),
      totalCommitted: sum(pods.map((p) => p.goalAmount)),
    },
    pods: podsWithPct,
    recentTx: sortedTx.slice(0, 6),
    budgets: budgetsWithSpent,
    heatmap,
    goals: goals.map((g) => ({
      ...g,
      pct: Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100)),
    })),
    achievements: {
      unlocked: achievements.filter((a) => a.unlocked).length,
      total: achievements.length,
      recent: achievements.slice(0, 6),
    },
    family: {
      allowance: activeAllowance,
      pendingChores,
      completedChores,
    },
  };
});
