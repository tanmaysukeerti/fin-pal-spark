import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { toPaise } from "../lib/money";

function withPct<T extends { currentAmount: number; targetAmount: number }>(g: T) {
  return { ...g, pct: Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100)) };
}

export const listGoalsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const goals = await repo.goals.listByUser(user.id);
  return {
    goals: goals
      .map(withPct)
      .sort((a, b) => (a.status === "complete" ? 1 : 0) - (b.status === "complete" ? 1 : 0) || b.pct - a.pct),
  };
});

const createSchema = z.object({
  title: z.string().trim().min(1, "Name your goal").max(60),
  description: z.string().trim().max(200).optional(),
  icon: z.string().trim().max(8).optional(),
  target: z.number().positive("Set a target").max(1_000_000_000),
  deadline: z.string().optional(), // ISO date
});

export const createGoalFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const now = new Date();
    const goal = {
      id: newId(),
      userId: user.id,
      title: data.title,
      description: data.description ?? "",
      icon: data.icon || "🎯",
      targetAmount: toPaise(data.target),
      currentAmount: 0,
      deadline: data.deadline ? new Date(data.deadline) : null,
      status: "active",
      createdAt: now,
    };
    await repo.goals.create(goal);
    return { ok: true, goal: withPct(goal) };
  });

const progressSchema = z.object({
  id: z.string().min(1),
  amount: z.number().max(1_000_000_000),
});

/** Log progress toward a goal (tracker only — does not move wallet money). */
export const logGoalProgressFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => progressSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const goal = await repo.goals.get(data.id);
    if (!goal || goal.userId !== user.id) return { ok: false, error: "Goal not found" };
    const current = Math.max(0, goal.currentAmount + toPaise(data.amount));
    const updated = await repo.goals.update(goal.id, {
      currentAmount: current,
      status: current >= goal.targetAmount ? "complete" : "active",
    });
    return { ok: true, goal: updated ? withPct(updated) : null };
  });

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  icon: z.string().trim().max(8).optional(),
  target: z.number().positive().max(1_000_000_000).optional(),
  deadline: z.string().nullable().optional(),
});

export const updateGoalFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const goal = await repo.goals.get(data.id);
    if (!goal || goal.userId !== user.id) return { ok: false, error: "Goal not found" };
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.deadline !== undefined) patch.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.target !== undefined) {
      patch.targetAmount = toPaise(data.target);
      patch.status = goal.currentAmount >= toPaise(data.target) ? "complete" : "active";
    }
    const updated = await repo.goals.update(goal.id, patch);
    return { ok: true, goal: updated ? withPct(updated) : null };
  });

const deleteSchema = z.object({ id: z.string().min(1) });

export const deleteGoalFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const goal = await repo.goals.get(data.id);
    if (!goal || goal.userId !== user.id) return { ok: false, error: "Goal not found" };
    await repo.goals.remove(goal.id);
    return { ok: true };
  });
