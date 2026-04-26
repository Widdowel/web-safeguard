import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, FileSearch, KeyRound, ListChecks, Radar, Send, Shield, UserCircle, Users } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionUser, hasAtLeastRole } from "@/lib/rbac";
import type { Role } from "@/app/generated/prisma";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Activity;
  minRole: Role;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: Activity, minRole: "VIEWER" },
  { href: "/intelligence", label: "Intelligence pays", icon: Radar, minRole: "ANALYST" },
  { href: "/sites", label: "Sites", icon: FileSearch, minRole: "VIEWER" },
  { href: "/blocklist", label: "Liste de blocage", icon: Shield, minRole: "VIEWER" },
  { href: "/audit", label: "Journal d'audit", icon: ListChecks, minRole: "ANALYST" },
  { href: "/users", label: "Utilisateurs", icon: Users, minRole: "ADMIN" },
  { href: "/sources", label: "Sources d'ingestion", icon: KeyRound, minRole: "ADMIN" },
  { href: "/webhooks", label: "Webhooks", icon: Send, minRole: "ADMIN" },
  { href: "/account", label: "Mon compte", icon: UserCircle, minRole: "VIEWER" },
];

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrateur",
  ANALYST: "Analyste",
  OPERATOR: "Opérateur",
  VIEWER: "Lecteur",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const visibleNav = NAV_ITEMS.filter((item) => hasAtLeastRole(user.role, item.minRole));

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-5 text-primary" />
            web-safeguard
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="space-y-2 p-3 text-xs">
          <div>
            <div className="font-medium text-foreground">{user.name ?? user.email}</div>
            <div className="text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Déconnexion
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
