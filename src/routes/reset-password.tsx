import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { AuthScaffold } from "@/components/app/AuthScaffold";
import { Field } from "@/components/app/Modal";
import { resetPasswordFn } from "@/api/auth";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await resetPasswordFn({ data: { token, password } });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  // No token in the URL — the link is malformed or was truncated.
  if (!token) {
    return (
      <AuthScaffold title="Invalid link" subtitle="This reset link is missing or broken.">
        <div className="space-y-5">
          <div className="panel p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#FF6B7A]/10 border border-[#FF6B7A]/20 grid place-items-center text-[#FF6B7A] shrink-0">
              <ShieldAlert size={16} />
            </div>
            <p className="text-sm text-white/70">
              Request a fresh link and we'll email you a new one.
            </p>
          </div>
          <Link to="/forgot-password" className="btn-primary w-full">
            Request a new link <ArrowRight size={16} />
          </Link>
        </div>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title="Choose a new password" subtitle="Make it strong — at least 8 characters.">
      {done ? (
        <div className="space-y-5">
          <div className="panel-neon p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#00FF9D]/10 border border-[#00FF9D]/20 grid place-items-center text-[#00FF9D] shrink-0">
              <ShieldCheck size={16} />
            </div>
            <p className="text-sm text-white/70">
              Your password has been reset. Sign in with your new password.
            </p>
          </div>
          <Link to="/login" className="btn-primary w-full">
            Sign in <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={error ?? undefined}>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </Field>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <>Reset password <ArrowRight size={16} /></>}
          </button>
        </form>
      )}
    </AuthScaffold>
  );
}
