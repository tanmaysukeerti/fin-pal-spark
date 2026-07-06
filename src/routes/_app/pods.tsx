import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Trophy,
  Zap,
  Check,
  PiggyBank,
  Loader2,
  Sparkles,
  Wallet,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  listPodsFn,
  createPodFn,
  contributeToPodFn,
  updatePodFn,
  deletePodFn,
} from "@/api/pods";
import {
  Money,
  Chip,
  PageHeader,
  StatTile,
  ProgressBar,
  IconTile,
  EmptyState,
} from "@/components/app/primitives";
import { Modal, Field } from "@/components/app/Modal";
import { cn } from "@/lib/utils";

type PodsResult = Awaited<ReturnType<typeof listPodsFn>>;
type PodT = PodsResult["pods"][number];
type ContribT = PodsResult["recentContributions"][number];

const PRESET_ACCENTS = ["#00E5FF", "#FFD166", "#FFB4D8", "#B5FFC6", "#C2B6FF", "#00FF9D"];

const SOURCE_META: Record<string, { emoji: string; label: string }> = {
  manual: { emoji: "💸", label: "Manual" },
  roundup: { emoji: "🪙", label: "Roundup" },
  allowance: { emoji: "🎁", label: "Allowance" },
  chore: { emoji: "🧹", label: "Chore" },
};

export const Route = createFileRoute("/_app/pods")({
  validateSearch: (search: Record<string, unknown>): { create?: true } =>
    search.create === true ||
    search.create === "true" ||
    search.create === 1 ||
    search.create === "1"
      ? { create: true }
      : {},
  loader: async () => await listPodsFn(),
  component: PodsPage,
});

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  accent = "#00E5FF",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full transition cursor-pointer shrink-0"
      style={{
        background: checked ? accent : "rgba(255,255,255,0.12)",
        boxShadow: checked ? `0 0 12px ${accent}80` : "none",
      }}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-[#06060F] transition-all",
          checked ? "right-0.5" : "left-0.5",
        )}
      />
    </button>
  );
}

function AccentPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_ACCENTS.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Accent ${c}`}
            aria-pressed={active}
            className="h-9 w-9 rounded-lg grid place-items-center cursor-pointer transition hover:scale-105"
            style={{
              background: `${c}22`,
              boxShadow: `inset 0 0 0 ${active ? 2 : 1}px ${c}${active ? "" : "55"}`,
            }}
          >
            {active && <Check size={15} style={{ color: c }} />}
          </button>
        );
      })}
    </div>
  );
}

function PodCard({
  pod,
  onAddMoney,
  onEdit,
  onDelete,
}: {
  pod: PodT;
  onAddMoney: (p: PodT) => void;
  onEdit: (p: PodT) => void;
  onDelete: (p: PodT) => void;
}) {
  const complete = pod.pct >= 100;
  return (
    <div className="panel p-5 flex flex-col reveal">
      <div className="flex items-start gap-3">
        <IconTile emoji={pod.emoji} accent={pod.accent} />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{pod.name}</p>
          <p className="num text-xs text-white/50 mt-0.5">
            <Money paise={pod.savedAmount} />{" "}
            <span className="text-white/30">
              / <Money paise={pod.goalAmount} />
            </span>
          </p>
        </div>
        <span
          className={cn(
            "num text-sm font-semibold shrink-0",
            complete ? "text-[#00FF9D]" : "text-white/70",
          )}
        >
          {pod.pct}%
        </span>
      </div>

      <ProgressBar className="mt-4" pct={pod.pct} accent={pod.accent} complete={complete} />

      <div className="mt-3 flex items-center gap-2 flex-wrap min-h-[22px]">
        {complete && (
          <Chip className="!py-0.5 !px-1.5 !bg-[#00FF9D]/15 !border-[#00FF9D]/30 !text-[#00FF9D]">
            <Trophy size={9} /> Unlocked
          </Chip>
        )}
        {pod.autoSave && (
          <Chip className="!py-0.5 !px-1.5 !bg-[#00E5FF]/10 !border-[#00E5FF]/25 !text-[#00E5FF]">
            <Zap size={9} /> Auto-save
          </Chip>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          className="btn-primary flex-1 text-sm justify-center"
          onClick={() => onAddMoney(pod)}
        >
          <Plus size={14} /> Add money
        </button>
        <button
          className="btn-ghost !px-2.5"
          onClick={() => onEdit(pod)}
          aria-label={`Edit ${pod.name}`}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn-ghost btn-danger !px-2.5"
          onClick={() => onDelete(pod)}
          aria-label={`Delete ${pod.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modals                                                            */
/* ------------------------------------------------------------------ */

function CreatePodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [goal, setGoal] = useState("");
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [autoSave, setAutoSave] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset the form whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setName("");
      setEmoji("🎯");
      setGoal("");
      setAccent(PRESET_ACCENTS[0]);
      setAutoSave(false);
    }
  }, [open]);

  const submit = async () => {
    const goalNum = Number(goal);
    if (!name.trim()) return toast.error("Give your pod a name");
    if (!goalNum || goalNum <= 0) return toast.error("Enter a goal amount in ₹");
    setBusy(true);
    try {
      const res = await createPodFn({
        data: {
          name: name.trim(),
          emoji: emoji.trim() || "🎯",
          accent,
          goal: goalNum,
          autoSave,
        },
      });
      if (!res.ok) {
        toast.error("Could not create pod");
        return;
      }
      toast.success(`Pod "${res.pod.name}" created`);
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not create pod. Check your inputs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New pod"
      description="Spin up a savings jar for a goal — a PS5, sneakers, a trip."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Create pod
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <Field label="Emoji" htmlFor="pod-emoji">
            <input
              id="pod-emoji"
              className="input-field w-20 text-center text-xl"
              value={emoji}
              maxLength={8}
              onChange={(e) => setEmoji(e.target.value)}
            />
          </Field>
          <div className="flex-1">
            <Field label="Name" htmlFor="pod-name">
              <input
                id="pod-name"
                className="input-field"
                placeholder="e.g. New sneakers"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
          </div>
        </div>

        <Field label="Goal amount" htmlFor="pod-goal" hint="In rupees — the target for this pod.">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 num">₹</span>
            <input
              id="pod-goal"
              type="number"
              inputMode="decimal"
              min={1}
              className="input-field pl-7 num"
              placeholder="15000"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </Field>

        <Field label="Accent">
          <AccentPicker value={accent} onChange={setAccent} />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
          <div>
            <p className="text-sm">Auto-save</p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Sweep roundups & allowance into this pod.
            </p>
          </div>
          <Toggle checked={autoSave} onChange={setAutoSave} accent={accent} />
        </div>
      </div>
    </Modal>
  );
}

