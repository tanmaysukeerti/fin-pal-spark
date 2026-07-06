import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";
import { newId } from "../lib/id";
import { toPaise, roundupPaise } from "../lib/money";
import { incomeInRange, spentInRange, roundupsSaved, monthStart } from "../lib/finance";
import { ledgerEntry, recordEntries, reverseGroup } from "./_ledger";
import type { Account, Pod, LedgerEntry } from "../db/schema";

function primaryAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.kind === "upi") ?? accounts[0];
}
function roundupTargetPod(pods: Pod[]): Pod | undefined {
  return pods.find((p) => p.status === "active") ?? pods[0];
}

export const listTransactionsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [txs, budgets] = await Promise.all([
    repo.transactions.listByUser(user.id),
    repo.budgets.listByUser(user.id),
  ]);
  const sorted = [...txs].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const ms = monthStart();
  const categories = Array.from(
    new Set(["Income", ...budgets.map((b) => b.category), ...txs.map((t) => t.category), "Other"]),
  );
  return {
    transactions: sorted,
    categories,
    monthIncome: incomeInRange(txs, ms),
    monthExpense: spentInRange(txs, ms),
    monthSaved: roundupsSaved(txs, ms),
  };
});

const addSchema = z.object({
  name: z.string().trim().min(1, "Add a description").max(80),
  category: z.string().trim().min(1).max(40),
  icon: z.string().trim().max(8).optional(),
  amount: z.number().positive("Amount must be positive").max(10_000_000),
  type: z.enum(["income", "expense"]),
  roundup: z.boolean().optional(),
});

export const addTransactionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => addSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const [accounts, pods] = await Promise.all([
      repo.accounts.listByUser(user.id),
      repo.pods.listByUser(user.id),
    ]);

    const amountPaise = toPaise(data.amount);
    const now = new Date();
    const isExpense = data.type === "expense";

    let roundup = 0;
    const target = roundupTargetPod(pods);
    if (isExpense && data.roundup && target) {
      roundup = roundupPaise(amountPaise, 100);
    }

    const txId = newId();
    const tx = {
      id: txId,
      userId: user.id,
      name: data.name,
      category: data.type === "income" ? "Income" : data.category,
      icon: data.icon || (data.type === "income" ? "💰" : "🧾"),
      amount: amountPaise,
      type: data.type,
      roundupSaved: roundup,
      occurredAt: now,
      createdAt: now,
    };
    await repo.transactions.create(tx);

    const acct = primaryAccount(accounts);
    const tag = `tx:${txId}`;
    const entries: LedgerEntry[] = [];

    if (acct) {
      // Combined account movement (principal ± roundup), recorded as component
      // ledger rows so it reverses precisely.
      const acctDelta = isExpense ? -(amountPaise + roundup) : amountPaise;
      await repo.accounts.update(acct.id, { balance: acct.balance + acctDelta });
      entries.push(
        ledgerEntry(user.id, {
          amount: isExpense ? -amountPaise : amountPaise,
          kind: data.type,
          refType: "account",
          refId: acct.id,
          memo: `${tag} ${data.name}`,
        }),
      );
      if (roundup > 0) {
        entries.push(
          ledgerEntry(user.id, { amount: -roundup, kind: "roundup", refType: "account", refId: acct.id, memo: tag }),
        );
      }
    }

    if (roundup > 0 && target) {
      const contribId = newId();
      await repo.podContributions.create({
        id: contribId,
        podId: target.id,
        userId: user.id,
        amount: roundup,
        source: "roundup",
        createdAt: now,
      });
      const newSaved = target.savedAmount + roundup;
      await repo.pods.update(target.id, {
        savedAmount: newSaved,
        status: newSaved >= target.goalAmount ? "complete" : target.status,
      });
      entries.push(
        ledgerEntry(user.id, {
          amount: roundup,
          kind: "pod_contribution",
          refType: "pod",
          refId: target.id,
          memo: `${tag} contrib:${contribId}`,
        }),
      );
    }

    await recordEntries(repo, entries);
    return { ok: true, transaction: tx, roundup };
  });

const deleteSchema = z.object({ id: z.string().min(1) });

export const deleteTransactionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const tx = await repo.transactions.get(data.id);
    if (!tx || tx.userId !== user.id) return { ok: false, error: "Not found" };

    const group = (await repo.ledger.listByUser(user.id)).filter((e) => e.memo.startsWith(`tx:${tx.id}`));
    if (group.length) {
      // Full, precise reversal from the ledger (account + pod + linked contribution).
      await reverseGroup(repo, user.id, `tx:${tx.id}`);
    } else {
      // Legacy transaction with no ledger group — reverse principal only.
      const acct = primaryAccount(await repo.accounts.listByUser(user.id));
      if (acct) {
        const delta = tx.type === "expense" ? tx.amount : -tx.amount;
        await repo.accounts.update(acct.id, { balance: acct.balance + delta });
      }
    }
    await repo.transactions.remove(tx.id);
    return { ok: true };
  });

/* ---- CSV import (bank-statement style) ---- */

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().optional(),
        name: z.string().trim().min(1).max(120),
        category: z.string().trim().max(40).optional(),
        amount: z.number(), // rupees; negative = expense, positive = income
        type: z.enum(["income", "expense"]).optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** Bulk-import transactions from a parsed CSV. Adjusts the primary account and
 *  writes a ledger entry per row (tagged `import:<batch>`). */
export const importTransactionsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const acct = primaryAccount(await repo.accounts.listByUser(user.id));
    const batch = newId();
    let net = 0;
    let imported = 0;
    const entries: LedgerEntry[] = [];

    for (const row of data.rows) {
      const rupees = Math.abs(row.amount);
      if (rupees <= 0) continue;
      const type = row.type ?? (row.amount < 0 ? "expense" : "income");
      const amountPaise = toPaise(rupees);
      const when = row.date ? new Date(row.date) : new Date();
      const occurredAt = isNaN(when.getTime()) ? new Date() : when;
      const txId = newId();
      await repo.transactions.create({
        id: txId,
        userId: user.id,
        name: row.name,
        category: type === "income" ? "Income" : row.category || "Other",
        icon: type === "income" ? "💰" : "🧾",
        amount: amountPaise,
        type,
        roundupSaved: 0,
        occurredAt,
        createdAt: new Date(),
      });
      const delta = type === "income" ? amountPaise : -amountPaise;
      net += delta;
      imported += 1;
      if (acct) {
        entries.push(
          ledgerEntry(user.id, {
            amount: delta,
            kind: type,
            refType: "account",
            refId: acct.id,
            memo: `tx:${txId} import:${batch} ${row.name}`,
          }),
        );
      }
    }

    if (acct && net !== 0) await repo.accounts.update(acct.id, { balance: acct.balance + net });
    await recordEntries(repo, entries);
    return { ok: true, imported, net };
  });
