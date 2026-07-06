import { createServerFn } from "@tanstack/react-start";
import { getRepo } from "../db/repo";
import { requireUser } from "../lib/auth/session";

/** Mark the current user as having completed onboarding. */
export const completeOnboardingFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  await repo.users.update(user.id, { onboardedAt: new Date() });
  return { ok: true };
});
