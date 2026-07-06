import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { ledgerEntry, recordEntries } from "./_ledger";
import type { Repo } from "../db/repo";
import type { Account, LedgerEntry } from "../db/schema";

function primaryAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.kind === "upi") ?? accounts[0];
}

/** Most recent past occurrence (<= now) of a given weekday. */
function lastWeekday(dayOfWeek: number, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - dayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export type AutomationRun = { allowancesPaid: number; podsSaved: number; total: number };

/** Apply any due allowances + pod auto-saves for a user. Idempotent via
 *  lastRunAt / lastAutoSaveAt guards, so it's safe to call on every load. */
export async function runDueAutomations(repo: Repo, userId: string): Promise<AutomationRun> {
  const now = new Date();
  const [accounts, allowances, pods] = await Promise.all([
    repo.accounts.listByUser(userId),
    repo.allowances.listByUser(userId),
    repo.pods.listByUser(userId),
  ]);
  const acct = primaryAccount(accounts);
  let balance = acct?.balance ?? 0;
  const entries: LedgerEntry[] = [];
  const run: AutomationRun = { allowancesPaid: 0, podsSaved: 0, total: 0 };

  // 1) Weekly allowances: credit once if a payday has passed since last run.
  for (const a of allowances) {
    if (!a.active) continue;
    const payday = lastWeekday(a.dayOfWeek, now);
    const last = a.lastRunAt ? new Date(a.lastRunAt) : null;
    if (last && last >= payday) continue; // already paid this cycle
    if (acct) {
      balance += a.amount;
      await repo.transactions.create({
        id: newId(), userId, name: "Weekly allowance", category: "Income", icon: "💌",
        amount: a.amount, type: "income", roundupSaved: 0, occurredAt: now, createdAt: now,
      });
      entries.push(ledgerEntry(userId, { amount: a.amount, kind: "allowance", refType: "account", refId: acct.id, memo: `allowance:${a.id}` }));
    }
    await repo.allowances.update(a.id, { lastRunAt: now });
    run.allowancesPaid += 1;
    run.total += a.amount;
  }

  // 2) Pod auto-save: move autoSaveAmount weekly if the wallet can cover it.
  for (const p of pods) {
    if (!p.autoSave || p.status === "complete") continue;
    const last = p.lastAutoSaveAt ? new Date(p.lastAutoSaveAt) : null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (last && now.getTime() - last.getTime() < weekMs) continue;
    const amount = p.autoSaveAmount;
    if (!acct || balance < amount || amount <= 0) {
      await repo.pods.update(p.id, { lastAutoSaveAt: now }); // mark attempt to avoid tight loops
      continue;
    }
    balance -= amount;
    const contribId = newId();
    await repo.podContributions.create({ id: contribId, podId: p.id, userId, amount, source: "allowance", createdAt: now });
    const newSaved = p.savedAmount + amount;
    await repo.pods.update(p.id, { savedAmount: newSaved, status: newSaved >= p.goalAmount ? "complete" : "active", lastAutoSaveAt: now });
    entries.push(ledgerEntry(userId, { amount: -amount, kind: "pod_contribution", refType: "account", refId: acct.id, memo: `contrib:${contribId}` }));
    entries.push(ledgerEntry(userId, { amount, kind: "pod_contribution", refType: "pod", refId: p.id, memo: `contrib:${contribId}` }));
    run.podsSaved += 1;
    run.total += amount;
  }

  if (acct && balance !== acct.balance) await repo.accounts.update(acct.id, { balance });
  await recordEntries(repo, entries);
  return run;
}

/** Manual trigger (Settings page) — run all due automations now. */
export const processAutomationsFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const run = await runDueAutomations(repo, user.id);
  return { ok: true, ...run };
});
