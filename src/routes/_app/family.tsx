import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Plus,
  ShieldCheck,
  ShieldOff,
  CalendarDays,
  Wallet,
  CheckCircle2,
  Trash2,
  Loader2,
  Pencil,
  Gift,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  getFamilyFn,
  addFamilyMemberFn,
  toggleControlsFn,
  setAllowanceFn,
  addChoreFn,
  completeChoreFn,
  deleteChoreFn,
} from "@/api/family";
import { Money, Chip, PageHeader, StatTile, EmptyState } from "@/components/app/primitives";
import { Modal, Field } from "@/components/app/Modal";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/money";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRADIENTS: [string, string][] = [
  ["#00E5FF", "#7C5CFF"],
  ["#00FF9D", "#00E5FF"],
  ["#FF8A5B", "#FF6B7A"],
  ["#7C5CFF", "#FF6B7A"],
  ["#00E5FF", "#00FF9D"],
  ["#FF6B7A", "#FF8A5B"],
];

export const Route = createFileRoute("/_app/family")({
  loader: async () => await getFamilyFn(),
  component: FamilyPage,
});

/** Reveal-on-scroll for .reveal panels (mirrors the dashboard). */
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

/** Neon on/off switch. */
function Switch({
  on,
  busy = false,
  onClick,
}: {
  on: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full cursor-pointer transition disabled:opacity-60",
        on ? "bg-[#00E5FF] shadow-[0_0_12px_#00E5FF80]" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full grid place-items-center transition-all",
          on ? "right-0.5 bg-[#06060F]" : "left-0.5 bg-white/70",
        )}
      >
        {busy && <Loader2 size={11} className="animate-spin text-[#00E5FF]" />}
      </span>
    </button>
  );
}

