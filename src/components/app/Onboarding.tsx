import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  PiggyBank,
  Trophy,
  Users,
  Target,
  Wallet,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Rocket,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/app/Modal";
import { completeOnboardingFn } from "@/api/onboarding";
import type { PublicUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type Item = { icon: LucideIcon; title: string; text: string; accent: string };

const FEATURES: Item[] = [
  { icon: PiggyBank, title: "AI micro-savings", text: "Roundups sweep your spare change into goals automatically.", accent: "#00E5FF" },
  { icon: Trophy, title: "Gamified pods", text: "Turn saving into a game with streaks, XP and trophies.", accent: "#00FF9D" },
  { icon: Users, title: "Parental controls", text: "A privacy-first family hub with allowances and chore rewards.", accent: "#FF8A5B" },
];

const TIPS: Item[] = [
  { icon: Target, title: "Create a pod", text: "Set a goal like a new phone and watch it fill up.", accent: "#00E5FF" },
  { icon: Wallet, title: "Log transactions", text: "Add spends with roundups on to auto-save the change.", accent: "#00FF9D" },
  { icon: Sparkles, title: "Ask Buddy", text: "Your AI coach answers money questions any time.", accent: "#FF8A5B" },
];

function Row({ icon: Icon, title, text, accent }: Item) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="h-10 w-10 rounded-lg grid place-items-center shrink-0"
        style={{ background: `${accent}1a`, boxShadow: `inset 0 0 0 1px ${accent}33`, color: accent }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-white/50">{text}</p>
      </div>
    </li>
  );
}

/** First-run welcome tour. Renders nothing once the user has been onboarded. */
export function Onboarding({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  if (user.onboardedAt) return null;

  const firstName = user.name.split(" ")[0] || "there";
  const last = step === 2;

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboardingFn();
      await router.invalidate();
      setOpen(false);
    } catch {
      toast.error("Couldn't finish onboarding. Please try again.");
      setBusy(false);
    }
  };

  const titles = [`Welcome to finAI-Buddy, ${firstName}!`, "Quick tips to get rolling", "You're all set 🎉"];
  const subtitles = [
    "Your money, on your side.",
    "Three simple habits build the streak.",
    "Let's put your first rupee to work.",
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) void finish();
      }}
      title={titles[step]}
      description={subtitles[step]}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button type="button" onClick={finish} disabled={busy} className="btn-ghost">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={busy}
                className="btn-ghost"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {last ? (
              <button type="button" onClick={finish} disabled={busy} className="btn-primary">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <>Start saving <ArrowRight size={16} /></>}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                disabled={busy}
                className="btn-primary"
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      }
    >
      {step === 0 && <ul className="space-y-4">{FEATURES.map((f) => <Row key={f.title} {...f} />)}</ul>}

      {step === 1 && <ul className="space-y-4">{TIPS.map((t) => <Row key={t.title} {...t} />)}</ul>}

      {step === 2 && (
        <div className="flex flex-col items-center text-center py-2">
          <div
            className="h-16 w-16 rounded-2xl grid place-items-center"
            style={{ background: "linear-gradient(160deg,#00E5FF2e,#00E5FF14)", boxShadow: "inset 0 0 0 1px #00E5FF40" }}
          >
            <Rocket size={28} className="text-[#00E5FF]" />
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/60">
            You're ready to build a saving streak. Hit <span className="text-[#00E5FF]">Start saving</span> and let Buddy handle the spare change.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-[#00E5FF]" : "w-1.5 bg-white/15")}
          />
        ))}
      </div>
    </Modal>
  );
}
