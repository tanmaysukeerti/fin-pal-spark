import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { formatINR } from "../lib/money";
import {
  netWorth,
  accountsTotal,
  podsSaved,
  spentThisWeek,
  spentThisMonth,
  incomeInRange,
  categoryTotals,
  streakDays,
  monthStart,
  weekStart,
} from "../lib/finance";
import { hasClaude, claudeReply } from "./_buddy-llm";
import type { Repo } from "../db/repo";
import type { PublicUser } from "../lib/auth/session";

export const listBuddyMessagesFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const messages = await repo.buddyMessages.listByUser(user.id);
  return {
    messages: [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  };
});

const sendSchema = z.object({ content: z.string().trim().min(1).max(500) });

export const sendBuddyMessageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const now = new Date();

    const prior = await repo.buddyMessages.listByUser(user.id);
    const history = [...prior]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }));

    const userMsg = {
      id: newId(),
      userId: user.id,
      role: "user",
      content: data.content,
      createdAt: now,
    };
    await repo.buddyMessages.create(userMsg);

    const reply = await generateReply(data.content, user, repo, history);
    const botMsg = {
      id: newId(),
      userId: user.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(now.getTime() + 1),
    };
    await repo.buddyMessages.create(botMsg);

    return { ok: true, userMessage: userMsg, reply: botMsg };
  });

export const clearBuddyMessagesFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  await repo.buddyMessages.deleteByUser(user.id);
  return { ok: true };
});

/* --------------------------------------------------------------- */
/* Local data-driven responder — no API key required.              */
/* --------------------------------------------------------------- */

const firstName = (u: PublicUser) => u.name.split(" ")[0];

