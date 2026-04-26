import Link from "next/link";
import { DomainImportForm } from "@/components/intelligence/import-form";
import { TrancoForm } from "@/components/intelligence/tranco-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/rbac";

export default async function ImportPage() {
  await requireRole("ANALYST");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Importer des domaines</h1>
        <p className="text-sm text-muted-foreground">
          Alimente la plateforme avec de vrais domaines à surveiller. Les domaines importés
          sont créés en statut <code>PENDING</code> ; tu peux ensuite les scanner en masse
          depuis{" "}
          <Link href="/intelligence" className="underline-offset-2 hover:underline">
            /intelligence
          </Link>
          .
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Coller une liste</CardTitle>
          <CardDescription>
            Colle ta propre liste (ex: signalements citoyens, audit interne, sites suspects
            transmis par un partenaire).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DomainImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importer la liste publique Tranco</CardTitle>
          <CardDescription>
            Tranco agrège quotidiennement les classements Alexa, Cisco Umbrella, Majestic et
            Quantcast en un top 1M des domaines les plus consultés sur Internet (
            <a
              href="https://tranco-list.eu/"
              className="underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              tranco-list.eu
            </a>
            ). Utile pour amorcer la base avec des sites légitimes connus puis détecter les
            anomalies par scan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrancoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources alternatives à venir</CardTitle>
          <CardDescription>Pistes pour aller plus loin :</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            • <b>Ingestion FAI</b> ({" "}
            <Link href="/sources" className="underline-offset-2 hover:underline">
              /sources
            </Link>
            ) : configure un token, fais pousser le trafic réel via{" "}
            <code>POST /api/ingest/traffic</code>.
          </p>
          <p>
            • <b>Cisco Umbrella top 1M</b> et <b>Majestic Million</b> peuvent être collés ici
            (juste les noms de domaine).
          </p>
          <p>
            • <b>Listes thématiques</b> (PhishTank, OpenPhish) sont déjà interrogées par les
            providers de scan, mais leurs URL peuvent être importées pour scan ciblé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
