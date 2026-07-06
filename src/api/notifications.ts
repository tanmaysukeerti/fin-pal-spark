import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { formatINR } from "../lib/money";
import { spentThisWeek, streakDays, startOfDay } from "../lib/finance";

export type Notification = {
  id: string;
  icon: string;
  title: string;
  text: string;
  tone: "info" | "success" | "warn";
  to: string;
};

/** Live notifications derived from the user's real data. */
export const getNotificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [pods, budgets, txs, chores, contributions] = await Promise.all([
    repo.pods.listByUser(user.id),
    repo.budgets.listByUser(user.id),
    repo.transactions.listByUser(user.id),
    repo.chores.listByUser(user.id),
    repo.podContributions.listByUser(user.id),
  ]);

  const items: Notification[] = [];

  if (!user.emailVerified) {
    items.push({ id: "verify", icon: "✉️", title: "Verify your email", text: "Confirm your email to secure your account.", tone: "warn", to: "/settings" });
  }

  for (const p of pods) {
    const pct = Math.round((p.savedAmount / Math.max(1, p.goalAmount)) * 100);
    if (p.status === "complete") {
      items.push({ id: `pod-done-${p.id}`, icon: "🏆", title: `${p.name} complete!`, text: `You fully funded ${p.emoji} ${p.name}. Time to cash it in!`, tone: "success", to: "/pods" });
    } else if (pct >= 80) {
      items.push({ id: `pod-near-${p.id}`, icon: p.emoji, title: `${p.name} is ${pct}% funded`, text: `Only ${formatINR(p.goalAmount - p.savedAmount)} to go — so close!`, tone: "info", to: "/pods" });
    }
  }

  for (const b of budgets) {
    const spent = spentThisWeek(txs, b.category);
    if (spent > b.cap) {
      items.push({ id: `bud-${b.id}`, icon: "⚠️", title: `Over budget: ${b.category}`, text: `${formatINR(spent)} spent vs a ${formatINR(b.cap)} weekly cap.`, tone: "warn", to: "/insights" });
    } else if (spent >= b.cap * 0.9) {
      items.push({ id: `bud-near-${b.id}`, icon: b.icon, title: `${b.category} almost maxed`, text: `${Math.round((spent / b.cap) * 100)}% of your weekly cap used.`, tone: "info", to: "/insights" });
    }
  }

  const pendingChores = chores.filter((c) => c.status === "pending");
  if (pendingChores.length) {
    items.push({ id: "chores", icon: "🧹", title: `${pendingChores.length} chore${pendingChores.length > 1 ? "s" : ""} to earn`, text: `Finish them to earn ${formatINR(pendingChores.reduce((s, c) => s + c.reward, 0))}.`, tone: "info", to: "/family" });
  }

  const today = startOfDay(new Date()).getTime();
  const savedToday = [...txs.filter((t) => t.roundupSaved > 0).map((t) => t.occurredAt), ...contributions.map((c) => c.createdAt)].some(
    (d) => startOfDay(d).getTime() === today,
  );
  if (!savedToday) {
    const streak = streakDays([...txs.filter((t) => t.roundupSaved > 0).map((t) => t.occurredAt), ...contributions.map((c) => c.createdAt)]);
    items.push({ id: "streak", icon: "🔥", title: streak > 0 ? "Keep your streak alive" : "Start a streak", text: streak > 0 ? `You're on ${streak} days — save something today.` : "Save something today to start a streak.", tone: "info", to: "/" });
  }

  return { notifications: items.slice(0, 8), count: Math.min(items.length, 8) };
});
