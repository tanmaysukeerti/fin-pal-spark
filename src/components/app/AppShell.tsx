import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard, PiggyBank, BarChart3, Wallet, Target, Trophy, Users,
  Zap, Calendar, Shield, Settings, Search, Bell, Sparkles, Command as CommandIcon,
  LogOut, Menu, Plus, X, Sun, Moon,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import { logoutFn } from "@/api/auth";
import { getNotificationsFn, type Notification as AppNotification } from "@/api/notifications";
import { Tilt3D } from "./Tilt3D";
import type { PublicUser } from "@/lib/auth/session";

export type NavItem = { icon: typeof LayoutDashboard; label: string; to: string; badge?: string };

export const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", to: "/" },
  { icon: PiggyBank, label: "Savings Pods", to: "/pods" },
  { icon: BarChart3, label: "Insights", to: "/insights" },
  { icon: Wallet, label: "Transactions", to: "/transactions" },
  { icon: Target, label: "Goals", to: "/goals" },
  { icon: Trophy, label: "Rewards", to: "/rewards" },
  { icon: Users, label: "Family Hub", to: "/family" },
];

const AUTOMATIONS: NavItem[] = [
  { icon: Zap, label: "UPI Roundups", to: "/settings", badge: "ON" },
  { icon: Calendar, label: "Weekly Allowance", to: "/family" },
  { icon: Shield, label: "Category Limits", to: "/insights" },
];

const MOBILE_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", to: "/" },
  { icon: PiggyBank, label: "Pods", to: "/pods" },
  { icon: Wallet, label: "Activity", to: "/transactions" },
  { icon: BarChart3, label: "Insights", to: "/insights" },
  { icon: Sparkles, label: "Buddy", to: "/buddy" },
];

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="finAI-Buddy home">
      <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#1E1E5A] grid place-items-center overflow-hidden">
        <span className="font-display text-lg text-[#06060F] leading-none">fB</span>
        <span className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/30 to-transparent h-1/2" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-xl">finAI<span className="text-[#00E5FF] not-italic">·</span>Buddy</div>
        <div className="font-mono-tech text-[9px] tracking-widest uppercase text-white/40">v3.2 · India</div>
      </div>
    </Link>
  );
}

