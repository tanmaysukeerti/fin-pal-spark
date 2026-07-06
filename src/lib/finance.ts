import type { Account, Pod, Transaction } from "../db/schema";

/** Pure finance calculators. All amounts are paise. Date fields are coerced
 *  with `new Date(x)` so they work whether the value is a Date, ISO string, or
 *  epoch number (RPC serialization can turn Dates into strings). */

export const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

export const accountsTotal = (accounts: Account[]): number => sum(accounts.map((a) => a.balance));
export const podsSaved = (pods: Pod[]): number => sum(pods.map((p) => p.savedAmount));
export const netWorth = (accounts: Account[], pods: Pod[]): number =>
  accountsTotal(accounts) + podsSaved(pods);

export function startOfDay(d: Date | string | number): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Monday 00:00 of the current week. */
export function weekStart(d: Date = new Date()): Date {
  const date = startOfDay(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  return date;
}

export function monthStart(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const isExpense = (t: Transaction): boolean => t.type === "expense";
export const isIncome = (t: Transaction): boolean => t.type === "income";

export function spentInRange(txs: Transaction[], from: Date, category?: string): number {
  return sum(
    txs
      .filter(
        (t) =>
          isExpense(t) &&
          new Date(t.occurredAt) >= from &&
          (!category || t.category === category),
      )
      .map((t) => t.amount),
  );
}

export const spentThisWeek = (txs: Transaction[], category?: string): number =>
  spentInRange(txs, weekStart(), category);

export const spentThisMonth = (txs: Transaction[], category?: string): number =>
  spentInRange(txs, monthStart(), category);

export function incomeInRange(txs: Transaction[], from: Date): number {
  return sum(txs.filter((t) => isIncome(t) && new Date(t.occurredAt) >= from).map((t) => t.amount));
}

export function categoryTotals(txs: Transaction[], from?: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (!isExpense(t)) continue;
    if (from && new Date(t.occurredAt) < from) continue;
    out[t.category] = (out[t.category] ?? 0) + t.amount;
  }
  return out;
}

export function roundupsSaved(txs: Transaction[], from?: Date): number {
  return sum(txs.filter((t) => (!from || new Date(t.occurredAt) >= from)).map((t) => t.roundupSaved));
}

export function roundupCount(txs: Transaction[]): number {
  return txs.filter((t) => t.roundupSaved > 0).length;
}

/** Consecutive days (ending today or yesterday) with at least one saving action. */
export function streakDays(eventDates: Array<Date | string | number>): number {
  const daySet = new Set(eventDates.map((d) => startOfDay(d).getTime()));
  let streak = 0;
  const cursor = startOfDay(new Date());
  if (!daySet.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Expense total per day for the last `days` days (oldest → newest). */
export function dailyExpenseSeries(
  txs: Transaction[],
  days: number,
): Array<{ date: string; value: number }> {
  const out: Array<{ date: string; value: number }> = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const value = sum(
      txs
        .filter((t) => isExpense(t) && new Date(t.occurredAt) >= d && new Date(t.occurredAt) < next)
        .map((t) => t.amount),
    );
    out.push({ date: d.toISOString(), value });
  }
  return out;
}

/** Cumulative net (income − expense) per day over the last `days` days,
 *  offset so the final point equals `endingValue` (e.g. current net worth). */
export function netWorthSeries(
  txs: Transaction[],
  days: number,
  endingValue: number,
): Array<{ date: string; value: number }> {
  const today = startOfDay(new Date());
  const daily: Array<{ date: Date; delta: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const inRange = txs.filter((t) => new Date(t.occurredAt) >= d && new Date(t.occurredAt) < next);
    const delta = sum(inRange.map((t) => (isIncome(t) ? t.amount : -t.amount)));
    daily.push({ date: d, delta });
  }
  // Build backwards from the ending value.
  const values: number[] = [];
  let running = endingValue;
  for (let i = daily.length - 1; i >= 0; i--) {
    values[i] = running;
    running -= daily[i].delta;
  }
  return daily.map((d, i) => ({ date: d.date.toISOString(), value: Math.max(0, values[i]) }));
}
