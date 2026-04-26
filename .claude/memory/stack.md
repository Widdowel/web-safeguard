# Stack technique

## Versions critiques

| Paquet | Version | Notes critiques |
|---|---|---|
| `next` | **16.2.3** | ⚠️ Next 16 a des breaking changes par rapport aux versions ≤ 15. Avant de coder, lire les docs locales : `node_modules/next/dist/docs/`. Heed deprecation notices. |
| `react` / `react-dom` | **19.2.4** | React 19 : nouveaux hooks (`use`, `useActionState`, `useFormStatus`), Server Components stables, Server Actions. |
| `prisma` / `@prisma/client` | **7.7.0** | ⚠️ Prisma 7 récent. `prisma.config.ts` (et non `package.json#prisma`) est l'unique source de config. Schema attendu : `prisma/schema.prisma`. |
| `next-auth` | **5.0.0-beta.30** | Auth.js v5 (beta). API très différente de NextAuth v4. Cookies préfixés `authjs.*` (cf. `middleware.ts`). |
| `@auth/prisma-adapter` | ^2.11.1 | Adapter Prisma pour Auth.js v5. |
| `tailwindcss` | **4** (alpha/v4) | ⚠️ Tailwind 4 : config CSS-first via `@theme` dans `globals.css`. Plus de `tailwind.config.js`. |
| `shadcn` | 4 | Style choisi : **`base-nova`** (cf. `components.json`). Icons : lucide-react. |
| `@base-ui/react` | ^1.3.0 | Primitives UI sous-jacentes (utilisées par shadcn 4). |

## Adapters base de données

L'app supporte deux backends Postgres via deux adapters Prisma :

- **Local dev** : Postgres standard via `@prisma/adapter-pg` + `pg`. Cf. `.env` → `DATABASE_URL` pointe sur Prisma local dev server (port `51214`).
- **Production** : Neon serverless via `@prisma/adapter-neon` + `@neondatabase/serverless` + `ws`. URL Neon mise en `.env` à la place de la locale.

Le choix de l'adapter se fait au runtime selon `process.env.DATABASE_URL` (à implémenter dans `lib/prisma.ts`).

## Sécurité

- `bcryptjs` : hashing mots de passe (Credentials provider NextAuth).
- `AUTH_SECRET` : signature des sessions Auth.js — **doit être rotaté** avant prod.
- Validation runtime : on ajoutera **Zod** (à installer) pour toutes les entrées (body API, params, env).

## UI

- `recharts` v3 : graphiques dashboard.
- `sonner` v2 : toasts.
- `tw-animate-css` : utilitaires d'animation Tailwind.
- `class-variance-authority`, `clsx`, `tailwind-merge` : composition de classes (helpers shadcn standard).

## Docs locales à consulter

Avant d'écrire du code Next.js / Prisma / Auth.js, ouvrir :

- `node_modules/next/dist/docs/` (Next 16)
- `node_modules/prisma/dist/` ou `node_modules/@prisma/client/` (Prisma 7)
- `node_modules/next-auth/` README + docs (Auth.js v5)

Si `node_modules/` n'existe pas → `npm install` d'abord.
