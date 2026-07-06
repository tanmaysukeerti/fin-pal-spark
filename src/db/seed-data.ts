import { toPaise } from "../lib/money";
import { hashPassword } from "../lib/auth/password";
import type {
  User,
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
  LedgerEntry,
} from "./schema";

export const DEMO_EMAIL = "demo@finai.app";
export const DEMO_PASSWORD = "demo12345";
export const DEMO_USER_ID = "usr_demo_aarav";

export type SeedBundle = {
  user: User;
  accounts: Account[];
  transactions: Transaction[];
  pods: Pod[];
  contributions: PodContribution[];
  goals: Goal[];
  budgets: Budget[];
  achievements: Achievement[];
  family: FamilyMember[];
  allowances: Allowance[];
  chores: Chore[];
  ledger: LedgerEntry[];
};

function at(daysAgo: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function inDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Build the full demo dataset for the seeded "Aarav Mehta" account. */
export async function buildDemoSeed(): Promise<SeedBundle> {
  const now = new Date();
  const uid = DEMO_USER_ID;

  const user: User = {
    id: uid,
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    name: "Aarav Mehta",
    avatarInitial: "A",
    city: "Mumbai",
    level: 12,
    xp: 2340,
    emailVerified: true,
    onboardedAt: at(120),
    createdAt: at(120),
  };

  const accounts: Account[] = [
    { id: "acc_hdfc", userId: uid, name: "HDFC Savings", kind: "bank", balance: toPaise(14200), linked: true, createdAt: at(120) },
    { id: "acc_sbi", userId: uid, name: "SBI Junior", kind: "bank", balance: toPaise(6300), linked: true, createdAt: at(120) },
    { id: "acc_upi", userId: uid, name: "UPI Wallet", kind: "upi", balance: toPaise(2020.36), linked: true, createdAt: at(120) },
  ];

  // --- Transactions (mix of income + expenses across ~30 days) ---
  const tx = (
    id: string,
    name: string,
    category: string,
    icon: string,
    rupees: number,
    type: "income" | "expense",
    daysAgo: number,
    roundup = 0,
  ): Transaction => ({
    id,
    userId: uid,
    name,
    category,
    icon,
    amount: toPaise(rupees),
    type,
    roundupSaved: toPaise(roundup),
    occurredAt: at(daysAgo),
    createdAt: at(daysAgo),
  });

  const transactions: Transaction[] = [
    // this week (drives weekly budget "spent")
    tx("tx1", "Swiggy · Biryani Night", "Food & Snacks", "🍛", 182, "expense", 0, 18),
    tx("tx2", "Mom · Weekly Allowance", "Income", "💌", 1000, "income", 0),
    tx("tx3", "BookMyShow · Inception", "Fun & Games", "🎬", 350, "expense", 0, 50),
    tx("tx4", "Metro Recharge", "Transport", "🚇", 100, "expense", 1),
    tx("tx5", "Nykaa · Skincare", "Shopping", "🧴", 180, "expense", 2, 20),
    tx("tx6", "Domino's · Cheese Burst", "Food & Snacks", "🍕", 298, "expense", 2, 2),
    tx("tx7", "Steam · Indie Sale", "Fun & Games", "🎮", 470, "expense", 3),
    tx("tx8", "Chai Point", "Food & Snacks", "☕", 60, "expense", 4),
    // last week
    tx("tx9", "Uncle · Birthday Gift", "Income", "🎁", 2100, "income", 6),
    tx("tx10", "Cult.fit Day Pass", "Fun & Games", "🏋️", 240, "expense", 7, 10),
    tx("tx11", "Amazon · USB-C Cable", "Shopping", "🔌", 349, "expense", 8, 51),
    tx("tx12", "Auto to College", "Transport", "🛺", 80, "expense", 9),
    tx("tx13", "McDonald's · McFlurry", "Food & Snacks", "🍦", 120, "expense", 10),
    // earlier
    tx("tx14", "Freelance Logo Design", "Income", "💻", 3500, "income", 14),
    tx("tx15", "Decathlon · Football", "Shopping", "⚽", 899, "expense", 16, 101),
    tx("tx16", "Zomato · Late Night", "Food & Snacks", "🌮", 265, "expense", 20),
    tx("tx17", "Spotify Premium", "Fun & Games", "🎧", 119, "expense", 22),
    tx("tx18", "Uber · Airport", "Transport", "🚕", 420, "expense", 25),
  ];

  // --- Pods ---
  const pod = (
    id: string,
    name: string,
    emoji: string,
    accent: string,
    goal: number,
    saved: number,
    autoSave = false,
  ): Pod => ({
    id,
    userId: uid,
    name,
    emoji,
    accent,
    goalAmount: toPaise(goal),
    savedAmount: toPaise(saved),
    autoSave,
    autoSaveAmount: toPaise(50),
    lastAutoSaveAt: autoSave ? at(3) : null,
    status: saved >= goal ? "complete" : "active",
    createdAt: at(90),
  });

  const pods: Pod[] = [
    pod("pod_ps5", "PlayStation 5", "🎮", "#00E5FF", 54990, 32000, true),
    pod("pod_jordans", "Air Jordans", "👟", "#FFD166", 12500, 9800),
    pod("pod_goa", "Goa Trip 2026", "🏝️", "#B5FFC6", 15000, 4500),
    pod("pod_concert", "Concert Pass", "🎤", "#FFB4D8", 6000, 6000),
    pod("pod_phone", "New Phone", "📱", "#C2B6FF", 25000, 21500, true),
    pod("pod_emergency", "Emergency Fund", "🛡️", "#00FF9D", 10000, 7800),
  ];

  const contribution = (id: string, podId: string, rupees: number, source: string, daysAgo: number): PodContribution => ({
    id,
    podId,
    userId: uid,
    amount: toPaise(rupees),
    source,
    createdAt: at(daysAgo),
  });

  const contributions: PodContribution[] = [
    contribution("c1", "pod_ps5", 500, "manual", 1),
    contribution("c2", "pod_ps5", 18, "roundup", 0),
    contribution("c3", "pod_jordans", 200, "manual", 3),
    contribution("c4", "pod_phone", 1000, "allowance", 5),
    contribution("c5", "pod_emergency", 300, "manual", 7),
    contribution("c6", "pod_concert", 6000, "manual", 30),
  ];

  // --- Goals (longer horizon) ---
  const goals: Goal[] = [
    {
      id: "goal_networth", userId: uid, title: "Reach ₹1L Net Worth", description: "Cross the first lakh milestone by saving consistently.",
      icon: "🏆", targetAmount: toPaise(100000), currentAmount: toPaise(81600), deadline: inDays(180), status: "active", createdAt: at(60),
    },
    {
      id: "goal_monthly", userId: uid, title: "Save ₹4,000 / month", description: "Auto-save from allowance + roundups every month.",
      icon: "📈", targetAmount: toPaise(4000), currentAmount: toPaise(2860), deadline: inDays(20), status: "active", createdAt: at(30),
    },
    {
      id: "goal_college", userId: uid, title: "College Laptop Fund", description: "New laptop before first semester.",
      icon: "💻", targetAmount: toPaise(60000), currentAmount: toPaise(12000), deadline: inDays(300), status: "active", createdAt: at(45),
    },
  ];

  // --- Budgets (weekly caps) ---
  const budgets: Budget[] = [
    { id: "bud_food", userId: uid, category: "Food & Snacks", icon: "🍕", color: "#00E5FF", cap: toPaise(800), period: "weekly", createdAt: at(60) },
    { id: "bud_fun", userId: uid, category: "Fun & Games", icon: "🎮", color: "#FFD166", cap: toPaise(500), period: "weekly", createdAt: at(60) },
    { id: "bud_shop", userId: uid, category: "Shopping", icon: "🛍️", color: "#FFB4D8", cap: toPaise(600), period: "weekly", createdAt: at(60) },
    { id: "bud_transport", userId: uid, category: "Transport", icon: "🛺", color: "#B5FFC6", cap: toPaise(300), period: "weekly", createdAt: at(60) },
  ];

  // --- Achievements ---
  const ach = (key: string, label: string, icon: string, description: string, xp: number, unlocked: boolean, daysAgo?: number): Achievement => ({
    id: `ach_${key}`,
    userId: uid,
    key,
    label,
    icon,
    description,
    xp,
    unlocked,
    unlockedAt: unlocked && daysAgo != null ? at(daysAgo) : null,
    createdAt: at(90),
  });

  const achievements: Achievement[] = [
    ach("streak-30", "30-Day Streak", "Flame", "Saved something 30 days in a row.", 300, true, 2),
    ach("first-pod", "First Pod", "Trophy", "Created your very first savings pod.", 50, true, 88),
    ach("roundup-100", "Roundup 100", "Zap", "Completed 100 UPI roundups.", 150, true, 12),
    ach("ai-whisperer", "AI Whisperer", "Sparkles", "Chatted with Buddy 50 times.", 100, true, 6),
    ach("goal-crusher", "Goal Crusher", "Target", "Completed a full savings pod.", 200, true, 30),
    ach("early-bird", "Early Bird", "Sunrise", "Saved before 9am five times.", 80, true, 15),
    ach("budget-hero", "Budget Hero", "Shield", "Stay under every weekly budget.", 250, false),
    ach("networth-50k", "₹50K Club", "IndianRupee", "Reach ₹50,000 net worth.", 400, false),
    ach("pod-master", "Pod Master", "PiggyBank", "Run 10 pods at once.", 300, false),
    ach("streak-100", "Century Streak", "Flame", "Save 100 days in a row.", 1000, false),
    ach("investor", "First Investment", "TrendingUp", "Start your first SIP.", 500, false),
    ach("referrer", "Squad Builder", "Users", "Invite 3 friends to finAI-Buddy.", 150, false),
  ];

  // --- Family ---
  const family: FamilyMember[] = [
    { id: "fam_priya", userId: uid, name: "Priya Mehta", relation: "Mom", avatarInitial: "P", controlsActive: true, createdAt: at(120) },
    { id: "fam_raj", userId: uid, name: "Raj Mehta", relation: "Dad", avatarInitial: "R", controlsActive: false, createdAt: at(120) },
  ];

  const allowances: Allowance[] = [
    { id: "alw_weekly", userId: uid, fromMemberId: "fam_priya", amount: toPaise(1000), frequency: "weekly", dayOfWeek: 1, active: true, lastRunAt: at(0), createdAt: at(60) },
  ];

  const chores: Chore[] = [
    { id: "chore_math", userId: uid, title: "Math revision", icon: "🧮", reward: toPaise(500), status: "completed", dueDate: at(1), completedAt: at(1), createdAt: at(7) },
    { id: "chore_laundry", userId: uid, title: "Laundry", icon: "🧺", reward: toPaise(150), status: "pending", dueDate: inDays(2), completedAt: null, createdAt: at(2) },
    { id: "chore_dishes", userId: uid, title: "Wash the dishes", icon: "🍽️", reward: toPaise(100), status: "pending", dueDate: inDays(1), completedAt: null, createdAt: at(1) },
    { id: "chore_room", userId: uid, title: "Clean my room", icon: "🧹", reward: toPaise(200), status: "pending", dueDate: inDays(3), completedAt: null, createdAt: at(1) },
  ];

  // --- Ledger (movement log; account/pod-delta semantics so it doubles as the
  //     reversal source). Primary account is the UPI wallet. ---
  const ledger: LedgerEntry[] = [];
  for (const t of transactions) {
    ledger.push({
      id: `led_${t.id}`,
      userId: uid,
      amount: t.type === "income" ? t.amount : -t.amount,
      kind: t.type,
      refType: "account",
      refId: "acc_upi",
      memo: `tx:${t.id} ${t.name}`,
      createdAt: t.occurredAt,
    });
  }
  for (const c of contributions) {
    ledger.push({
      id: `led_${c.id}`,
      userId: uid,
      amount: c.amount,
      kind: "pod_contribution",
      refType: "pod",
      refId: c.podId,
      memo: `contrib:${c.id}`,
      createdAt: c.createdAt,
    });
  }

  return { user, accounts, transactions, pods, contributions, goals, budgets, achievements, family, allowances, chores, ledger };
}

/** Achievement catalogue used to grant achievements to brand-new signups (all locked). */
export function starterAchievements(userId: string): Achievement[] {
  const base = [
    ["welcome", "Welcome Aboard", "Sparkles", "Joined finAI-Buddy.", 50],
    ["first-pod", "First Pod", "Trophy", "Create your first savings pod.", 50],
    ["first-save", "First Save", "PiggyBank", "Make your first contribution.", 50],
    ["streak-7", "7-Day Streak", "Flame", "Save 7 days in a row.", 100],
    ["roundup-100", "Roundup 100", "Zap", "Complete 100 UPI roundups.", 150],
    ["budget-hero", "Budget Hero", "Shield", "Stay under every weekly budget.", 250],
    ["networth-50k", "₹50K Club", "IndianRupee", "Reach ₹50,000 net worth.", 400],
    ["goal-crusher", "Goal Crusher", "Target", "Complete a full savings pod.", 200],
  ] as const;
  const created = new Date();
  return base.map(([key, label, icon, description, xp]) => ({
    id: `ach_${userId}_${key}`,
    userId,
    key,
    label,
    icon,
    description,
    xp,
    unlocked: key === "welcome",
    unlockedAt: key === "welcome" ? created : null,
    createdAt: created,
  }));
}
