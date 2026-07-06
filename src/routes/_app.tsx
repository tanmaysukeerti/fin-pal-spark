import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Onboarding } from "@/components/app/Onboarding";
import { meFn } from "@/api/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await meFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <AppShell user={user}>
        <Outlet />
      </AppShell>
      <Onboarding user={user} />
    </>
  );
}
