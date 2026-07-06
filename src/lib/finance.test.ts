import { describe, it, expect } from "vitest";
import {
  netWorth,
  accountsTotal,
  podsSaved,
  spentInRange,
  spentThisWeek,
  categoryTotals,
  incomeInRange,
  roundupsSaved,
  streakDays,
  weekStart,
  netWorthSeries,
  monthStart,
} from "./finance";
import { toPaise } from "./money";
import type { Account, Pod, Transaction } from "../db/schema";

function acct(balance: number): Account {
  return { id: "a" + balance, userId: "u", name: "W", kind: "upi", balance: toPaise(balance), linked: true, createdAt: new Date() };
}
function pod(saved: number, goal: number): Pod {
  return { id: "p" + saved, userId: "u", name: "P", emoji: "🎯", accent: "#00E5FF", goalAmount: toPaise(goal), savedAmount: toPaise(saved), autoSave: false, autoSaveAmount: 0, lastAutoSaveAt: null, status: "active", createdAt: new Date() };
}
function tx(rupees: number, type: "income" | "expense", daysAgo: number, category = "Food", roundup = 0): Transaction {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { id: "t" + Math.random(), userId: "u", name: "n", category, icon: "🧾", amount: toPaise(rupees), type, roundupSaved: toPaise(roundup), occurredAt: d, createdAt: d };
}

describe("finance calculators", () => {
  it("nets worth from accounts + pods", () => {
    const accounts = [acct(1000), acct(500)];
    const pods = [pod(300, 1000), pod(200, 500)];
    expect(accountsTotal(accounts)).toBe(toPaise(1500));
    expect(podsSaved(pods)).toBe(toPaise(500));
    expect(netWorth(accounts, pods)).toBe(toPaise(2000));
  });

  it("sums only expenses in range and only for a category", () => {
    const txs = [tx(200, "expense", 0, "Food"), tx(100, "expense", 0, "Fun"), tx(1000, "income", 0), tx(999, "expense", 40, "Food")];
    const from = new Date();
    from.setDate(from.getDate() - 7);
    expect(spentInRange(txs, from)).toBe(toPaise(300)); // 200 + 100 (income & 40-days-ago excluded)
    expect(spentInRange(txs, from, "Food")).toBe(toPaise(200));
    expect(incomeInRange(txs, from)).toBe(toPaise(1000));
  });

  it("builds category totals for expenses", () => {
    const txs = [tx(200, "expense", 0, "Food"), tx(50, "expense", 1, "Food"), tx(80, "expense", 0, "Fun"), tx(500, "income", 0)];
    const totals = categoryTotals(txs);
    expect(totals.Food).toBe(toPaise(250));
    expect(totals.Fun).toBe(toPaise(80));
    expect(totals.Income).toBeUndefined();
  });

  it("weekStart returns a Monday at midnight", () => {
    const ws = weekStart(new Date("2026-07-08T15:00:00")); // a Wednesday
    expect(ws.getDay()).toBe(1); // Monday
    expect(ws.getHours()).toBe(0);
  });

  it("counts a consecutive saving streak ending today", () => {
    const today = new Date();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const d2 = new Date(); d2.setDate(d2.getDate() - 2);
    const gap = new Date(); gap.setDate(gap.getDate() - 5);
    expect(streakDays([today, y, d2])).toBe(3);
    expect(streakDays([y, d2])).toBe(2); // today missing → starts from yesterday
    expect(streakDays([today, gap])).toBe(1);
    expect(streakDays([])).toBe(0);
  });

  it("netWorthSeries ends exactly at the ending value", () => {
    const txs = [tx(500, "income", 1), tx(200, "expense", 2)];
    const series = netWorthSeries(txs, 7, toPaise(10000));
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].value).toBe(toPaise(10000));
  });

  it("sums roundups saved this month", () => {
    const txs = [tx(200, "expense", 0, "Food", 18), tx(300, "expense", 1, "Fun", 50)];
    expect(roundupsSaved(txs, monthStart())).toBe(toPaise(68));
  });

  it("spentThisWeek excludes older expenses", () => {
    const txs = [tx(100, "expense", 0), tx(100, "expense", 20)];
    expect(spentThisWeek(txs)).toBe(toPaise(100));
  });
});
