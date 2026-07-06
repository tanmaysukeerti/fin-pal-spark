import { eq, and } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, hasDatabase, type Database } from "./client";
import * as t from "./schema";
import { buildDemoSeed } from "./seed-data";
import type {
  User,
  Session,
  Account,
  Transaction,
  Pod,
  PodContribution,
  Goal,
  Budget,
  Achievement,
  FamilyMember,
  Allowance,
  Chore,
  BuddyMessage,
  LedgerEntry,
  VerificationToken,
} from "./schema";

/** Generic CRUD surface. Business logic lives in the server functions; the repo
 *  only stores/fetches rows, so Neon and in-memory behave identically. */
export interface Table<T extends { id: string }> {
  all(): Promise<T[]>;
  listByUser(userId: string): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(row: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | undefined>;
  remove(id: string): Promise<void>;
}

export interface Repo {
  users: Table<User> & { getByEmail(email: string): Promise<User | undefined> };
  sessions: Table<Session> & { deleteByUser(userId: string): Promise<void> };
  accounts: Table<Account>;
  transactions: Table<Transaction>;
  pods: Table<Pod>;
  podContributions: Table<PodContribution> & { listByPod(podId: string): Promise<PodContribution[]> };
  goals: Table<Goal>;
  budgets: Table<Budget>;
  achievements: Table<Achievement>;
  family: Table<FamilyMember>;
  allowances: Table<Allowance>;
  chores: Table<Chore>;
  buddyMessages: Table<BuddyMessage> & { deleteByUser(userId: string): Promise<void> };
  ledger: Table<LedgerEntry> & { listByRef(refType: string, refId: string): Promise<LedgerEntry[]> };
  verificationTokens: Table<VerificationToken>;
}

/* ------------------------------------------------------------------ */
/* Neon (Drizzle) implementation                                       */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function neonTable<T extends { id: string }>(db: Database, table: any): Table<T> {
  return {
    async all() {
      return (await db.select().from(table as PgTable)) as T[];
    },
    async listByUser(userId: string) {
      return (await db.select().from(table as PgTable).where(eq(table.userId, userId))) as T[];
    },
    async get(id: string) {
      const rows = (await db.select().from(table as PgTable).where(eq(table.id, id)).limit(1)) as T[];
      return rows[0];
    },
    async create(row: T) {
      const rows = (await db.insert(table).values(row).returning()) as T[];
      return rows[0] ?? row;
    },
    async update(id: string, patch: Partial<T>) {
      const rows = (await db.update(table).set(patch).where(eq(table.id, id)).returning()) as T[];
      return rows[0];
    },
    async remove(id: string) {
      await db.delete(table).where(eq(table.id, id));
    },
  };
}

function neonRepo(db: Database): Repo {
  return {
    users: {
      ...neonTable<User>(db, t.users),
      async getByEmail(email: string) {
        const rows = await db.select().from(t.users).where(eq(t.users.email, email.toLowerCase())).limit(1);
        return rows[0];
      },
    },
    sessions: {
      ...neonTable<Session>(db, t.sessions),
      async deleteByUser(userId: string) {
        await db.delete(t.sessions).where(eq(t.sessions.userId, userId));
      },
    },
    accounts: neonTable<Account>(db, t.accounts),
    transactions: neonTable<Transaction>(db, t.transactions),
    pods: neonTable<Pod>(db, t.pods),
    podContributions: {
      ...neonTable<PodContribution>(db, t.podContributions),
      async listByPod(podId: string) {
        return await db.select().from(t.podContributions).where(eq(t.podContributions.podId, podId));
      },
    },
    goals: neonTable<Goal>(db, t.goals),
    budgets: neonTable<Budget>(db, t.budgets),
    achievements: neonTable<Achievement>(db, t.achievements),
    family: neonTable<FamilyMember>(db, t.familyMembers),
    allowances: neonTable<Allowance>(db, t.allowances),
    chores: neonTable<Chore>(db, t.chores),
    buddyMessages: {
      ...neonTable<BuddyMessage>(db, t.buddyMessages),
      async deleteByUser(userId: string) {
        await db.delete(t.buddyMessages).where(eq(t.buddyMessages.userId, userId));
      },
    },
    ledger: {
      ...neonTable<LedgerEntry>(db, t.ledgerEntries),
      async listByRef(refType: string, refId: string) {
        return await db
          .select()
          .from(t.ledgerEntries)
          .where(and(eq(t.ledgerEntries.refType, refType), eq(t.ledgerEntries.refId, refId)));
      },
    },
    verificationTokens: neonTable<VerificationToken>(db, t.verificationTokens),
  };
}

/* ------------------------------------------------------------------ */
/* In-memory implementation (dev fallback, no DATABASE_URL)            */
/* ------------------------------------------------------------------ */

function memTable<T extends { id: string; userId?: string }>(rows: T[]): Table<T> {
  return {
    async all() {
      return rows.map((r) => ({ ...r }));
    },
    async listByUser(userId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.filter((r) => (r as any).userId === userId).map((r) => ({ ...r }));
    },
    async get(id: string) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : undefined;
    },
    async create(row: T) {
      rows.push({ ...row });
      return { ...row };
    },
    async update(id: string, patch: Partial<T>) {
      const r = rows.find((x) => x.id === id);
      if (!r) return undefined;
      Object.assign(r, patch);
      return { ...r };
    },
    async remove(id: string) {
      const i = rows.findIndex((x) => x.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  };
}

type MemStore = {
  users: User[];
  sessions: Session[];
  accounts: Account[];
  transactions: Transaction[];
  pods: Pod[];
  podContributions: PodContribution[];
  goals: Goal[];
  budgets: Budget[];
  achievements: Achievement[];
  family: FamilyMember[];
  allowances: Allowance[];
  chores: Chore[];
  buddyMessages: BuddyMessage[];
  ledger: LedgerEntry[];
  verificationTokens: VerificationToken[];
};

function memoryRepo(store: MemStore): Repo {
  return {
    users: {
      ...memTable<User>(store.users),
      async getByEmail(email: string) {
        const r = store.users.find((u) => u.email === email.toLowerCase());
        return r ? { ...r } : undefined;
      },
    },
    sessions: {
      ...memTable<Session>(store.sessions),
      async deleteByUser(userId: string) {
        store.sessions = store.sessions.filter((s) => s.userId !== userId);
      },
    },
    accounts: memTable<Account>(store.accounts),
    transactions: memTable<Transaction>(store.transactions),
    pods: memTable<Pod>(store.pods),
    podContributions: {
      ...memTable<PodContribution>(store.podContributions),
      async listByPod(podId: string) {
        return store.podContributions.filter((c) => c.podId === podId).map((c) => ({ ...c }));
      },
    },
    goals: memTable<Goal>(store.goals),
    budgets: memTable<Budget>(store.budgets),
    achievements: memTable<Achievement>(store.achievements),
    family: memTable<FamilyMember>(store.family),
    allowances: memTable<Allowance>(store.allowances),
    chores: memTable<Chore>(store.chores),
    buddyMessages: {
      ...memTable<BuddyMessage>(store.buddyMessages),
      async deleteByUser(userId: string) {
        store.buddyMessages = store.buddyMessages.filter((m) => m.userId !== userId);
      },
    },
    ledger: {
      ...memTable<LedgerEntry>(store.ledger),
      async listByRef(refType: string, refId: string) {
        return store.ledger.filter((e) => e.refType === refType && e.refId === refId).map((e) => ({ ...e }));
      },
    },
    verificationTokens: memTable<VerificationToken>(store.verificationTokens),
  };
}

/* ------------------------------------------------------------------ */
/* Singleton resolution                                                */
/* ------------------------------------------------------------------ */

let repoPromise: Promise<Repo> | undefined;

async function buildRepo(): Promise<Repo> {
  const db = getDb();
  if (db) return neonRepo(db);

  // In-memory: seed the demo account so the app works immediately offline.
  const seed = await buildDemoSeed();
  const store: MemStore = {
    users: [seed.user],
    sessions: [],
    accounts: seed.accounts,
    transactions: seed.transactions,
    pods: seed.pods,
    podContributions: seed.contributions,
    goals: seed.goals,
    budgets: seed.budgets,
    achievements: seed.achievements,
    family: seed.family,
    allowances: seed.allowances,
    chores: seed.chores,
    buddyMessages: [],
    ledger: seed.ledger ?? [],
    verificationTokens: [],
  };
  return memoryRepo(store);
}

export async function getRepo(): Promise<Repo> {
  if (!repoPromise) repoPromise = buildRepo();
  return repoPromise;
}

export { hasDatabase };
