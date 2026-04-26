import { ChangePasswordForm } from "@/components/account/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/rbac";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrateur",
  ANALYST: "Analyste",
  OPERATOR: "Opérateur",
  VIEWER: "Lecteur",
} as const;

export default async function AccountPage() {
  const user = await requireSession();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">Identité et sécurité.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
            <CardDescription>Informations rattachées à ton compte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Email" value={user.email} />
            <Row label="Nom" value={user.name ?? "—"} />
            <Row label="Rôle" value={ROLE_LABEL[user.role]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changer mon mot de passe</CardTitle>
            <CardDescription>
              Choisis un mot de passe robuste. Le précédent est immédiatement invalidé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