async function generateReply(
  raw: string,
  user: PublicUser,
  repo: Repo,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  const q = raw.toLowerCase();
  const [txs, pods, accounts, budgets, contributions, goals] = await Promise.all([
    repo.transactions.listByUser(user.id),
    repo.pods.listByUser(user.id),
    repo.accounts.listByUser(user.id),
    repo.budgets.listByUser(user.id),
    repo.podContributions.listByUser(user.id),
    repo.goals.listByUser(user.id),
  ]);

  // Intent: "save ₹100" / "put 200 into savings" — actually perform it.
  const saveMatch = q.match(/(?:save|put|add|stash|move)\D*(\d[\d,]*)/);
  if (saveMatch && /save|stash|pod|saving|put|move|add/.test(q)) {
    const rupees = parseInt(saveMatch[1].replace(/,/g, ""), 10);
    if (rupees > 0) {
      const target = [...pods]
        .filter((p) => p.status === "active")
        .sort((a, b) => b.savedAmount / Math.max(1, b.goalAmount) - a.savedAmount / Math.max(1, a.goalAmount))[0];
      if (!target) {
        return `You don't have an active pod yet, ${firstName(user)}. Create one on the Savings Pods page and I'll start funnelling money in for you. 🎯`;
      }
      const amount = rupees * 100;
      await repo.podContributions.create({
        id: newId(), podId: target.id, userId: user.id, amount, source: "manual", createdAt: new Date(),
      });
      const newSaved = target.savedAmount + amount;
      await repo.pods.update(target.id, {
        savedAmount: newSaved,
        status: newSaved >= target.goalAmount ? "complete" : "active",
      });
      const acct = accounts.find((a) => a.kind === "upi") ?? accounts[0];
      if (acct) await repo.accounts.update(acct.id, { balance: acct.balance - amount });
      const pct = Math.min(100, Math.round((newSaved / target.goalAmount) * 100));
      const done = newSaved >= target.goalAmount;
      return done
        ? `Done! ${formatINR(amount)} moved into ${target.emoji} ${target.name} — and that completes the pod! 🏆 Goal unlocked, ${firstName(user)}.`
        : `Done! ${formatINR(amount)} moved into ${target.emoji} ${target.name}. It's now at ${pct}% (${formatINR(newSaved)} / ${formatINR(target.goalAmount)}). Keep it up! ✨`;
    }
  }

  // If a Claude key is configured, let Claude handle open-ended chat (grounded
  // in a live financial snapshot). Falls through to the local responder on
  // any error/refusal so the app never breaks.
  if (hasClaude()) {
    const nw = netWorth(accounts, pods);
    const over = budgets
      .map((b) => ({ b, spent: spentThisWeek(txs, b.category) }))
      .filter((x) => x.spent > x.b.cap);
    const streak = streakDays([
      ...txs.filter((t) => t.roundupSaved > 0).map((t) => t.occurredAt),
      ...contributions.map((c) => c.createdAt),
    ]);
    const snapshot = [
      `Net worth: ${formatINR(nw)} (accounts ${formatINR(accountsTotal(accounts))}, pods ${formatINR(podsSaved(pods))}).`,
      `Spent this week: ${formatINR(spentThisWeek(txs))}; this month: ${formatINR(spentThisMonth(txs))}; earned this month: ${formatINR(incomeInRange(txs, monthStart()))}.`,
      `Saving streak: ${streak} days.`,
      `Pods: ${pods.map((p) => `${p.name} ${Math.round((p.savedAmount / Math.max(1, p.goalAmount)) * 100)}%`).join(", ") || "none"}.`,
      `Budgets over cap this week: ${over.map((o) => `${o.b.category} (${formatINR(o.spent)}/${formatINR(o.b.cap)})`).join(", ") || "none"}.`,
      `Goals: ${goals.map((g) => `${g.title} ${Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100)}%`).join(", ") || "none"}.`,
    ].join("\n");
    const ai = await claudeReply({ user, snapshot, history, message: raw });
    if (ai) return ai;
  }

  // Intent: overspending
  if (/overspend|over budget|too much|spending|where.*money|where.*go/.test(q)) {
    const totals = categoryTotals(txs, monthStart());
    const overBudget = budgets
      .map((b) => ({ b, spent: spentThisWeek(txs, b.category) }))
      .filter((x) => x.spent > x.b.cap)
      .sort((a, b) => b.spent - b.b.cap - (a.spent - a.b.cap));
    if (overBudget.length) {
      const top = overBudget[0];
      return `Heads up ${firstName(user)} — you're over budget on ${top.b.icon} ${top.b.category}: ${formatINR(top.spent)} spent vs a ${formatINR(top.b.cap)} weekly cap. Want me to lock that category for the rest of the week?`;
    }
    const topCat = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      return `Good news — you're inside every weekly budget! Your biggest category this month is ${topCat[0]} at ${formatINR(topCat[1])}. You're doing great. 💪`;
    }
    return `No spending logged yet this month, ${firstName(user)}. Add a transaction and I'll break it down for you.`;
  }

  // Intent: net worth / balance
  if (/net worth|networth|balance|how much.*have|total|rich/.test(q)) {
    const nw = netWorth(accounts, pods);
    return `Your net worth is ${formatINR(nw)} 💎 — ${formatINR(accountsTotal(accounts))} in accounts and ${formatINR(podsSaved(pods))} tucked into pods. Steady climb, ${firstName(user)}!`;
  }

  // Intent: pods / goals
  if (/pod|goal|saving|target/.test(q)) {
    if (!pods.length && !goals.length) return `You haven't set up any pods or goals yet. Want to start one? Head to Savings Pods.`;
    const closest = [...pods].filter((p) => p.status === "active").sort((a, b) => b.savedAmount / Math.max(1, b.goalAmount) - a.savedAmount / Math.max(1, a.goalAmount))[0];
    const complete = pods.filter((p) => p.status === "complete").length;
    if (closest) {
      const pct = Math.round((closest.savedAmount / closest.goalAmount) * 100);
      return `You've got ${pods.length} pods (${complete} completed 🏆). Closest to done: ${closest.emoji} ${closest.name} at ${pct}% — only ${formatINR(closest.goalAmount - closest.savedAmount)} to go!`;
    }
    return `All ${pods.length} of your pods are complete — legend! Time to dream up a new one?`;
  }

  // Intent: streak
  if (/streak|days|habit|consisten/.test(q)) {
    const dates = [...txs.filter((t) => t.roundupSaved > 0).map((t) => t.occurredAt), ...contributions.map((c) => c.createdAt)];
    const streak = streakDays(dates);
    return `You're on a ${streak}-day saving streak 🔥 Don't break the chain — even ₹10 today keeps it alive!`;
  }

  // Intent: this week / summary
  if (/week|summary|recap|how.*doing|report/.test(q)) {
    const ws = weekStart();
    const spent = spentThisWeek(txs);
    const earned = incomeInRange(txs, ws);
    const saved = txs.filter((t) => new Date(t.occurredAt) >= ws).reduce((s, t) => s + t.roundupSaved, 0);
    return `This week: earned ${formatINR(earned)}, spent ${formatINR(spent)}, auto-saved ${formatINR(saved)} in roundups. Net ${formatINR(earned - spent)}. ${earned - spent >= 0 ? "In the green — nice! 🟢" : "A little tight — want a savings tip? 🟡"}`;
  }

  // Intent: month
  if (/month|budget/.test(q)) {
    const spent = spentThisMonth(txs);
    const earned = incomeInRange(txs, monthStart());
    return `So far this month you've earned ${formatINR(earned)} and spent ${formatINR(spent)}. That's a ${earned > 0 ? Math.round(((earned - spent) / earned) * 100) : 0}% savings rate. Aim for 20%+ and you'll hit your goals faster!`;
  }

  // Greeting / help / fallback
  if (/^(hi|hey|hello|yo|sup|namaste)/.test(q) || /help|what can you|who are you/.test(q)) {
    return `Hey ${firstName(user)}! I'm Buddy 🤖 I can check your net worth, find where you're overspending, move money into pods ("save ₹100"), track your streak, or recap your week. What do you want to know?`;
  }

  const nw = netWorth(accounts, pods);
  return `Got it! Here's a quick snapshot, ${firstName(user)}: net worth ${formatINR(nw)}, ${pods.filter((p) => p.status === "active").length} active pods, and ${formatINR(spentThisWeek(txs))} spent this week. Try asking "where am I overspending?" or "save ₹100". ✨`;
}
