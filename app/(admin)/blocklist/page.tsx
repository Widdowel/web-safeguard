export default function BlocklistPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Liste de blocage</h1>
      <p className="text-sm text-muted-foreground">
        Liste autoritative des règles actives et endpoints de diffusion (RPZ, JSON, hosts, BGP) —
        construits dans les commits suivants.
      </p>
    </div>
  );
}
