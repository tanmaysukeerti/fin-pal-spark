import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthScaffold } from "@/components/app/AuthScaffold";
import { Field } from "@/components/app/Modal";
import { loginFn, meFn } from "@/api/auth";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed-data";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await meFn();
    if (user) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await loginFn({ data: { email, password } });
      if ("error" in res) {
        setError(res.error);
        setBusy(false);
        return;
      }
      toast.success(`Welcome back, ${res.user.name.split(" ")[0]}!`);
      await router.invalidate();
      router.navigate({ to: "/" });
    } catch {
      setError("Please enter a valid email and password.");
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <AuthScaffold title="Welcome back" subtitle="Sign in to your command center.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" error={error ?? undefined}>
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
        </Field>
        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-xs text-white/50 hover:text-[#00E5FF] transition">
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>

      <button onClick={fillDemo} className="mt-3 w-full text-center text-xs text-white/50 hover:text-[#00E5FF] transition">
        Use demo account →  {DEMO_EMAIL} / {DEMO_PASSWORD}
      </button>

      <p className="mt-6 text-center text-sm text-white/50">
        New here?{" "}
        <Link to="/signup" className="text-[#00E5FF] hover:underline">Create an account</Link>
      </p>
    </AuthScaffold>
  );
}
