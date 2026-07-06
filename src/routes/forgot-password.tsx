import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AuthScaffold } from "@/components/app/AuthScaffold";
import { Field } from "@/components/app/Modal";
import { requestPasswordResetFn, meFn } from "@/api/auth";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    const user = await meFn();
    if (user) throw redirect({ to: "/" });
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await requestPasswordResetFn({ data: { email } });
      // requestPasswordResetFn always returns { ok: true } (no email enumeration);
      // devLink only appears in dev mode when no email provider is configured.
      if ("devLink" in res && res.devLink) setDevLink(res.devLink);
    } catch {
      // Swallow — we always show the same success state to avoid leaking account existence.
    } finally {
      setSent(true);
      setBusy(false);
    }
  };

  return (
    <AuthScaffold title="Reset your password" subtitle="We'll email you a reset link.">
      {sent ? (
        <div className="space-y-5">
          <div className="panel-neon p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#00FF9D]/10 border border-[#00FF9D]/20 grid place-items-center text-[#00FF9D] shrink-0">
              <MailCheck size={16} />
            </div>
            <p className="text-sm text-white/70">
              If an account exists, a reset link is on its way.
            </p>
          </div>

          {devLink && (
            <p className="text-xs text-white/50">
              Dev link:{" "}
              <a href={devLink} className="text-[#00E5FF] hover:underline break-all">
                {devLink}
              </a>
            </p>
          )}

          <Link to="/login" className="btn-ghost w-full">
            <ArrowLeft size={16} /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </Field>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>Send reset link <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            Remembered it?{" "}
            <Link to="/login" className="text-[#00E5FF] hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthScaffold>
  );
}
