import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, CheckCircle2, CalendarClock, Target, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  listGoalsFn, createGoalFn, logGoalProgressFn, updateGoalFn, deleteGoalFn,
} from "@/api/goals";
import { Money, Chip, PageHeader, ProgressBar, IconTile, EmptyState } from "@/components/app/primitives";
import { Donut } from "@/components/app/charts";
import { Modal, Field } from "@/components/app/Modal";

type Goal = Awaited<ReturnType<typeof listGoalsFn>>["goals"][number];

export const Route = createFileRoute("/_app/goals")({
  validateSearch: (search: Record<string, unknown>): { create?: true } =>
    search.create === true ||
    search.create === "true" ||
    search.create === 1 ||
    search.create === "1"
      ? { create: true }
      : {},
  loader: async () => await listGoalsFn(),
  component: GoalsPage,
});

function useReveal(dep?: unknown) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

function GoalsPage() {
  const { goals } = Route.useLoaderData() as Awaited<ReturnType<typeof listGoalsFn>>;
  const { create } = Route.useSearch();
  useReveal(goals.length);

  const [createOpen, setCreateOpen] = useState<boolean>(create ?? false);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Long-term Goals"
        title="Your money goals"
        subtitle="Track your big-ticket dreams. Log progress any time — Buddy cheers you on as each bar fills up."
        actions={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New goal
          </button>
        }
      />

      {goals.length === 0 ? (
        <div className="reveal panel p-6">
          <EmptyState
            icon={<Target size={22} />}
            title="No goals yet"
            hint="Set your first goal — a phone, a trip, an emergency fund — and watch it grow."
            action={
              <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Create a goal
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map((g) => {
            const complete = g.status === "complete";
            const accent = complete ? "#00FF9D" : "#00E5FF";
            const deadline = g.deadline ? new Date(g.deadline) : null;
            const isPast = !complete && deadline !== null && deadline.getTime() < Date.now();
            return (
              <div key={g.id} className="reveal panel p-6 flex flex-col gap-4 card-interactive">
                <div className="flex items-start gap-4">
                  <IconTile emoji={g.icon} accent={accent} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl truncate">{g.title}</h3>
                      {complete && (
                        <Chip className="!bg-[#00FF9D]/15 !border-[#00FF9D]/30 !text-[#00FF9D] shrink-0">
                          <CheckCircle2 size={10} /> Complete
                        </Chip>
                      )}
                    </div>
                    {g.description && (
                      <p className="text-sm text-white/50 mt-1 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <Donut pct={g.pct} color={accent} size={84} stroke={7}>
                    <span className="num text-lg font-semibold" style={{ color: accent }}>{g.pct}%</span>
                  </Donut>
                  <div className="flex-1 min-w-0">
                    <p className="num text-sm">
                      <Money paise={g.currentAmount} className="text-white font-semibold" />
                      <span className="text-white/40"> / <Money paise={g.targetAmount} /></span>
                    </p>
                    <ProgressBar className="mt-2" pct={g.pct} accent={accent} complete={complete} />
                    {deadline && (
                      <p className={`text-[11px] mt-2 flex items-center gap-1 ${isPast ? "text-[#FF8A5B]" : "text-white/40"}`}>
                        <CalendarClock size={11} />
                        {isPast ? "Was due" : "Due"} {formatDistanceToNow(deadline, { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="hairline pt-4 flex items-center gap-2">
                  <button className="btn-ghost text-sm" onClick={() => setProgressGoal(g)}>
                    <Plus size={14} /> Log progress
                  </button>
                  <button
                    className="btn-ghost text-sm ml-auto"
                    onClick={() => setEditGoal(g)}
                    aria-label={`Edit ${g.title}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-ghost btn-danger text-sm"
                    onClick={() => setDeleteTarget(g)}
                    aria-label={`Delete ${g.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateGoalModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProgressModal goal={progressGoal} onClose={() => setProgressGoal(null)} />
      <EditGoalModal goal={editGoal} onClose={() => setEditGoal(null)} />
      <DeleteGoalModal goal={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}

function CreateGoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setIcon("");
      setTarget("");
      setDeadline("");
    }
  }, [open]);

  const submit = async () => {
    const targetNum = Number(target);
    if (!title.trim()) {
      toast.error("Name your goal");
      return;
    }
    if (!target || Number.isNaN(targetNum) || targetNum <= 0) {
      toast.error("Set a target above ₹0");
      return;
    }
    setBusy(true);
    try {
      await createGoalFn({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          target: targetNum,
          deadline: deadline || undefined,
        },
      });
      toast.success("Goal created");
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not create goal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New goal"
      description="Give your goal a name and a target. Log progress whenever you save."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Create goal
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Title" htmlFor="goal-title">
            <input
              id="goal-title"
              className="input-field"
              placeholder="New phone"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Emoji" htmlFor="goal-icon">
            <input
              id="goal-icon"
              className="input-field w-16 text-center text-lg"
              placeholder="🎯"
              value={icon}
              maxLength={8}
              onChange={(e) => setIcon(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="goal-desc" hint="Optional — what is this goal for?">
          <textarea
            id="goal-desc"
            className="input-field"
            rows={2}
            placeholder="Save up for the Pixel 9a"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (₹)" htmlFor="goal-target">
            <input
              id="goal-target"
              type="number"
              min="0"
              inputMode="numeric"
              className="input-field"
              placeholder="25000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Deadline" htmlFor="goal-deadline" hint="Optional">
            <input
              id="goal-deadline"
              type="date"
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ProgressModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount("");
  }, [goal?.id]);

  const submit = async () => {
    if (!goal) return;
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value === 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      const res = await logGoalProgressFn({ data: { id: goal.id, amount: value } });
      if (!res.ok) {
        toast.error(res.error ?? "Could not log progress");
        return;
      }
      toast.success(value > 0 ? "Progress logged" : "Progress adjusted");
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={goal !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Log progress"
      description={goal ? `Add or remove savings for “${goal.title}”.` : undefined}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {goal && (
          <p className="text-sm text-white/50">
            Saved so far:{" "}
            <Money paise={goal.currentAmount} className="text-white" /> of{" "}
            <Money paise={goal.targetAmount} className="text-white/70" />
          </p>
        )}
        <Field
          label="Amount (₹)"
          htmlFor="progress-amount"
          hint="Tip: enter a negative amount (e.g. -500) to correct an over-count."
        >
          <input
            id="progress-amount"
            type="number"
            inputMode="numeric"
            className="input-field"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditGoalModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setIcon(goal.icon);
    setTarget(String(goal.targetAmount / 100));
    setDeadline(goal.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd") : "");
  }, [goal]);

  const submit = async () => {
    if (!goal) return;
    const targetNum = Number(target);
    if (!title.trim()) {
      toast.error("Name your goal");
      return;
    }
    if (!target || Number.isNaN(targetNum) || targetNum <= 0) {
      toast.error("Set a target above ₹0");
      return;
    }
    setBusy(true);
    try {
      const res = await updateGoalFn({
        data: {
          id: goal.id,
          title: title.trim(),
          description: description.trim(),
          icon: icon.trim() || undefined,
          target: targetNum,
          deadline: deadline || null,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not update goal");
        return;
      }
      toast.success("Goal updated");
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not update goal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={goal !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Edit goal"
      description="Update the details or clear the deadline."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Title" htmlFor="edit-title">
            <input
              id="edit-title"
              className="input-field"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Emoji" htmlFor="edit-icon">
            <input
              id="edit-icon"
              className="input-field w-16 text-center text-lg"
              value={icon}
              maxLength={8}
              onChange={(e) => setIcon(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="edit-desc">
          <textarea
            id="edit-desc"
            className="input-field"
            rows={2}
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (₹)" htmlFor="edit-target">
            <input
              id="edit-target"
              type="number"
              min="0"
              inputMode="numeric"
              className="input-field"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Deadline" htmlFor="edit-deadline" hint="Leave blank to clear">
            <input
              id="edit-deadline"
              type="date"
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function DeleteGoalModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      const res = await deleteGoalFn({ data: { id: goal.id } });
      if (!res.ok) {
        toast.error("Could not delete goal");
        return;
      }
      toast.success("Goal deleted");
      await router.invalidate();
      onClose();
    } catch {
      toast.error("Could not delete goal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={goal !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Delete goal"
      description={goal ? `“${goal.title}” and its progress will be removed. This can’t be undone.` : undefined}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-ghost btn-danger" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Delete
          </button>
        </>
      }
    >
      <p className="text-sm text-white/60 flex items-center gap-2">
        <Sparkles size={16} className="text-[#FF8A5B] shrink-0" />
        You can always create a new goal later — nothing else is affected.
      </p>
    </Modal>
  );
}
