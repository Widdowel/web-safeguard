import { SubscribeForm } from "@/components/webhooks/subscribe-form";
import {
  TriggerWebhookButton,
  UnsubscribeButton,
} from "@/components/webhooks/webhook-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export default async function WebhooksPage() {
  await requireRole("ADMIN");

  const subscribers = await prisma.blocklistSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks de blocklist</h1>
        <p className="text-sm text-muted-foreground">
          Notifie les FAI / opérateurs DNS abonnés à chaque changement de la liste de blocage.
          Chaque requête est signée HMAC-SHA256 (header <code>x-webhook-signature</code>).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nouvel abonné</CardTitle>
          <CardDescription>
            URL HTTPS uniquement. Un secret sera généré et affiché une seule fois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscribeForm />
        </CardContent>
      </Card>

      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun abonné configuré.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Abonnés ({subscribers.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Dernier succès</TableHead>
                  <TableHead>5 dernières livraisons</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="max-w-[260px] truncate font-mono text-xs">
                      {s.url}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="muted">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.deliveries.length === 0 ? (
                          <span className="text-xs text-muted-foreground">aucune</span>
                        ) : (
                          s.deliveries.map((d) => (
                            <span
                              key={d.id}
                              title={`${d.status} (${d.attempts} essai${d.attempts > 1 ? "s" : ""}${
                                d.responseCode ? ` — ${d.responseCode}` : ""
                              })`}
                              className={`size-2 rounded-full ${
                                d.status === "SUCCEEDED"
                                  ? "bg-success"
                                  : d.status === "FAILED"
                                  ? "bg-destructive"
                                  : "bg-warning"
                              }`}
                            />
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {s.isActive && (
                          <>
                            <TriggerWebhookButton id={s.id} />
                            <UnsubscribeButton id={s.id} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
