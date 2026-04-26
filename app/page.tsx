import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground">
          Plateforme institutionnelle
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          web-safeguard
        </h1>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          Surveillance du trafic national, détection et blocage des sites et applications
          frauduleux pour la protection des utilisateurs résidents du pays.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Accéder à la console
          </Link>
        </div>
        <p className="mt-12 max-w-md text-xs text-muted-foreground">
          Accès réservé aux agents autorisés. Toutes les actions sont tracées dans le journal
          d&apos;audit conformément aux exigences réglementaires.
        </p>
      </div>
    </main>
  );
}