function FamilyPage() {
  const data = Route.useLoaderData() as Awaited<ReturnType<typeof getFamilyFn>>;
  const router = useRouter();
  useReveal();

  const allowance = data.allowances[0];

  // Mirror chores into local state so "Mark done" can update optimistically.
  // The effect re-syncs to server truth after every loader invalidation.
  const [chores, setChores] = useState(data.chores);
  useEffect(() => {
    setChores(data.chores);
  }, [data.chores]);

  const pendingChores = chores.filter((c) => c.status === "pending");
  const completedChores = chores.filter((c) => c.status === "completed");
  const choreRewardsEarned = completedChores.reduce((s, c) => s + c.reward, 0);
  const choreRewardsAvailable = pendingChores.reduce((s, c) => s + c.reward, 0);

  // ---- Add member modal ----
  const [memberOpen, setMemberOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mRelation, setMRelation] = useState("");
  const [mInitial, setMInitial] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);

  // ---- Allowance modal ----
  const [allowOpen, setAllowOpen] = useState(false);
  const [aAmount, setAAmount] = useState("");
  const [aDay, setADay] = useState(1);
  const [aFreq, setAFreq] = useState<"weekly" | "monthly">("weekly");
  const [aFrom, setAFrom] = useState("");
  const [aActive, setAActive] = useState(true);
  const [allowBusy, setAllowBusy] = useState(false);

  // ---- Add chore modal ----
  const [choreOpen, setChoreOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cReward, setCReward] = useState("");
  const [cIcon, setCIcon] = useState("🧹");
  const [cDue, setCDue] = useState("");
  const [choreBusy, setChoreBusy] = useState(false);

  // Row-level busy id (toggles / chore actions — one at a time).
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const submitMember = async () => {
    if (!mName.trim() || !mRelation.trim()) {
      toast.error("Name and relation are required");
      return;
    }
    setMemberBusy(true);
    try {
      await addFamilyMemberFn({
        data: {
          name: mName.trim(),
          relation: mRelation.trim(),
          avatarInitial: mInitial.trim() || undefined,
        },
      });
      toast.success(`${mName.trim()} joined the circle`);
      setMemberOpen(false);
      setMName("");
      setMRelation("");
      setMInitial("");
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add member");
    } finally {
      setMemberBusy(false);
    }
  };

  const toggleControls = async (m: { id: string; name: string; controlsActive: boolean }) => {
    setRowBusyId(m.id);
    const next = !m.controlsActive;
    try {
      const res = await toggleControlsFn({ data: { id: m.id, active: next } });
      if (!res.ok) {
        toast.error(res.error ?? "Could not update controls");
        return;
      }
      toast.success(`Controls ${next ? "enabled" : "paused"} for ${m.name}`);
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update controls");
    } finally {
      setRowBusyId(null);
    }
  };

  const openAllowance = () => {
    if (allowance) {
      setAAmount(String(allowance.amount / 100));
      setADay(allowance.dayOfWeek);
      setAFreq(allowance.frequency === "monthly" ? "monthly" : "weekly");
      setAFrom(allowance.fromMemberId ?? "");
      setAActive(allowance.active);
    } else {
      setAAmount("");
      setADay(1);
      setAFreq("weekly");
      setAFrom("");
      setAActive(true);
    }
    setAllowOpen(true);
  };

  const submitAllowance = async () => {
    const amount = Number(aAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter an allowance amount");
      return;
    }
    setAllowBusy(true);
    try {
      await setAllowanceFn({
        data: {
          amount,
          dayOfWeek: aDay,
          frequency: aFreq,
          fromMemberId: aFrom || undefined,
          active: aActive,
        },
      });
      toast.success("Allowance saved");
      setAllowOpen(false);
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save allowance");
    } finally {
      setAllowBusy(false);
    }
  };

  const submitChore = async () => {
    const reward = Number(cReward);
    if (!cTitle.trim()) {
      toast.error("Describe the chore");
      return;
    }
    if (!reward || reward <= 0) {
      toast.error("Set a reward amount");
      return;
    }
    setChoreBusy(true);
    try {
      await addChoreFn({
        data: {
          title: cTitle.trim(),
          reward,
          icon: cIcon.trim() || undefined,
          dueDate: cDue || undefined,
        },
      });
      toast.success("Chore added");
      setChoreOpen(false);
      setCTitle("");
      setCReward("");
      setCIcon("🧹");
      setCDue("");
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add chore");
    } finally {
      setChoreBusy(false);
    }
  };

  const completeChore = async (c: (typeof data.chores)[number]) => {
    setRowBusyId(c.id);
    // Optimistically move the chore to completed so it flips to the green
    // check + drops out of pending immediately (stat tiles recompute too).
    const completedAt = new Date();
    setChores((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, status: "completed", completedAt } : x)),
    );
    try {
      const res = await completeChoreFn({ data: { id: c.id } });
      if (!res.ok) {
        toast.error(res.error ?? "Could not complete chore");
        await router.invalidate();
        return;
      }
      const returned = "reward" in res ? (res as { reward?: number }).reward : undefined;
      const rewardPaise = typeof returned === "number" ? returned : c.reward;
      toast.success(`Earned ${formatINR(rewardPaise)}!`);
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete chore");
      await router.invalidate();
    } finally {
      setRowBusyId(null);
    }
  };

  const deleteChore = async (c: { id: string }) => {
    setRowBusyId(c.id);
    try {
      const res = await deleteChoreFn({ data: { id: c.id } });
      if (!res.ok) {
        toast.error(res.error ?? "Could not remove chore");
        return;
      }
      toast.success("Chore removed");
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove chore");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Family Hub"
        title="Shared money, together"
        subtitle="Manage members, schedule allowances, and reward chores — all in one neon-lit circle."
        actions={
          <button className="btn-primary" onClick={() => setMemberOpen(true)}>
            <UserPlus size={16} /> Add member
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        {/* Left column: Members + Allowance */}
        <div className="space-y-4 lg:space-y-5">
          {/* Members */}
          <div className="reveal panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Chip>
                  <Users size={10} /> Family Members
                </Chip>
                <h3 className="font-display text-2xl mt-2">Who&apos;s in the circle</h3>
              </div>
              <button className="btn-ghost text-sm" onClick={() => setMemberOpen(true)}>
                <UserPlus size={14} /> Add
              </button>
            </div>

            <div className="mt-5 space-y-2.5">
              {data.members.map((m, i) => {
                const [c1, c2] = GRADIENTS[i % GRADIENTS.length];
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 hover:bg-white/[0.05] transition"
                  >
                    <div
                      className="h-11 w-11 rounded-full grid place-items-center font-display text-lg text-[#06060F] shrink-0"
                      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                      aria-hidden
                    >
                      {m.avatarInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-[11px] text-white/45 capitalize truncate">{m.relation}</p>
                    </div>
                    <span
                      className={cn(
                        "hidden sm:inline-flex items-center gap-1 text-[10px] font-mono-tech uppercase tracking-wider",
                        m.controlsActive ? "text-[#00FF9D]" : "text-white/40",
                      )}
                    >
                      {m.controlsActive ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
                      {m.controlsActive ? "On" : "Off"}
                    </span>
                    <Switch
                      on={m.controlsActive}
                      busy={rowBusyId === m.id}
                      onClick={() => toggleControls(m)}
                    />
                  </div>
                );
              })}

              {data.members.length === 0 && (
                <EmptyState
                  icon={<Users size={22} />}
                  title="No members yet"
                  hint="Add a parent or guardian to enable shared controls and allowances."
                  action={
                    <button className="btn-primary" onClick={() => setMemberOpen(true)}>
                      <UserPlus size={16} /> Add member
                    </button>
                  }
                />
              )}
            </div>
          </div>

          {/* Allowance */}
          <div className="reveal panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Chip>
                  <Wallet size={10} /> Allowance
                </Chip>
                <h3 className="font-display text-2xl mt-2">Pocket money</h3>
              </div>
              {allowance && (
                <button className="btn-ghost text-sm" onClick={openAllowance}>
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>

            {allowance ? (
              <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Money paise={allowance.amount} className="text-3xl font-light" />
                  <span
                    className={cn(
                      "chip",
                      allowance.active
                        ? "!text-[#00FF9D] !border-[#00FF9D]/30 !bg-[#00FF9D]/10"
                        : "!text-white/50",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        allowance.active ? "bg-[#00FF9D]" : "bg-white/40",
                      )}
                    />
                    {allowance.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/45">
                      Schedule
                    </p>
                    <p className="mt-1 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-[#00E5FF]" />
                      {allowance.frequency === "monthly"
                        ? `Monthly · ${DAYS[allowance.dayOfWeek]}`
                        : `Every ${DAYS[allowance.dayOfWeek]}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/45">
                      From
                    </p>
                    <p className="mt-1 truncate">{allowance.fromName ?? "—"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Gift size={22} />}
                title="No allowance set"
                hint="Schedule a weekly or monthly allowance to top up the wallet automatically."
                action={
                  <button className="btn-primary" onClick={openAllowance}>
                    <Plus size={16} /> Set allowance
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Right column: Chores */}
        <div className="reveal panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Chip>
                <Sparkles size={10} /> Chores &amp; Rewards
              </Chip>
              <h3 className="font-display text-2xl mt-2">Earn your keep</h3>
            </div>
            <button className="btn-primary text-sm" onClick={() => setChoreOpen(true)}>
              <Plus size={14} /> Add chore
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatTile
              accent
              label="Earned"
              value={<Money paise={choreRewardsEarned} />}
              sub="paid out"
            />
            <StatTile
              label="Available"
              value={<Money paise={choreRewardsAvailable} />}
              sub="up for grabs"
            />
          </div>

          {/* Pending */}
          <div className="mt-6">
            <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/45">
              Pending · {pendingChores.length}
            </p>
            <div className="mt-3 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {pendingChores.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 hover:bg-white/[0.05] transition"
                >
                  <div
                    className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-lg shrink-0"
                    aria-hidden
                  >
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.title}</p>
                    <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="num text-[#00E5FF] font-semibold">
                        <Money paise={c.reward} />
                      </span>
                      {c.dueDate && (
                        <span className="text-white/35">
                          · due {formatDistanceToNow(new Date(c.dueDate), { addSuffix: true })}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    className="btn-primary !py-1.5 !px-3 text-xs shrink-0"
                    onClick={() => completeChore(c)}
                    disabled={rowBusyId === c.id}
                  >
                    {rowBusyId === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Mark done
                  </button>
                  <button
                    className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-white/50 hover:text-[#FF6B7A] hover:border-[#FF6B7A]/30 transition cursor-pointer disabled:opacity-50"
                    onClick={() => deleteChore(c)}
                    disabled={rowBusyId === c.id}
                    aria-label="Delete chore"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {pendingChores.length === 0 && (
                <EmptyState
                  icon={<Sparkles size={22} />}
                  title="All caught up"
                  hint="No pending chores. Add one to start earning rewards."
                  action={
                    <button className="btn-primary" onClick={() => setChoreOpen(true)}>
                      <Plus size={16} /> Add chore
                    </button>
                  }
                />
              )}
            </div>
          </div>

          {/* Completed */}
          {completedChores.length > 0 && (
            <div className="mt-6 hairline pt-5">
              <p className="text-[10px] font-mono-tech uppercase tracking-widest text-white/45">
                Completed · {completedChores.length}
              </p>
              <div className="mt-3 space-y-2">
                {completedChores.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-1 opacity-70">
                    <CheckCircle2 size={16} className="text-[#00FF9D] shrink-0" />
                    <span className="text-lg shrink-0" aria-hidden>
                      {c.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate line-through decoration-white/20">{c.title}</p>
                      {c.completedAt && (
                        <p className="text-[10px] text-white/35">
                          {format(new Date(c.completedAt), "d MMM yyyy")}
                        </p>
                      )}
                    </div>
                    <span className="num text-sm text-[#00FF9D] shrink-0">
                      +<Money paise={c.reward} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Add member modal ---- */}
      <Modal
        open={memberOpen}
        onOpenChange={setMemberOpen}
        title="Add member"
        description="Add a parent or guardian to your family circle."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setMemberOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={submitMember} disabled={memberBusy}>
              {memberBusy && <Loader2 size={16} className="animate-spin" />} Add member
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="m-name">
            <input
              id="m-name"
              className="input-field"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              maxLength={40}
            />
          </Field>
          <Field label="Relation" htmlFor="m-rel">
            <input
              id="m-rel"
              className="input-field"
              value={mRelation}
              onChange={(e) => setMRelation(e.target.value)}
              placeholder="e.g. Mother"
              maxLength={20}
            />
          </Field>
          <Field
            label="Avatar initial"
            htmlFor="m-init"
            hint="Optional — defaults to the first letter of the name."
          >
            <input
              id="m-init"
              className="input-field"
              value={mInitial}
              onChange={(e) => setMInitial(e.target.value)}
              placeholder="P"
              maxLength={2}
            />
          </Field>
        </div>
      </Modal>

      {/* ---- Allowance modal ---- */}
      <Modal
        open={allowOpen}
        onOpenChange={setAllowOpen}
        title={allowance ? "Edit allowance" : "Set allowance"}
        description="Schedule recurring pocket money into the wallet."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAllowOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={submitAllowance} disabled={allowBusy}>
              {allowBusy && <Loader2 size={16} className="animate-spin" />} Save allowance
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount (₹)" htmlFor="a-amt">
            <input
              id="a-amt"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              className="input-field"
              value={aAmount}
              onChange={(e) => setAAmount(e.target.value)}
              placeholder="500"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequency" htmlFor="a-freq">
              <select
                id="a-freq"
                className="input-field"
                value={aFreq}
                onChange={(e) => setAFreq(e.target.value === "monthly" ? "monthly" : "weekly")}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
            <Field label="Day" htmlFor="a-day">
              <select
                id="a-day"
                className="input-field"
                value={aDay}
                onChange={(e) => setADay(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {data.members.length > 0 && (
            <Field label="From" htmlFor="a-from" hint="Optional — which member funds it.">
              <select
                id="a-from"
                className="input-field"
                value={aFrom}
                onChange={(e) => setAFrom(e.target.value)}
              >
                <option value="">— None —</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div>
              <p className="text-sm">Active</p>
              <p className="text-[11px] text-white/45">Pause to stop auto top-ups.</p>
            </div>
            <Switch on={aActive} onClick={() => setAActive((v) => !v)} />
          </div>
        </div>
      </Modal>

      {/* ---- Add chore modal ---- */}
      <Modal
        open={choreOpen}
        onOpenChange={setChoreOpen}
        title="Add chore"
        description="Set a task and a reward that credits the wallet when it's done."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setChoreOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={submitChore} disabled={choreBusy}>
              {choreBusy && <Loader2 size={16} className="animate-spin" />} Add chore
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="c-title">
            <input
              id="c-title"
              className="input-field"
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              placeholder="e.g. Wash the dishes"
              maxLength={60}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reward (₹)" htmlFor="c-reward">
              <input
                id="c-reward"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                className="input-field"
                value={cReward}
                onChange={(e) => setCReward(e.target.value)}
                placeholder="100"
              />
            </Field>
            <Field label="Emoji" htmlFor="c-icon">
              <input
                id="c-icon"
                className="input-field"
                value={cIcon}
                onChange={(e) => setCIcon(e.target.value)}
                placeholder="🧹"
                maxLength={8}
              />
            </Field>
          </div>
          <Field label="Due date" htmlFor="c-due" hint="Optional.">
            <input
              id="c-due"
              type="date"
              className="input-field"
              value={cDue}
              onChange={(e) => setCDue(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
