import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { netWorth, spentThisWeek, sum } from "../lib/finance";

const XP_PER_LEVEL = 500;

export const listRewardsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [achievements, fullUser] = await Promise.all([
    repo.achievements.listByUser(user.id),
    repo.users.get(user.id),
  ]);

  const xp = fullUser?.xp ?? user.xp;
  const level = fullUser?.level ?? user.level;
  const xpIntoLevel = xp % XP_PER_LEVEL;

  const sorted = [...achievements].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked) || b.xp - a.xp,
  );

  return {
    achievements: sorted,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    total: achievements.length,
    earnedXp: sum(achievements.filter((a) => a.unlocked).map((a) => a.xp)),
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    levelPct: Math.round((xpIntoLevel / XP_PER_LEVEL) * 100),
  };
});

/** Evaluate achievement conditions against live data and unlock any newly earned. */
export const evaluateAchievementsFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [achievements, pods, contributions, accounts, budgets, txs, fullUser] = await Promise.all([
    repo.achievements.listByUser(user.id),
    repo.pods.listByUser(user.id),
    repo.podContributions.listByUser(user.id),
    repo.accounts.listByUser(user.id),
    repo.budgets.listByUser(user.id),
    repo.transactions.listByUser(user.id),
    repo.users.get(user.id),
  ]);

  const nw = netWorth(accounts, pods);
  const roundups = txs.filter((t) => t.roundupSaved > 0).length;
  const conditions: Record<string, boolean> = {
    "welcome": true,
    "first-pod": pods.length > 0,
    "first-save": contributions.length > 0,
    "roundup-100": roundups >= 100,
    "networth-50k": nw >= 50000 * 100,
    "goal-crusher": pods.some((p) => p.status === "complete"),
    "budget-hero": budgets.length > 0 && budgets.every((b) => spentThisWeek(txs, b.category) <= b.cap),
    "pod-master": pods.length >= 10,
  };

  const newlyUnlocked: string[] = [];
  let gainedXp = 0;
  const now = new Date();
  for (const a of achievements) {
    if (!a.unlocked && conditions[a.key]) {
      await repo.achievements.update(a.id, { unlocked: true, unlockedAt: now });
      newlyUnlocked.push(a.label);
      gainedXp += a.xp;
    }
  }

  if (gainedXp > 0 && fullUser) {
    const newXp = fullUser.xp + gainedXp;
    await repo.users.update(fullUser.id, {
      xp: newXp,
      level: Math.max(fullUser.level, Math.floor(newXp / XP_PER_LEVEL) + 1),
    });
  }

  return { ok: true, newlyUnlocked, gainedXp };
});
