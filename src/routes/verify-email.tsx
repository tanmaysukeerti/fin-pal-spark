import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AuthScaffold } from "@/components/app/AuthScaffold";
import { verifyEmailFn } from "@/api/auth";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) {
          setError("This verification link is invalid or has expired.");
          setStatus("error");
        }
        return;
      }
      try {
        const res = await verifyEmailFn({ data: { token } });
        if (cancelled) return;
        if (res.ok) {
          setStatus("success");
        } else {
          setError(res.error);
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setError("This verification link is invalid or has expired.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthScaffold title="Verify your email" subtitle="Confirming your email address.">
      {status === "verifying" && (
        <div className="panel p-6 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-[#00E5FF]" />
          <p className="text-sm text-white/70">Verifying your email…</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-5">
          <div className="panel-neon p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#00FF9D]/10 border border-[#00FF9D]/20 grid place-items-center text-[#00FF9D] shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-sm font-medium">Email verified ✓</p>
              <p className="text-sm text-white/50 mt-0.5">Your account is all set. Welcome aboard!</p>
            </div>
          </div>
          <Link to="/" className="btn-primary w-full">
            Go to dashboard <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-5">
          <div className="panel p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#FF6B7A]/10 border border-[#FF6B7A]/20 grid place-items-center text-[#FF6B7A] shrink-0">
              <XCircle size={16} />
            </div>
            <div>
              <p className="text-sm font-medium">Verification failed</p>
              <p className="text-sm text-white/50 mt-0.5">{error}</p>
            </div>
          </div>
          <Link to="/settings" className="btn-ghost w-full">
            Go to settings <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </AuthScaffold>
  );
}
