import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { toPaise } from "../lib/money";
import { sum } from "../lib/finance";
import { ledgerEntry, recordEntries } from "./_ledger";
import type { Account } from "../db/schema";

function primaryAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.kind === "upi") ?? accounts[0];
}

export const getFamilyFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [members, allowances, chores] = await Promise.all([
    repo.family.listByUser(user.id),
    repo.allowances.listByUser(user.id),
    repo.chores.listByUser(user.id),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  return {
    members,
    allowances: allowances.map((a) => ({ ...a, fromName: a.fromMemberId ? memberById.get(a.fromMemberId)?.name ?? null : null })),
    chores: [...chores].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed")),
    pendingChores: chores.filter((c) => c.status === "pending"),
    choreRewardsEarned: sum(chores.filter((c) => c.status === "completed").map((c) => c.reward)),
    choreRewardsAvailable: sum(chores.filter((c) => c.status === "pending").map((c) => c.reward)),
  };
});

const addMemberSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(40),
  relation: z.string().trim().min(1).max(20),
  avatarInitial: z.string().trim().max(2).optional(),
});

export const addFamilyMemberFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => addMemberSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const member = {
      id: newId(),
      userId: user.id,
      name: data.name,
      relation: data.relation,
      avatarInitial: (data.avatarInitial || data.name.charAt(0)).toUpperCase(),
      controlsActive: true,
      createdAt: new Date(),
    };
    await repo.family.create(member);
    return { ok: true, member };
  });

const toggleControlsSchema = z.object({ id: z.string().min(1), active: z.boolean() });

export const toggleControlsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => toggleControlsSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const member = await repo.family.get(data.id);
    if (!member || member.userId !== user.id) return { ok: false, error: "Not found" };
    await repo.family.update(member.id, { controlsActive: data.active });
    return { ok: true };
  });

const allowanceSchema = z.object({
  amount: z.number().positive("Set an amount").max(10_000_000),
  dayOfWeek: z.number().int().min(0).max(6),
  frequency: z.enum(["weekly", "monthly"]).optional(),
  fromMemberId: z.string().optional(),
  active: z.boolean().optional(),
});

export const setAllowanceFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => allowanceSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const existing = (await repo.allowances.listByUser(user.id))[0];
    if (existing) {
      const updated = await repo.allowances.update(existing.id, {
        amount: toPaise(data.amount),
        dayOfWeek: data.dayOfWeek,
        frequency: data.frequency ?? existing.frequency,
        fromMemberId: data.fromMemberId ?? existing.fromMemberId,
        active: data.active ?? existing.active,
      });
      return { ok: true, allowance: updated };
    }
    const allowance = {
      id: newId(),
      userId: user.id,
      fromMemberId: data.fromMemberId ?? null,
      amount: toPaise(data.amount),
      frequency: data.frequency ?? "weekly",
      dayOfWeek: data.dayOfWeek,
      active: data.active ?? true,
      lastRunAt: null,
      createdAt: new Date(),
    };
    await repo.allowances.create(allowance);
    return { ok: true, allowance };
  });

const addChoreSchema = z.object({
  title: z.string().trim().min(1, "Describe the chore").max(60),
  reward: z.number().positive("Set a reward").max(10_000_000),
  icon: z.string().trim().max(8).optional(),
  dueDate: z.string().optional(),
});

export const addChoreFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => addChoreSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const chore = {
      id: newId(),
      userId: user.id,
      title: data.title,
      icon: data.icon || "🧹",
      reward: toPaise(data.reward),
      status: "pending",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedAt: null,
      createdAt: new Date(),
    };
    await repo.chores.create(chore);
    return { ok: true, chore };
  });

const choreIdSchema = z.object({ id: z.string().min(1) });

/** Completing a chore credits the reward to the wallet as income. */
export const completeChoreFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => choreIdSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const chore = await repo.chores.get(data.id);
    if (!chore || chore.userId !== user.id) return { ok: false, error: "Not found" };
    if (chore.status === "completed") return { ok: true, alreadyDone: true };

    const now = new Date();
    await repo.chores.update(chore.id, { status: "completed", completedAt: now });

    const accounts = await repo.accounts.listByUser(user.id);
    const acct = primaryAccount(accounts);
    const txId = newId();
    if (acct) {
      await repo.accounts.update(acct.id, { balance: acct.balance + chore.reward });
      await recordEntries(repo, [
        ledgerEntry(user.id, { amount: chore.reward, kind: "chore_reward", refType: "account", refId: acct.id, memo: `tx:${txId} chore:${chore.id}` }),
      ]);
    }

    await repo.transactions.create({
      id: txId,
      userId: user.id,
      name: `Chore reward · ${chore.title}`,
      category: "Income",
      icon: chore.icon,
      amount: chore.reward,
      type: "income",
      roundupSaved: 0,
      occurredAt: now,
      createdAt: now,
    });
    return { ok: true, reward: chore.reward };
  });

export const deleteChoreFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => choreIdSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const chore = await repo.chores.get(data.id);
    if (!chore || chore.userId !== user.id) return { ok: false, error: "Not found" };
    await repo.chores.remove(chore.id);
    return { ok: true };
  });
