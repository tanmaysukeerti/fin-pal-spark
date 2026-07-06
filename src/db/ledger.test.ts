import { describe, it, expect } from "vitest";
import { getRepo } from "./repo";
import { DEMO_USER_ID } from "./seed-data";
import { reverseGroup, ledgerEntry } from "../api/_ledger";
import { newId } from "../lib/id";

// With no DATABASE_URL set, getRepo() returns the seeded in-memory repo.

describe("in-memory repo CRUD", () => {
  it("creates, lists, updates, and removes rows", async () => {
    const repo = await getRepo();
    const id = newId();
    await repo.transactions.create({
      id, userId: DEMO_USER_ID, name: "Test", category: "Food", icon: "🧪",
      amount: 5000, type: "expense", roundupSaved: 0, occurredAt: new Date(), createdAt: new Date(),
    });
    const got = await repo.transactions.get(id);
    expect(got?.name).toBe("Test");
    await repo.transactions.update(id, { name: "Renamed" });
    expect((await repo.transactions.get(id))?.name).toBe("Renamed");
    await repo.transactions.remove(id);
    expect(await repo.transactions.get(id)).toBeUndefined();
  });
});

describe("ledger reverseGroup", () => {
  it("restores account + pod balances exactly", async () => {
    const repo = await getRepo();
    const uid = DEMO_USER_ID;
    const acct = (await repo.accounts.listByUser(uid)).find((a) => a.kind === "upi")!;
    const pod = (await repo.pods.listByUser(uid))[0];
    const beforeAcct = acct.balance;
    const beforePod = pod.savedAmount;

    // Simulate a wallet→pod transfer of ₹10, recorded with a reversible tag.
    await repo.accounts.update(acct.id, { balance: acct.balance - 1000 });
    await repo.pods.update(pod.id, { savedAmount: pod.savedAmount + 1000 });
    await repo.ledger.create(ledgerEntry(uid, { amount: -1000, kind: "pod_contribution", refType: "account", refId: acct.id, memo: "op:reverse-test" }));
    await repo.ledger.create(ledgerEntry(uid, { amount: 1000, kind: "pod_contribution", refType: "pod", refId: pod.id, memo: "op:reverse-test" }));

    await reverseGroup(repo, uid, "op:reverse-test");

    expect((await repo.accounts.get(acct.id))!.balance).toBe(beforeAcct);
    expect((await repo.pods.get(pod.id))!.savedAmount).toBe(beforePod);
  });

  it("deletes the linked contribution on reversal", async () => {
    const repo = await getRepo();
    const uid = DEMO_USER_ID;
    const pod = (await repo.pods.listByUser(uid))[0];
    const contribId = newId();
    await repo.podContributions.create({ id: contribId, podId: pod.id, userId: uid, amount: 1000, source: "manual", createdAt: new Date() });
    await repo.pods.update(pod.id, { savedAmount: pod.savedAmount + 1000 });
    await repo.ledger.create(ledgerEntry(uid, { amount: 1000, kind: "pod_contribution", refType: "pod", refId: pod.id, memo: `op:del-test contrib:${contribId}` }));

    await reverseGroup(repo, uid, "op:del-test");

    expect(await repo.podContributions.get(contribId)).toBeUndefined();
  });
});
