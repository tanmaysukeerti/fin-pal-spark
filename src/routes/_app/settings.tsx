import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User as UserIcon, MapPin, Mail, Save, Loader2, Database, ShieldCheck,
  Wallet, Landmark, Smartphone, LogOut, Zap, Sparkles, PiggyBank, BellRing,
  MailWarning, Play, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { getSettingsFn, updateProfileFn } from "@/api/settings";
import { logoutFn, resendVerificationFn } from "@/api/auth";
import { processAutomationsFn } from "@/api/automations";
import { Money, Chip, PageHeader, EmptyState } from "@/components/app/primitives";
import { Field } from "@/components/app/Modal";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/settings")({
  loader: async () => await getSettingsFn(),
  component: SettingsPage,
});

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** Neon toggle switch used by the (cosmetic) automation preferences. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full shrink-0 transition-colors cursor-pointer",
        checked
          ? "bg-[#00E5FF] shadow-[0_0_12px_#00E5FF80]"
          : "bg-white/10 border border-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200",
          checked ? "right-0.5 bg-[#06060F]" : "left-0.5 bg-white/70",
        )}
      />
    </button>
  );
}

const KIND_META: Record<string, { icon: typeof Wallet; accent: string; label: string }> = {
  bank: { icon: Landmark, accent: "#00E5FF", label: "Bank" },
  upi: { icon: Smartphone, accent: "#00FF9D", label: "UPI" },
  wallet: { icon: Wallet, accent: "#FF8A5B", label: "Wallet" },
};

const AUTOMATIONS = [
  {
    key: "roundups",
    icon: PiggyBank,
    title: "UPI Roundups",
    desc: "Round every spend up to ₹100 and stash the change.",
  },
  {
    key: "allowance",
    icon: Zap,
    title: "Weekly Allowance sync",
    desc: "Auto-pull your allowance into pods each week.",
  },
  {
    key: "limits",
    icon: BellRing,
    title: "Category limit alerts",
    desc: "Ping me when a budget crosses 90% used.",
  },
] as const;

