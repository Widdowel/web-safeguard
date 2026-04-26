import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Retour à l&apos;accueil
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Identifiez-vous pour accéder à la console.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
