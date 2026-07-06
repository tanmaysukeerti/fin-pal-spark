import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { requireUser, toPublicUser } from "../lib/auth/session";
import { hasDatabase } from "../db/repo";

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const repo = await getRepo();
  const [fullUser, accounts] = await Promise.all([
    repo.users.get(user.id),
    repo.accounts.listByUser(user.id),
  ]);
  return {
    user: fullUser ? toPublicUser(fullUser) : user,
    accounts,
    persistent: hasDatabase(),
  };
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(60).optional(),
  city: z.string().trim().max(40).optional(),
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateProfileSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const repo = await getRepo();
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) {
      patch.name = data.name;
      patch.avatarInitial = data.name.charAt(0).toUpperCase();
    }
    if (data.city !== undefined) patch.city = data.city;
    const updated = await repo.users.update(user.id, patch);
    return { ok: true, user: updated ? toPublicUser(updated) : user };
  });
