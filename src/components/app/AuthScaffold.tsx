import type { ReactNode } from "react";
import { Sparkles, PiggyBank, Trophy, Shield } from "lucide-react";

const FEATURES = [
  { icon: PiggyBank, title: "AI micro-savings", text: "Roundups & auto-save move spare change into your goals." },
  { icon: Trophy, title: "Gamified pods", text: "Turn saving into a game with streaks, XP and trophies." },
  { icon: Shield, title: "Parent controls", text: "Privacy-first family hub with allowances & chore rewards." },
];

export function AuthScaffold({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Marketing panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(80% 60% at 20% 0%, rgba(0,229,255,0.15), transparent 60%)" }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#1E1E5A] grid place-items-center overflow-hidden">
            <span className="font-display text-xl text-[#06060F] leading-none">fB</span>
          </div>
          <div className="font-display text-2xl">finAI<span className="text-[#00E5FF] not-italic">·</span>Buddy</div>
        </div>

        <div className="relative">
          <span className="chip"><Sparkles size={10} className="text-[#00E5FF]" /> For India's smartest teen savers</span>
          <h2 className="mt-5 font-display text-5xl leading-[1.05]">
            Your money,<br /><span className="text-[#00E5FF]">on your side.</span>
          </h2>
          <ul className="mt-8 space-y-4 max-w-sm">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20 grid place-items-center text-[#00E5FF] shrink-0">
                  <f.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-sm text-white/50">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-4 font-mono-tech text-[10px] tracking-wider text-white/40">
          <span>AES-256</span><span>RBI COMPLIANT</span><span>ISO 27001</span><span>SOC 2</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#1E1E5A] grid place-items-center">
              <span className="font-display text-lg text-[#06060F]">fB</span>
            </div>
            <div className="font-display text-xl">finAI<span className="text-[#00E5FF] not-italic">·</span>Buddy</div>
          </div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="text-white/55 mt-2 text-sm">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
