import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import {
  categoryTotals,
  dailyExpenseSeries,
  incomeInRange,
  spentInRange,
  monthStart,
  roundupsSaved,
  sum,
  isExpense,
  isIncome,
} from "../lib/finance";

const FALLBACK_COLORS = ["#00E5FF", "#FFD166", "#FFB4D8", "#B5FFC6", "#C2B6FF", "#FF8A5B", "#00FF9D"];

export const getInsightsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [txs, budgets, pods] = await Promise.all([
    repo.transactions.listByUser(user.id),
    repo.budgets.listByUser(user.id),
    repo.pods.listByUser(user.id),
  ]);

  const ms = monthStart();
  const budgetByCat = new Map(budgets.map((b) => [b.category, b]));

  // Category breakdown (this month, expenses)
  const totals = categoryTotals(txs, ms);
  const totalSpend = sum(Object.values(totals));
  const categoryBreakdown = Object.entries(totals)
    .map(([category, amount], i) => {
      const b = budgetByCat.get(category);
      return {
        category,
        amount,
        icon: b?.icon ?? "💸",
        color: b?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        pct: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
        cap: b?.cap ?? null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Daily spend, last 14 days
  const dailySpend = dailyExpenseSeries(txs, 14);

  // Income vs expense — current month + previous month
  const prevMonthStart = new Date(ms.getFullYear(), ms.getMonth() - 1, 1);
  const thisIncome = incomeInRange(txs, ms);
  const thisExpense = spentInRange(txs, ms);
  const prevIncome = sum(
    txs.filter((t) => isIncome(t) && new Date(t.occurredAt) >= prevMonthStart && new Date(t.occurredAt) < ms).map((t) => t.amount),
  );
  const prevExpense = sum(
    txs.filter((t) => isExpense(t) && new Date(t.occurredAt) >= prevMonthStart && new Date(t.occurredAt) < ms).map((t) => t.amount),
  );

  // 6-month trend
  const monthlyTrend: Array<{ label: string; income: number; expense: number }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const income = sum(
      txs.filter((t) => isIncome(t) && new Date(t.occurredAt) >= start && new Date(t.occurredAt) < end).map((t) => t.amount),
    );
    const expense = sum(
      txs.filter((t) => isExpense(t) && new Date(t.occurredAt) >= start && new Date(t.occurredAt) < end).map((t) => t.amount),
    );
    monthlyTrend.push({ label: start.toLocaleString("en-IN", { month: "short" }), income, expense });
  }

  // Top merchants (expenses, all time)
  const merchantMap = new Map<string, { name: string; icon: string; amount: number; count: number }>();
  for (const t of txs) {
    if (!isExpense(t)) continue;
    const key = t.name;
    const cur = merchantMap.get(key) ?? { name: t.name, icon: t.icon, amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    merchantMap.set(key, cur);
  }
  const topMerchants = Array.from(merchantMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);

  const budgetHealth = budgets.map((b) => {
    const spent = spentInRange(txs, ms, b.category);
    return { ...b, spent, pct: Math.round((spent / Math.max(1, b.cap)) * 100) };
  });

  const savingsRate = thisIncome > 0 ? Math.round(((thisIncome - thisExpense) / thisIncome) * 100) : 0;

  return {
    categoryBreakdown,
    dailySpend,
    incomeVsExpense: {
      income: thisIncome,
      expense: thisExpense,
      net: thisIncome - thisExpense,
      prevIncome,
      prevExpense,
    },
    monthlyTrend,
    topMerchants,
    budgetHealth,
    savingsRate,
    monthSaved: roundupsSaved(txs, ms),
    totalRoundupSaved: roundupsSaved(txs),
    podsCount: pods.length,
  };
});
