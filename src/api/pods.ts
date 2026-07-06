import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { toPaise } from "../lib/money";
import { podsSaved, sum } from "../lib/finance";
import { ledgerEntry, recordEntries } from "./_ledger";
import type { Account } from "../db/schema";

function primaryAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.kind === "upi") ?? accounts[0];
}

function withPct<T extends { savedAmount: number; goalAmount: number }>(p: T) {
  return { ...p, pct: Math.min(100, Math.round((p.savedAmount / Math.max(1, p.goalAmount)) * 100)) };
}

export const listPodsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [pods, contributions] = await Promise.all([
    repo.pods.listByUser(user.id),
    repo.podContributions.listByUser(user.id),
  ]);
  const recent = [...contributions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);
  return {
    pods: pods.map(withPct).sort((a, b) => b.pct - a.pct),
    recentContributions: recent,
    totalSaved: podsSaved(pods),
    totalCommitted: sum(pods.map((p) => p.goalAmount)),
  };
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Name your pod").max(40),
  emoji: z.string().trim().max(8).optional(),
  accent: z.string().trim().max(9).optional(),
  goal: z.number().positive("Set a goal amount").max(100_000_000),
  autoSave: z.boolean().optional(),
});

export const createPodFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const now = new Date();
    const pod = {
      id: newId(),
      userId: user.id,
      name: data.name,
      emoji: data.emoji || "🎯",
      accent: data.accent || "#00E5FF",
      goalAmount: toPaise(data.goal),
      savedAmount: 0,
      autoSave: data.autoSave ?? false,
      autoSaveAmount: toPaise(50),
      lastAutoSaveAt: null,
      status: "active",
      createdAt: now,
    };
    await repo.pods.create(pod);
    return { ok: true, pod: withPct(pod) };
  });

const contributeSchema = z.object({
  podId: z.string().min(1),
  amount: z.number().positive("Enter an amount").max(10_000_000),
});

export const contributeToPodFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => contributeSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const pod = await repo.pods.get(data.podId);
    if (!pod || pod.userId !== user.id) return { ok: false, error: "Pod not found" };

    const amount = toPaise(data.amount);
    const now = new Date();
    const contribId = newId();
    await repo.podContributions.create({
      id: contribId,
      podId: pod.id,
      userId: user.id,
      amount,
      source: "manual",
      createdAt: now,
    });
    const newSaved = pod.savedAmount + amount;
    const updated = await repo.pods.update(pod.id, {
      savedAmount: newSaved,
      status: newSaved >= pod.goalAmount ? "complete" : "active",
    });

    // Move the money out of the primary account, with matching ledger rows.
    const accounts = await repo.accounts.listByUser(user.id);
    const acct = primaryAccount(accounts);
    if (acct) {
      await repo.accounts.update(acct.id, { balance: acct.balance - amount });
      await recordEntries(repo, [
        ledgerEntry(user.id, { amount: -amount, kind: "pod_contribution", refType: "account", refId: acct.id, memo: `contrib:${contribId}` }),
        ledgerEntry(user.id, { amount, kind: "pod_contribution", refType: "pod", refId: pod.id, memo: `contrib:${contribId}` }),
      ]);
    }

    return { ok: true, pod: updated ? withPct(updated) : null, justCompleted: newSaved >= pod.goalAmount && pod.savedAmount < pod.goalAmount };
  });

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40).optional(),
  emoji: z.string().trim().max(8).optional(),
  accent: z.string().trim().max(9).optional(),
  goal: z.number().positive().max(100_000_000).optional(),
  autoSave: z.boolean().optional(),
});

export const updatePodFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const pod = await repo.pods.get(data.id);
    if (!pod || pod.userId !== user.id) return { ok: false, error: "Pod not found" };
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.emoji !== undefined) patch.emoji = data.emoji;
    if (data.accent !== undefined) patch.accent = data.accent;
    if (data.autoSave !== undefined) patch.autoSave = data.autoSave;
    if (data.goal !== undefined) {
      patch.goalAmount = toPaise(data.goal);
      patch.status = pod.savedAmount >= toPaise(data.goal) ? "complete" : "active";
    }
    const updated = await repo.pods.update(pod.id, patch);
    return { ok: true, pod: updated ? withPct(updated) : null };
  });

const deleteSchema = z.object({ id: z.string().min(1) });

export const deletePodFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const pod = await repo.pods.get(data.id);
    if (!pod || pod.userId !== user.id) return { ok: false, error: "Pod not found" };
    // Return the saved money to the wallet so net worth is preserved.
    if (pod.savedAmount > 0) {
      const accounts = await repo.accounts.listByUser(user.id);
      const acct = primaryAccount(accounts);
      if (acct) await repo.accounts.update(acct.id, { balance: acct.balance + pod.savedAmount });
    }
    await repo.pods.remove(pod.id);
    return { ok: true };
  });
