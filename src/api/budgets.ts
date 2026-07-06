import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { toPaise } from "../lib/money";
import { spentThisWeek } from "../lib/finance";

export const listBudgetsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [budgets, txs] = await Promise.all([
    repo.budgets.listByUser(user.id),
    repo.transactions.listByUser(user.id),
  ]);
  return {
    budgets: budgets.map((b) => {
      const spent = spentThisWeek(txs, b.category);
      return { ...b, spent, pct: Math.round((spent / Math.max(1, b.cap)) * 100) };
    }),
  };
});

const createSchema = z.object({
  category: z.string().trim().min(1, "Name the category").max(40),
  cap: z.number().positive("Set a cap").max(10_000_000),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(9).optional(),
  period: z.enum(["weekly", "monthly"]).optional(),
});

export const createBudgetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const budget = {
      id: newId(),
      userId: user.id,
      category: data.category,
      icon: data.icon || "💸",
      color: data.color || "#00E5FF",
      cap: toPaise(data.cap),
      period: data.period || "weekly",
      createdAt: new Date(),
    };
    await repo.budgets.create(budget);
    return { ok: true, budget };
  });

const updateSchema = z.object({
  id: z.string().min(1),
  category: z.string().trim().min(1).max(40).optional(),
  cap: z.number().positive().max(10_000_000).optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(9).optional(),
});

export const updateBudgetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const budget = await repo.budgets.get(data.id);
    if (!budget || budget.userId !== user.id) return { ok: false, error: "Not found" };
    const patch: Record<string, unknown> = {};
    if (data.category !== undefined) patch.category = data.category;
    if (data.cap !== undefined) patch.cap = toPaise(data.cap);
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.color !== undefined) patch.color = data.color;
    const updated = await repo.budgets.update(budget.id, patch);
    return { ok: true, budget: updated };
  });

const deleteSchema = z.object({ id: z.string().min(1) });

export const deleteBudgetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const budget = await repo.budgets.get(data.id);
    if (!budget || budget.userId !== user.id) return { ok: false, error: "Not found" };
    await repo.budgets.remove(budget.id);
    return { ok: true };
  });
