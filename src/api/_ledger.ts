import { newId } from "../lib/id";
import type { Repo } from "../db/repo";
import type { LedgerEntry } from "../db/schema";

export type LedgerKind =
  | "income"
  | "expense"
  | "roundup"
  | "pod_contribution"
  | "pod_refund"
  | "chore_reward"
  | "allowance"
  | "adjustment";

/** Build a full ledger entry. `amount` is the signed delta to the referenced
 *  entity (account or pod); `refType`/`refId` identify that entity; `memo`
 *  carries a `tx:<id>` / `op:<id>` group tag so a set of movements can be
 *  reversed atomically. */
export function ledgerEntry(
  userId: string,
  opts: { amount: number; kind: LedgerKind; refType?: string; refId?: string; memo?: string },
): LedgerEntry {
  return {
    id: newId(),
    userId,
    amount: opts.amount,
    kind: opts.kind,
    refType: opts.refType ?? null,
    refId: opts.refId ?? null,
    memo: opts.memo ?? "",
    createdAt: new Date(),
  };
}

export async function recordEntries(repo: Repo, entries: LedgerEntry[]): Promise<void> {
  for (const e of entries) await repo.ledger.create(e);
}

/** Reverse every ledger movement tagged with `memo` prefix `op` for a user.
 *  Applies the negated delta back to the referenced account/pod, deletes any
 *  linked pod contribution, and writes an `adjustment` audit entry. */
export async function reverseGroup(repo: Repo, userId: string, opTag: string): Promise<void> {
  const all = await repo.ledger.listByUser(userId);
  const group = all.filter((e) => e.memo.startsWith(opTag));
  const now = new Date();
  for (const e of group) {
    if (e.refType === "account" && e.refId) {
      const acct = await repo.accounts.get(e.refId);
      if (acct) await repo.accounts.update(acct.id, { balance: acct.balance - e.amount });
    } else if (e.refType === "pod" && e.refId) {
      const pod = await repo.pods.get(e.refId);
      if (pod) {
        const newSaved = Math.max(0, pod.savedAmount - e.amount);
        await repo.pods.update(pod.id, {
          savedAmount: newSaved,
          status: newSaved >= pod.goalAmount ? "complete" : "active",
        });
      }
      const m = e.memo.match(/contrib:([\w-]+)/);
      if (m) await repo.podContributions.remove(m[1]);
    }
    await repo.ledger.create({
      id: newId(),
      userId,
      amount: -e.amount,
      kind: "adjustment",
      refType: e.refType,
      refId: e.refId,
      memo: `reverse ${opTag}`,
      createdAt: now,
    });
  }
}
