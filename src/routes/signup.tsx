import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthScaffold } from "@/components/app/AuthScaffold";
import { Field } from "@/components/app/Modal";
import { signupFn, meFn } from "@/api/auth";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const user = await meFn();
    if (user) throw redirect({ to: "/" });
  },
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signupFn({ data: { name, email, password } });
      if ("error" in res) {
        setError(res.error);
        setBusy(false);
        return;
      }
      toast.success(`Account created — welcome, ${res.user.name.split(" ")[0]}!`);
      await router.invalidate();
      router.navigate({ to: "/" });
    } catch {
      setError("Check your details — name (2+), valid email, password 8+ characters.");
      setBusy(false);
    }
  };

  return (
    <AuthScaffold title="Create your account" subtitle="Start saving smarter in under 2 minutes.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <input id="name" type="text" autoComplete="name" required value={name}
            onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Aarav Mehta" />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters." error={error ?? undefined}>
          <input id="password" type="password" autoComplete="new-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
        </Field>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link to="/login" className="text-[#00E5FF] hover:underline">Sign in</Link>
      </p>
      <p className="mt-4 text-center text-[10px] font-mono-tech uppercase tracking-[0.2em] text-white/30">
        No credit card · KYC via parent · 2 min setup
      </p>
    </AuthScaffold>
  );
}
