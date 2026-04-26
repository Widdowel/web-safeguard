# Architecture

## Structure des dossiers (cible)

```
web-safeguard/
├── app/                          # Routes Next.js (App Router)
│   ├── layout.tsx                # Root layout (RSC)
│   ├── page.tsx                  # Page publique (landing)
│   ├── globals.css               # Tailwind 4 entry + @theme tokens
│   ├── login/
│   │   └── page.tsx              # Auth UI (client component)
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Handler Auth.js v5
│   │   ├── ingest/traffic/       # Endpoint NDJSON (token auth)
│   │   └── blocklist/
│   │       ├── rpz/              # GET → DNS RPZ zone
│   │       ├── json/             # GET → JSON
│   │       ├── hosts/            # GET → hosts file
│   │       └── bgp/              # GET → préfixes IP
│   ├── (admin)/                  # Group : layout admin (auth requise)
│   │   ├── dashboard/
│   │   ├── sites/
│   │   ├── blocklist/
│   │   ├── users/
│   │   └── audit/
│   └── generated/                # ⚠️ Auto-généré Prisma — gitignored
├── prisma/
│   ├── schema.prisma             # Source unique du modèle DB
│   ├── migrations/               # Historique des migrations
│   └── seed.ts                   # Seed dev (super-admin initial)
├── lib/
│   ├── prisma.ts                 # Singleton client Prisma (adapter selon env)
│   ├── auth.ts                   # Config Auth.js v5 (providers, callbacks)
│   ├── rbac.ts                   # Helpers permissions par rôle
│   ├── audit.ts                  # Helper audit log
│   ├── hash.ts                   # IP hashing avec sel rotatif
│   └── utils.ts                  # cn() shadcn + utils divers
├── components/
│   ├── ui/                       # Composants shadcn (base-nova)
│   └── …                         # Composants métier
├── hooks/                        # Custom React hooks (client)
├── proxy.ts                 # ✅ Existe — auth gate + redirections
├── auth.ts                       # Re-export depuis lib/auth (convention Auth.js v5)
└── …configs (next.config.ts, tsconfig.json, etc.)
```

## Path aliases (cf. `tsconfig.json` + `components.json`)

| Alias | Cible |
|---|---|
| `@/components` | `./components` |
| `@/components/ui` | `./components/ui` |
| `@/lib` | `./lib` |
| `@/lib/utils` | `./lib/utils` |
| `@/hooks` | `./hooks` |
| `@/*` | `./*` (catch-all) |

## Server Components vs Client Components

- **Par défaut** : tout fichier dans `app/` est Server Component (RSC). Pas de `"use client"`.
- **Client uniquement quand** : event handlers (`onClick`…), hooks d'état (`useState`, `useEffect`), API navigateur (window, localStorage), composants tiers `"use client"`.
- **Pattern** : pousser `"use client"` aussi profond que possible dans l'arbre (composants feuilles), garder les pages/layouts en RSC.

## Mutations : Server Actions, pas API routes

- **Mutations internes** (changer une classification, ajouter une règle, modifier un user) → **Server Actions**. Types end-to-end, validation Zod côté action.
- **API routes** réservées à : intégrations externes (ingestion FAI, diffusion blocklist aux FAI), webhooks, OAuth callbacks.

## Proxy (Next 16 — anciennement middleware)

⚠️ Next 16 a renommé `middleware.ts` → `proxy.ts` (la fonction exportée s'appelle `proxy`).

`proxy.ts` redirige vers `/login` toute requête sans cookie `authjs.session-token` (ou `__Secure-authjs.session-token` en HTTPS), sauf liste blanche : `/`, `/login`, `/api/auth/*`, `/api/public/*`, `/_next/*`, fichiers statiques (`.ext`).

⚠️ Le proxy ne **vérifie pas** le rôle. Le RBAC se fait :
1. Dans les **layouts d'aire** (ex: `app/(admin)/layout.tsx` lit la session et redirige si pas le bon rôle).
2. Dans **chaque Server Action / API route** sensible (helper `lib/rbac.ts#requireRole(role)`).

Ne pas faire confiance au proxy pour le RBAC fin (Next.js peut l'optimiser et il tourne en edge runtime sans accès Prisma).

## Audit log

Toute mutation sensible passe par `lib/audit.ts#logAudit({ actorId, action, target, before, after, reason? })`. Persisté en DB (table `AuditEvent`). Append-only. Jamais d'`UPDATE` ni `DELETE` par l'app.

## Hashing PII

Les IPs utilisateurs ingérées sont **hashées avec sel rotatif** avant stockage. Helper : `lib/hash.ts#hashIp(ip)`. Le sel est rotaté périodiquement (config) → on perd l'identifiabilité long terme tout en gardant l'agrégation court terme.
