import { CreateSourceForm } from "@/components/sources/create-source-form";
import { IssueTokenForm } from "@/components/sources/issue-token-form";
import { RevokeTokenButton } from "@/components/sources/revoke-token-button";
import { ToggleSourceButton } from "@/components/sources/toggle-source-button";
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

export default async function SourcesPage() {
  await requireRole("ADMIN");

  const sources = await prisma.ingestSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tokens: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sources d&apos;ingestion</h1>
        <p className="text-sm text-muted-foreground">
          Gestion des sources autorisées à pousser du trafic vers la plateforme et de leurs tokens
          API.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle source</CardTitle>
          <CardDescription>
            Crée une source (ex: FAI ou sonde DPI). Tu pourras ensuite émettre un ou plusieurs
            tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSourceForm />
        </CardContent>
      </Card>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucune source pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        sources.map((source) => {
          const activeTokens = source.tokens.filter(
            (t) => !t.revokedAt && (!t.expiresAt || t.expiresAt > new Date()),
          );
          return (
            <Card key={source.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {source.name}
                    {source.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="muted">Désactivée</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {source.description ?? "—"} · {activeTokens.length} token(s) actif(s) ·{" "}
                    Créée le {formatDateTime(source.createdAt)}
                  </CardDescription>
                </div>
                <ToggleSourceButton sourceId={source.id} isActive={source.isActive} />
              </CardHeader>
              <CardContent className="space-y-6">
                <IssueTokenForm sourceId={source.id} />

                {source.tokens.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tokens
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Étiquette</TableHead>
                          <TableHead>Empreinte</TableHead>
                          <TableHead>État</TableHead>
                          <TableHead>Créé</TableHead>
                          <TableHead>Dernière utilisation</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {source.tokens.map((token) => {
                          const expired = token.expiresAt ? token.expiresAt <= new Date() : false;
                          const status = token.revokedAt
                            ? "Révoqué"
                            : expired
                            ? "Expiré"
                            : "Actif";
                          return (
                            <TableRow key={token.id}>
                              <TableCell className="text-sm">{token.label ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {token.tokenHash.slice(0, 12)}…
                              </TableCell>
                              <TableCell>
                                {status === "Actif" && <Badge variant="success">Actif</Badge>}
                                {status === "Révoqué" && (
                                  <Badge variant="muted">Révoqué</Badge>
                                )}
                                {status === "Expiré" && (
                                  <Badge variant="warning">Expiré</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {formatDateTime(token.createdAt)}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {status === "Actif" && (
                                  <RevokeTokenButton tokenId={token.id} />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