function NavList({ user, onNavigate }: { user: PublicUser; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <p className="px-3 mb-2 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-white/30">Workspace</p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((it) => {
          const active = isActive(pathname, it.to);
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <Link to={it.to} onClick={onNavigate} className="nav-link" data-active={active}>
                <Icon size={16} className={active ? "text-[#00E5FF]" : ""} />
                <span className="flex-1">{it.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="px-3 mt-8 mb-2 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-white/30">Automations</p>
      <ul className="space-y-0.5">
        {AUTOMATIONS.map((x) => {
          const Icon = x.icon;
          return (
            <li key={x.label}>
              <Link to={x.to} onClick={onNavigate} className="nav-link">
                <Icon size={16} />
                <span className="flex-1">{x.label}</span>
                {x.badge && (
                  <span className="text-[9px] font-mono-tech tracking-wider text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20 rounded-md px-1.5 py-0.5">{x.badge}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ProfileCard({ user }: { user: PublicUser }) {
  return (
    <Link to="/settings" className="block rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 card-interactive">
      <div className="flex items-center gap-2.5">
        <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#1E1E5A] grid place-items-center text-[#06060F] font-semibold text-sm">
          {user.avatarInitial}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#00FF9D] border-2 border-[#08081A]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{user.name}</p>
          <p className="text-[10px] font-mono-tech text-[#00E5FF] tracking-wider">LVL {user.level} · {user.xp.toLocaleString("en-IN")} XP</p>
        </div>
        <Settings size={14} className="text-white/40" />
      </div>
    </Link>
  );
}

function Sidebar({ user }: { user: PublicUser }) {
  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0 border-r border-white/5 bg-[#08081A]/60 backdrop-blur-xl sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-8"><Brand /></div>
      <nav className="px-3 flex-1 overflow-y-auto">
        <NavList user={user} />
      </nav>
      <div className="p-3 mt-4"><ProfileCard user={user} /></div>
    </aside>
  );
}

function CommandMenu({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const go = (to: string) => {
    setOpen(false);
    router.navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or run an action…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((it) => (
            <CommandItem key={it.to + it.label} value={`go ${it.label}`} onSelect={() => go(it.to)}>
              <it.icon className="mr-2 h-4 w-4" />
              {it.label}
            </CommandItem>
          ))}
          <CommandItem value="buddy chat ai" onSelect={() => go("/buddy")}>
            <Sparkles className="mr-2 h-4 w-4" /> Ask Buddy
          </CommandItem>
          <CommandItem value="settings account" onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Quick actions">
          <CommandItem value="new pod create savings" onSelect={() => go("/pods?create=true")}>
            <Plus className="mr-2 h-4 w-4" /> New savings pod
          </CommandItem>
          <CommandItem value="add transaction expense income" onSelect={() => go("/transactions?create=true")}>
            <Plus className="mr-2 h-4 w-4" /> Add transaction
          </CommandItem>
          <CommandItem value="new goal target" onSelect={() => go("/goals?create=true")}>
            <Target className="mr-2 h-4 w-4" /> New goal
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    getNotificationsFn()
      .then((r) => setItems(r.notifications))
      .catch(() => {})
      .finally(() => setLoaded(true));
  };

  return (
    <Popover.Root onOpenChange={(o) => { if (o) load(); }}>
      <Popover.Trigger asChild>
        <button className="relative h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] grid place-items-center hover:bg-white/[0.06] transition" aria-label="Notifications">
          <Bell size={15} className="text-white/70" />
          {(!loaded || items.length > 0) && (
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#00E5FF] pulse-ring" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 panel p-3 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <p className="px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest text-white/40">Notifications</p>
          <ul className="mt-1 space-y-0.5 max-h-[60vh] overflow-y-auto">
            {loaded && items.length === 0 && (
              <li className="px-2 py-4 text-sm text-white/50 text-center">You're all caught up ✨</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => router.navigate({ to: n.to })}
                  className="w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.04] transition"
                >
                  <span className="text-base shrink-0" aria-hidden>{n.icon}</span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${n.tone === "warn" ? "text-[#FF8A5B]" : n.tone === "success" ? "text-[#00FF9D]" : "text-white"}`}>{n.title}</span>
                    <span className="block text-xs text-white/50">{n.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = (document.documentElement.dataset.theme as "dark" | "light") || "dark";
    setTheme(t);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("finai-theme", next); } catch { /* ignore */ }
  };
  return (
    <button
      onClick={toggle}
      className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] grid place-items-center hover:bg-white/[0.06] transition"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun size={15} className="text-white/70" /> : <Moon size={15} className="text-white/70" />}
    </button>
  );
}

function TopBar({ user, onOpenCommand, onOpenMobileNav }: { user: PublicUser; onOpenCommand: () => void; onOpenMobileNav: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = user.name.split(" ")[0];
  const router = useRouter();

  const logout = async () => {
    await logoutFn();
    toast.success("Signed out");
    router.navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#06060F]/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3.5">
        <button className="lg:hidden h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] grid place-items-center" onClick={onOpenMobileNav} aria-label="Open menu">
          <Menu size={16} className="text-white/70" />
        </button>
        <div className="hidden sm:block">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-[#00E5FF]">Command Center</p>
          <h1 className="font-display text-xl lg:text-2xl leading-none mt-1">{greeting}, {first}.</h1>
        </div>

        <div className="flex-1 max-w-md sm:ml-6">
          <button
            onClick={onOpenCommand}
            className="w-full flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-left hover:bg-white/[0.05] transition"
          >
            <Search size={14} className="text-white/40" />
            <span className="flex-1 text-sm text-white/30 truncate">Search or jump to…</span>
            <span className="hidden sm:flex font-mono-tech text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 items-center gap-1">
              <CommandIcon size={10} /> K
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationsBell />
          <Link to="/buddy" className="hidden sm:flex items-center gap-2 bg-[#00E5FF] text-[#06060F] rounded-lg pl-2 pr-3.5 py-2 text-sm font-semibold hover:brightness-105 transition">
            <span className="h-6 w-6 rounded-md bg-[#06060F]/10 grid place-items-center">
              <Sparkles size={12} className="sparkle-anim" />
            </span>
            Ask Buddy
          </Link>
          <button onClick={logout} className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] grid place-items-center hover:bg-white/[0.06] transition" aria-label="Sign out" title="Sign out">
            <LogOut size={15} className="text-white/70" />
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/8 bg-[#06060F]/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((it) => {
          const active = isActive(pathname, it.to);
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <Link to={it.to} className="flex flex-col items-center gap-1 py-2.5" data-active={active}>
                <Icon size={20} className={active ? "text-[#00E5FF]" : "text-white/50"} />
                <span className={`text-[10px] ${active ? "text-white" : "text-white/40"}`}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileNavDrawer({ user, open, setOpen }: { user: PublicUser; open: boolean; setOpen: (v: boolean) => void }) {
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="absolute left-0 top-0 h-full w-[260px] bg-[#08081A] border-r border-white/8 p-4 flex flex-col animate-in slide-in-from-left">
        <div className="flex items-center justify-between mb-6">
          <Brand />
          <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg bg-white/[0.04] grid place-items-center" aria-label="Close menu">
            <X size={16} className="text-white/60" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto"><NavList user={user} onNavigate={() => setOpen(false)} /></nav>
        <div className="mt-4"><ProfileCard user={user} /></div>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: PublicUser; children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen relative z-10">
      <Tilt3D />
      <Sidebar user={user} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar user={user} onOpenCommand={() => setCmdOpen(true)} onOpenMobileNav={() => setMobileNav(true)} />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav />
      <MobileNavDrawer user={user} open={mobileNav} setOpen={setMobileNav} />
      <CommandMenu open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  );
}
