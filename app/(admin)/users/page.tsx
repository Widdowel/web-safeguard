import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/app/generated/prisma";

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrateur",
  ANALYST: "Analyste",
  OPERATOR: "Opérateur",
  VIEWER: "Lecteur",
};

export default async function UsersPage() {
  await requireRole("ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Gestion des comptes et des rôles. Les modifications sont tracées dans le journal
          d&apos;audit.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Comptes</CardTitle>
          <CardDescription>{users.length} utilisateur(s) enregistré(s).</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">{user.email}</TableCell>
                  <TableCell className="text-sm">{user.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="muted">Désactivé</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDateTime(user.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
