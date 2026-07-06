import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * finAI-Buddy database schema (Neon Postgres via Drizzle).
 *
 * Money is stored as INTEGER PAISE (₹1 = 100 paise) to avoid floating-point
 * rounding errors. Use the helpers in `src/lib/money.ts` to convert/format.
 *
 * All primary keys are text holding a UUID string, generated in the app layer
 * (`newId()`), so the Neon and in-memory repositories produce identical shapes.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarInitial: text("avatar_initial").notNull().default("A"),
  city: text("city").notNull().default("Mumbai"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  emailVerified: boolean("email_verified").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // opaque session token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Linked bank / UPI accounts (SBI, HDFC, wallet). */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("bank"), // bank | upi | wallet
    balance: integer("balance").notNull().default(0), // paise
    linked: boolean("linked").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"),
    icon: text("icon").notNull().default("🧾"),
    amount: integer("amount").notNull(), // paise, always positive magnitude
    type: text("type").notNull().default("expense"), // income | expense
    roundupSaved: integer("roundup_saved").notNull().default(0), // paise
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_idx").on(t.userId),
    index("transactions_occurred_idx").on(t.occurredAt),
  ],
);

/** Savings pods — tactical goal "jars" (PS5, sneakers, trip). */
export const pods = pgTable(
  "pods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎯"),
    accent: text("accent").notNull().default("#00E5FF"),
    goalAmount: integer("goal_amount").notNull(), // paise
    savedAmount: integer("saved_amount").notNull().default(0), // paise
    autoSave: boolean("auto_save").notNull().default(false),
    autoSaveAmount: integer("auto_save_amount").notNull().default(5000), // paise/week when autoSave on (₹50)
    lastAutoSaveAt: timestamp("last_auto_save_at", { withTimezone: true }),
    status: text("status").notNull().default("active"), // active | complete | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pods_user_idx").on(t.userId)],
);

export const podContributions = pgTable(
  "pod_contributions",
  {
    id: text("id").primaryKey(),
    podId: text("pod_id")
      .notNull()
      .references(() => pods.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // paise
    source: text("source").notNull().default("manual"), // manual | roundup | allowance | chore
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pod_contrib_pod_idx").on(t.podId)],
);

/** Longer-horizon financial goals (net-worth target, monthly savings rate). */
export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("🎯"),
    targetAmount: integer("target_amount").notNull(), // paise
    currentAmount: integer("current_amount").notNull().default(0), // paise
    deadline: timestamp("deadline", { withTimezone: true }),
    status: text("status").notNull().default("active"), // active | complete | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

/** Per-category spend budgets (weekly). Spent is computed from transactions. */
export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    icon: text("icon").notNull().default("💸"),
    color: text("color").notNull().default("#00E5FF"),
    cap: integer("cap").notNull(), // paise, per period
    period: text("period").notNull().default("weekly"), // weekly | monthly
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("budgets_user_idx").on(t.userId)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // stable achievement key
    label: text("label").notNull(),
    icon: text("icon").notNull().default("Trophy"), // lucide icon name
    description: text("description").notNull().default(""),
    xp: integer("xp").notNull().default(50),
    unlocked: boolean("unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("achievements_user_idx").on(t.userId)],
);

export const familyMembers = pgTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relation: text("relation").notNull().default("Parent"),
    avatarInitial: text("avatar_initial").notNull().default("P"),
    controlsActive: boolean("controls_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("family_user_idx").on(t.userId)],
);

export const allowances = pgTable(
  "allowances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromMemberId: text("from_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(), // paise
    frequency: text("frequency").notNull().default("weekly"), // weekly | monthly
    dayOfWeek: integer("day_of_week").notNull().default(1), // 0=Sun..6=Sat
    active: boolean("active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("allowances_user_idx").on(t.userId)],
);

export const chores = pgTable(
  "chores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    icon: text("icon").notNull().default("🧹"),
    reward: integer("reward").notNull(), // paise
    status: text("status").notNull().default("pending"), // pending | completed
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chores_user_idx").on(t.userId)],
);

export const buddyMessages = pgTable(
  "buddy_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("buddy_user_idx").on(t.userId)],
);

/** Double-entry-style money ledger — an immutable audit trail of every movement. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // signed paise (+ into net worth, − out)
    kind: text("kind").notNull(), // income | expense | roundup | pod_contribution | pod_refund | chore_reward | allowance | adjustment
    refType: text("ref_type"), // transaction | pod | chore | allowance | goal | import
    refId: text("ref_id"),
    memo: text("memo").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_user_idx").on(t.userId),
    index("ledger_ref_idx").on(t.refType, t.refId),
  ],
);

/** Short-lived tokens for email verification and password reset. */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id").primaryKey(), // opaque token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // verify_email | password_reset
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verif_user_idx").on(t.userId)],
);

// ---- Inferred types (single source of truth for both repos) ----
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Pod = typeof pods.$inferSelect;
export type NewPod = typeof pods.$inferInsert;
export type PodContribution = typeof podContributions.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type Chore = typeof chores.$inferSelect;
export type BuddyMessage = typeof buddyMessages.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