function SettingsPage() {
  const data = Route.useLoaderData() as Awaited<ReturnType<typeof getSettingsFn>>;
  const router = useRouter();
  useReveal();

  const { user, accounts, persistent } = data;

  const [name, setName] = useState(user.name);
  const [city, setCity] = useState(user.city);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resending, setResending] = useState(false);
  const [running, setRunning] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  // Keep local fields in sync if the loader data changes (e.g. after invalidate).
  useEffect(() => {
    setName(user.name);
    setCity(user.city);
  }, [user.name, user.city]);

  // Cosmetic, device-local automation preferences.
  const [autos, setAutos] = useState<Record<string, boolean>>({
    roundups: true,
    allowance: true,
    limits: false,
  });

  const dirty = name.trim() !== user.name || city.trim() !== user.city;

  const saveProfile = async () => {
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfileFn({
        data: { name: name.trim(), city: city.trim() },
      });
      if (res.ok) {
        toast.success("Profile updated");
        await router.invalidate();
      } else {
        toast.error("Could not save your profile.");
      }
    } catch {
      toast.error("Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const res = await resendVerificationFn();
      if (res.ok) {
        toast.success("Verification email sent");
        setDevLink(res.devLink ?? null);
      } else {
        toast.error(res.error ?? "Could not send verification email.");
      }
    } catch {
      toast.error("Could not send verification email. Try again.");
    } finally {
      setResending(false);
    }
  };

  const runAutomations = async () => {
    setRunning(true);
    try {
      const r = await processAutomationsFn();
      if (r.total === 0) {
        toast.success("Nothing due right now");
      } else {
        toast.success(
          `Paid ${r.allowancesPaid} allowance(s), auto-saved into ${r.podsSaved} pod(s)`,
        );
      }
      await router.invalidate();
    } catch {
      toast.error("Could not run automations. Try again.");
    } finally {
      setRunning(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutFn();
      toast.success("Signed out");
      router.navigate({ to: "/login" });
    } catch {
      toast.error("Could not sign out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your profile, linked accounts and how finAI-Buddy automates your money."
        actions={
          persistent ? (
            <Chip className="!text-[#00FF9D] !border-[#00FF9D]/30 !bg-[#00FF9D]/10">
              <ShieldCheck size={11} /> Neon connected
            </Chip>
          ) : (
            <Chip className="!text-[#00E5FF] !border-[#00E5FF]/30 !bg-[#00E5FF]/10">
              <Database size={11} /> Demo mode
            </Chip>
          )
        }
      />

      {/* Email verification banner */}
      {user.emailVerified === false && (
        <section className="reveal panel col-span-12 p-5 !border-[#FF8A5B]/30 bg-[#FF8A5B]/[0.07]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-lg grid place-items-center shrink-0 text-[#FF8A5B]"
                style={{ background: "#FF8A5B1A", boxShadow: "inset 0 0 0 1px #FF8A5B33" }}
                aria-hidden
              >
                <MailWarning size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#FF8A5B]">Verify your email</p>
                <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed break-words">
                  Confirm{" "}
                  <span className="font-mono-tech text-white/80">{user.email}</span>{" "}
                  to secure your account and unlock everything.
                </p>
                {devLink && (
                  <a
                    href={devLink}
                    className="inline-flex items-center gap-1.5 mt-2 text-[12px] text-[#00E5FF] hover:underline break-all"
                  >
                    <ExternalLink size={12} className="shrink-0" /> Open verification link
                  </a>
                )}
              </div>
            </div>
            <button
              className="btn-primary shrink-0"
              onClick={resendVerification}
              disabled={resending}
            >
              {resending ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
              Resend email
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-12 gap-4 xl:gap-5">
        {/* Profile */}
        <section className="reveal panel col-span-12 lg:col-span-7 p-6">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-2xl grid place-items-center font-display text-2xl shrink-0 text-[#00E5FF]"
              style={{ background: "#00E5FF1A", boxShadow: "inset 0 0 0 1px #00E5FF33" }}
              aria-hidden
            >
              {user.avatarInitial}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-2xl leading-tight truncate">{user.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip><Sparkles size={10} className="text-[#00E5FF]" /> Level {user.level}</Chip>
                <Chip className="num">{user.xp.toLocaleString("en-IN")} XP</Chip>
                <span className="text-[11px] text-white/40">
                  Joined {format(new Date(user.createdAt), "MMM yyyy")}
                </span>
              </div>
            </div>
          </div>

          <div className="hairline mt-6 pt-6 space-y-4">
            <Field label="Name" htmlFor="name">
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="name"
                  className="input-field pl-9"
                  value={name}
                  maxLength={60}
                  placeholder="Your name"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </Field>

            <Field label="City" htmlFor="city">
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="city"
                  className="input-field pl-9"
                  value={city}
                  maxLength={40}
                  placeholder="Where you live"
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </Field>

            <Field label="Email" htmlFor="email" hint="Email can't be changed.">
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="email"
                  className="input-field pl-9 opacity-60 cursor-not-allowed"
                  value={user.email}
                  disabled
                />
              </div>
            </Field>

            <div className="flex justify-end pt-1">
              <button
                className="btn-primary"
                onClick={saveProfile}
                disabled={saving || !dirty}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save changes
              </button>
            </div>
          </div>
        </section>

        {/* Linked accounts */}
        <section className="reveal panel col-span-12 lg:col-span-5 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <Chip><Wallet size={10} /> Linked accounts</Chip>
            <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">
              {accounts.filter((a) => a.linked).length} ACTIVE
            </span>
          </div>

          <div className="mt-4 space-y-2.5 max-h-[22rem] overflow-y-auto pr-1 -mr-1">
            {accounts.map((acc) => {
              const meta = KIND_META[acc.kind] ?? KIND_META.bank;
              const Icon = meta.icon;
              return (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5"
                >
                  <div
                    className="h-10 w-10 rounded-lg grid place-items-center shrink-0"
                    style={{ background: `${meta.accent}1F`, boxShadow: `inset 0 0 0 1px ${meta.accent}33` }}
                  >
                    <Icon size={16} style={{ color: meta.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{acc.name}</p>
                      <Chip
                        className="!py-0.5 !px-1.5 !text-[10px]"
                        style={{ color: meta.accent, borderColor: `${meta.accent}40`, background: `${meta.accent}14` }}
                      >
                        {meta.label}
                      </Chip>
                    </div>
                    <p className="num text-[11px] text-white/50 mt-0.5">
                      <Money paise={acc.balance} />
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] shrink-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        acc.linked ? "bg-[#00FF9D] shadow-[0_0_8px_#00FF9D]" : "bg-white/25",
                      )}
                    />
                    <span className={acc.linked ? "text-[#00FF9D]" : "text-white/40"}>
                      {acc.linked ? "Linked" : "Offline"}
                    </span>
                  </span>
                </div>
              );
            })}

            {accounts.length === 0 && (
              <EmptyState
                icon={<Wallet size={22} />}
                title="No linked accounts"
                hint="Connect a bank or UPI wallet to start tracking your money."
              />
            )}
          </div>
        </section>

        {/* Automations */}
        <section className="reveal panel col-span-12 lg:col-span-7 p-6">
          <div className="flex items-center justify-between gap-3">
            <Chip><Zap size={10} className="text-[#00E5FF]" /> Automations</Chip>
            <button
              className="btn-ghost !py-1.5 !px-3 text-[12px]"
              onClick={runAutomations}
              disabled={running}
            >
              {running ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              Run automations now
            </button>
          </div>
          <p className="font-mono-tech text-[10px] text-white/40 tracking-widest mt-2">
            Preferences are saved on this device
          </p>

          <div className="mt-4 divide-y divide-white/5">
            {AUTOMATIONS.map((a) => {
              const Icon = a.icon;
              const on = autos[a.key];
              return (
                <div key={a.key} className="flex items-center gap-3 py-3.5">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center shrink-0">
                    <Icon size={16} className={on ? "text-[#00E5FF]" : "text-white/40"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-[11px] text-white/45 mt-0.5">{a.desc}</p>
                  </div>
                  <Switch
                    label={a.title}
                    checked={on}
                    onChange={(next) => setAutos((prev) => ({ ...prev, [a.key]: next }))}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Data & persistence */}
        <section className="reveal panel col-span-12 lg:col-span-5 p-6">
          <Chip><Database size={10} /> Data &amp; persistence</Chip>

          {persistent ? (
            <div className="mt-4 rounded-xl bg-[#00FF9D]/[0.08] border border-[#00FF9D]/25 p-4">
              <div className="flex items-center gap-2 text-[#00FF9D]">
                <ShieldCheck size={16} />
                <p className="text-sm font-semibold">Connected to Neon Postgres ✓</p>
              </div>
              <p className="text-[12px] text-white/55 mt-2 leading-relaxed">
                Every change is written to your Neon database and survives restarts.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-[#00E5FF]/[0.07] border border-[#00E5FF]/25 p-4">
              <div className="flex items-center gap-2 text-[#00E5FF]">
                <Database size={16} />
                <p className="text-sm font-semibold">Demo mode</p>
              </div>
              <p className="text-[12px] text-white/60 mt-2 leading-relaxed">
                Your data lives in memory and resets whenever the server restarts. To persist it,
                add a Neon <span className="font-mono-tech text-white/80">DATABASE_URL</span> to your{" "}
                <span className="font-mono-tech text-white/80">.env</span> and run:
              </p>
              <pre className="mt-3 rounded-lg bg-black/40 border border-white/[0.06] p-3 overflow-x-auto">
                <code className="font-mono-tech text-[11px] text-[#00E5FF]">
                  npm run db:push &amp;&amp; npm run db:seed
                </code>
              </pre>
            </div>
          )}
        </section>

        {/* Danger / sign out */}
        <section className="reveal panel col-span-12 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-display text-lg">Sign out</p>
              <p className="text-sm text-white/50 mt-1">
                End this session on this device. You can sign back in any time.
              </p>
            </div>
            <button
              className="btn-ghost btn-danger"
              onClick={signOut}
              disabled={signingOut}
            >
              {signingOut ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
