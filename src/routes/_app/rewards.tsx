import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Trophy, Zap, Lock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { listRewardsFn, evaluateAchievementsFn } from "@/api/rewards";
import { PageHeader, Chip, ProgressBar, StatTile, EmptyState } from "@/components/app/primitives";
import { achievementIcon } from "@/components/app/achievement-icons";

export const Route = createFileRoute("/_app/rewards")({
  loader: async () => await listRewardsFn(),
  component: RewardsPage,
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

function RewardsPage() {
  const data = Route.useLoaderData() as Awaited<ReturnType<typeof listRewardsFn>>;
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  useReveal();

  const check = async () => {
    setChecking(true);
    try {
      const res = await evaluateAchievementsFn();
      if (res.newlyUnlocked.length) {
        toast.success(`Unlocked: ${res.newlyUnlocked.join(", ")}`);
      } else {
        toast("No new trophies yet");
      }
      await router.invalidate();
    } catch {
      toast.error("Couldn't check for trophies. Try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rewards"
        title="Trophy Case"
        subtitle="Level up by saving smart. Every milestone unlocks XP and a fresh badge for your case."
        actions={
          <button className="btn-primary" onClick={check} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Check for new trophies
          </button>
        }
      />

      {/* Hero — level + XP progress */}
      <div className="reveal panel-neon p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/60 to-transparent scan-line" />
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5">
            <Chip><Zap size={10} className="text-[#00E5FF]" /> Current Level</Chip>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="num font-light tracking-tight text-6xl sm:text-7xl">{data.level}</span>
              <span className="text-white/50 text-lg">Level</span>
            </div>
            <p className="mt-3 text-sm text-white/60">
              <span className="num text-white">{data.xpIntoLevel}</span>
              <span className="text-white/40"> / {data.xpForNextLevel} XP</span> to next level
            </p>
            <ProgressBar className="mt-3 max-w-sm" pct={data.levelPct} height={8} />
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile accent label="Total XP" value={<span className="num">{data.xp}</span>} sub="lifetime" />
            <StatTile label="Trophy XP" value={<span className="num">{data.earnedXp}</span>} sub="from unlocks" />
            <StatTile
              label="Unlocked"
              value={<span className="num">{data.unlockedCount} / {data.total}</span>}
              sub="badges earned"
            />
          </div>
        </div>
      </div>

      {/* Achievements grid */}
      <div className="reveal panel p-6">
        <div className="flex items-center justify-between">
          <Chip><Trophy size={10} /> All Trophies</Chip>
          <span className="font-mono-tech text-[10px] text-white/40 tracking-widest">
            {data.unlockedCount} / {data.total} UNLOCKED
          </span>
        </div>

        {data.achievements.length === 0 ? (
          <EmptyState
            icon={<Trophy size={22} />}
            title="No trophies yet"
            hint="Start saving, build pods, and grow your net worth to earn your first badge."
          />
        ) : (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.achievements.map((a) => {
              const Icon = achievementIcon(a.icon);
              return (
                <div
                  key={a.id}
                  className={`relative rounded-xl border p-4 flex flex-col transition ${
                    a.unlocked
                      ? "bg-[#00E5FF]/10 border-[#00E5FF]/25"
                      : "bg-white/[0.02] border-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`h-11 w-11 rounded-lg grid place-items-center border shrink-0 ${
                        a.unlocked
                          ? "bg-[#00E5FF]/15 border-[#00E5FF]/30 text-[#00E5FF]"
                          : "bg-white/[0.02] border-white/[0.05] text-white/25"
                      }`}
                    >
                      <Icon size={22} />
                    </div>
                    {!a.unlocked && <Lock size={13} className="text-white/25 mt-1" />}
                    {a.unlocked && a.unlockedAt && (
                      <span className="font-mono-tech text-[10px] text-white/40 mt-1 tracking-wider">
                        {format(new Date(a.unlockedAt), "d MMM")}
                      </span>
                    )}
                  </div>

                  <p className={`font-display text-base mt-3 leading-tight ${a.unlocked ? "" : "text-white/40"}`}>
                    {a.label}
                  </p>
                  <p className={`text-xs mt-1 flex-1 ${a.unlocked ? "text-white/55" : "text-white/25"}`}>
                    {a.description}
                  </p>

                  <span
                    className={`chip mt-3 self-start ${
                      a.unlocked
                        ? "!bg-[#00FF9D]/12 !border-[#00FF9D]/30 !text-[#00FF9D]"
                        : "!bg-white/[0.03] !border-white/[0.06] !text-white/30"
                    }`}
                  >
                    <Zap size={9} /> +{a.xp} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
