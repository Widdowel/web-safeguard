import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  await requireRole("ANALYST");

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground">
          Les 100 derniers événements. Le journal est append-only — aucune modification a posteriori
          n&apos;est possible.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Événements récents</CardTitle>
          <CardDescription>
            {events.length} événement{events.length > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {events.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun événement n&apos;a encore été enregistré.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horodatage</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(event.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.actor?.name ?? event.actor?.email ?? "système"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{event.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.target ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {event.reason ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