function AddMoneyModal({
  pod,
  onAdd,
  onClose,
}: {
  pod: PodT;
  onAdd: (pod: PodT, rupees: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const remaining = Math.max(0, pod.goalAmount - pod.savedAmount);

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount in ₹");
    // Optimistic: the page bumps the pod card + toasts + syncs the server.
    // Close immediately so the card reflects the new total right away.
    onAdd(pod, amt);
    onClose();
  };

  const quick = [100, 500, 1000];

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Add to ${pod.name}`}
      description={
        remaining > 0 ? (
          <>
            <Money paise={remaining} /> left to hit the goal.
          </>
        ) : (
          "This pod is already fully funded — top it up anyway."
        )
      }
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit}>
            <PiggyBank size={16} /> Add money
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" htmlFor="contribute-amount" hint="In rupees.">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 num">₹</span>
            <input
              id="contribute-amount"
              type="number"
              inputMode="decimal"
              min={1}
              className="input-field pl-7 num text-lg"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              className="chip cursor-pointer hover:!bg-white/[0.08]"
              onClick={() => setAmount(String(q))}
            >
              +₹{q.toLocaleString("en-IN")}
            </button>
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="chip cursor-pointer !text-[#00FF9D] !border-[#00FF9D]/30 !bg-[#00FF9D]/10 hover:!bg-[#00FF9D]/15"
              onClick={() => setAmount(String(remaining / 100))}
            >
              <Sparkles size={9} /> Fill goal
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function EditPodModal({ pod, onClose }: { pod: PodT; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(pod.name);
  const [emoji, setEmoji] = useState(pod.emoji);
  const [goal, setGoal] = useState(String(pod.goalAmount / 100));
  const [accent, setAccent] = useState(pod.accent);
  const [autoSave, setAutoSave] = useState(pod.autoSave);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const goalNum = Number(goal);
    if (!name.trim()) return toast.error("Give your pod a name");
    if (!goalNum || goalNum <= 0) return toast.error("Enter a goal amount in ₹");
    setBusy(true);
    try {
      const res = await updatePodFn({
        data: {
          id: pod.id,
          name: name.trim(),
          emoji: emoji.trim() || "🎯",
          accent,
          goal: goalNum,
          autoSave,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pod updated");
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not update pod. Check your inputs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit pod"
      description="Tweak the name, goal, look or auto-save."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <Field label="Emoji" htmlFor="edit-emoji">
            <input
              id="edit-emoji"
              className="input-field w-20 text-center text-xl"
              value={emoji}
              maxLength={8}
              onChange={(e) => setEmoji(e.target.value)}
            />
          </Field>
          <div className="flex-1">
            <Field label="Name" htmlFor="edit-name">
              <input
                id="edit-name"
                className="input-field"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Field label="Goal amount" htmlFor="edit-goal" hint="In rupees.">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 num">₹</span>
            <input
              id="edit-goal"
              type="number"
              inputMode="decimal"
              min={1}
              className="input-field pl-7 num"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </Field>

        <Field label="Accent">
          <AccentPicker value={accent} onChange={setAccent} />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
          <div>
            <p className="text-sm">Auto-save</p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Sweep roundups & allowance into this pod.
            </p>
          </div>
          <Toggle checked={autoSave} onChange={setAutoSave} accent={accent} />
        </div>
      </div>
    </Modal>
  );
}

function DeletePodModal({ pod, onClose }: { pod: PodT; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await deletePodFn({ data: { id: pod.id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted "${pod.name}"`);
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not delete pod. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Delete pod?"
      description={
        <>
          "{pod.name}" will be removed. Any saved money (
          <Money paise={pod.savedAmount} />) returns to your wallet.
        </>
      }
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-ghost btn-danger" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Delete
            pod
          </button>
        </>
      }
    >
      <div className="rounded-xl bg-[#FF6B7A]/10 border border-[#FF6B7A]/25 p-3.5 text-sm text-white/70">
        This can't be undone.
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                              */
/* ------------------------------------------------------------------ */

function PodsPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const { create } = Route.useSearch();

  const [createOpen, setCreateOpen] = useState<boolean>(create ?? false);
  const [moneyPod, setMoneyPod] = useState<PodT | null>(null);
  const [editPod, setEditPod] = useState<PodT | null>(null);
  const [deletePod, setDeletePod] = useState<PodT | null>(null);

  // Mirror the loader pods into local state so "Add money" can update a card
  // instantly. When the loader refetches (after router.invalidate) the new
  // reference flows back in and reconciles the optimistic bump with the truth.
  const [pods, setPods] = useState<PodT[]>(data.pods);
  useEffect(() => {
    setPods(data.pods);
  }, [data.pods]);

  // Optimistically bump a pod's savedAmount/pct, celebrate, then sync + reconcile.
  const handleContribute = async (pod: PodT, rupees: number) => {
    const paise = Math.round(rupees * 100);
    const optimisticSaved = pod.savedAmount + paise;
    const willComplete = optimisticSaved >= pod.goalAmount && pod.savedAmount < pod.goalAmount;

    setPods((prev) =>
      prev.map((p) =>
        p.id === pod.id
          ? {
              ...p,
              savedAmount: optimisticSaved,
              pct: Math.min(100, Math.round((optimisticSaved / Math.max(1, p.goalAmount)) * 100)),
              status: optimisticSaved >= p.goalAmount ? "complete" : p.status,
            }
          : p,
      ),
    );

    if (willComplete) {
      toast.success(`🎉 ${pod.name} unlocked!`, {
        description: "Goal smashed — you hit 100%. Treat yourself.",
      });
    } else {
      toast.success(`Added ₹${rupees.toLocaleString("en-IN")} to ${pod.name}`);
    }

    try {
      const res = await contributeToPodFn({ data: { podId: pod.id, amount: rupees } });
      if (!res.ok) toast.error(res.error);
    } catch {
      toast.error("Could not add money. Try again.");
    } finally {
      // Refetch the loader — this reconciles the optimistic state (or rolls it
      // back on failure) with the server truth.
      await router.invalidate();
    }
  };

  // Reveal-on-scroll, matching the reference page.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pods.length]);

  const activeCount = pods.filter((p: PodT) => p.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Savings"
        title="Savings Pods"
        subtitle="Goal jars for the things you're chasing. Drop money in, watch the bar fill, unlock the trophy."
        actions={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New pod
          </button>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 reveal">
        <StatTile
          accent
          label="Total Saved"
          value={<Money paise={data.totalSaved} />}
          sub={`across ${pods.length} pod${pods.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Committed"
          value={<Money paise={data.totalCommitted} />}
          sub="sum of all goals"
        />
        <StatTile
          label="Active Pods"
          value={activeCount}
          sub={`${pods.length - activeCount} complete`}
        />
      </div>

      {/* Pod grid / empty state */}
      {pods.length === 0 ? (
        <div className="panel p-6 reveal">
          <EmptyState
            icon={<Target size={24} />}
            title="No pods yet"
            hint="Create your first savings pod and start stacking towards a goal."
            action={
              <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> New pod
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pods.map((pod: PodT) => (
            <PodCard
              key={pod.id}
              pod={pod}
              onAddMoney={setMoneyPod}
              onEdit={setEditPod}
              onDelete={setDeletePod}
            />
          ))}
        </div>
      )}

      {/* Recent contributions */}
      {data.recentContributions.length > 0 && (
        <div className="panel p-6 reveal">
          <div className="flex items-center justify-between">
            <Chip>
              <Wallet size={10} /> Recent contributions
            </Chip>
            <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">
              LAST {data.recentContributions.length}
            </span>
          </div>
          <div className="mt-4 -mx-2 max-h-80 overflow-y-auto">
            {data.recentContributions.map((c: ContribT) => {
              const meta = SOURCE_META[c.source] ?? SOURCE_META.manual;
              const pod = pods.find((p: PodT) => p.id === c.podId);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-2 py-3 border-t border-white/5 hover:bg-white/[0.02] rounded-lg transition"
                >
                  <div
                    className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-lg shrink-0"
                    aria-hidden
                  >
                    {pod?.emoji ?? meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{pod?.name ?? "Pod"}</p>
                    <p className="text-[11px] text-white/40">
                      {meta.emoji} {meta.label} ·{" "}
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold text-[#00FF9D]">
                    +<Money paise={c.amount} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePodModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {moneyPod && (
        <AddMoneyModal
          pod={moneyPod}
          onAdd={handleContribute}
          onClose={() => setMoneyPod(null)}
        />
      )}
      {editPod && <EditPodModal pod={editPod} onClose={() => setEditPod(null)} />}
      {deletePod && <DeletePodModal pod={deletePod} onClose={() => setDeletePod(null)} />}
    </div>
  );
}
