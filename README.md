# web-safeguard

Plateforme institutionnelle de surveillance et de blocage des sites/applications frauduleux pour un régulateur national.

Voir `CLAUDE.md` (et les fichiers `@.claude/memory/*.md`) pour la mémoire projet : domaine, stack, architecture, conventions, décisions techniques.

## Stack

Next.js 16 · React 19 · Prisma 7 · Auth.js v5 (beta) · Tailwind 4 · shadcn (`base-nova`).

## Développement local

```bash
npm install                    # installe les deps + génère le client Prisma (postinstall)
cp .env.example .env           # ajuste les valeurs (voir section ci-dessous)
npx prisma migrate dev         # crée la DB + applique les migrations
npm run db:seed                # crée le super-admin initial
npm run dev                    # http://localhost:3000
```

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres. Local : URL Prisma dev (port 51214). Production : URL Neon (`*.neon.tech`). L'app détecte Neon automatiquement et utilise l'adapter sans WebSocket. |
| `AUTH_SECRET` | ✅ | Min. 32 caractères. `openssl rand -base64 32`. À rotater avant production. |
| `AUTH_URL` | ❌ | Inutile sur Vercel (dérivé de `VERCEL_URL`). À définir uniquement en self-hosted custom. |
| `SEED_SUPER_ADMIN_EMAIL` | ❌ | Email du super-admin initial. Défaut : `admin@web-safeguard.local`. |
| `SEED_SUPER_ADMIN_PASSWORD` | ❌ | Mot de passe du super-admin. Défaut : `ChangeMe!2026`. **À changer dès le premier login.** |
| `IP_HASH_SALT` | ❌ (mais recommandé) | Sel HMAC pour hacher les IPs ingérées. `openssl rand -hex 32`. |
| `INGEST_TOKEN_PEPPER` | ❌ (mais recommandé) | Pepper HMAC pour hacher les tokens d'ingestion en DB. |
| `GOOGLE_SAFE_BROWSING_API_KEY` | ❌ | Active le provider Google Safe Browsing dans le pipeline de scan. |
| `VIRUSTOTAL_API_KEY` | ❌ | Active VirusTotal. |
| `URLSCAN_API_KEY` | ❌ | Active urlscan.io. |
| `PHISHTANK_API_KEY` | ❌ | Optionnel — PhishTank fonctionne sans clé mais avec rate-limit plus strict. |

## Déploiement Vercel

1. Crée une base **Neon** (ou Vercel Postgres, qui est Neon en sous-jacent) — récupère l'URL `postgresql://...neon.tech/...?sslmode=require`.
2. Importe le repo sur Vercel : `vercel link` ou via l'UI `vercel.com/new`.
3. Dans **Project Settings → Environment Variables**, ajoute au minimum `DATABASE_URL` et `AUTH_SECRET` (cf. tableau ci-dessus). Ajoute les clés API des providers de scan que tu veux activer.
4. **Build command** par défaut OK : Vercel exécute `npm install` (déclenche `postinstall: prisma generate`) puis `npm run build` (qui re-génère + `next build`).
5. Déploie. Le premier déploiement va échouer si la DB n'a pas les tables — applique les migrations :
   ```bash
   # Depuis ton PC, avec DATABASE_URL pointant sur Neon
   npx prisma migrate deploy
   npm run db:seed
   ```
6. Reviens sur la production, login avec les creds seed, change le mot de passe.

## Routes

- `/` — landing publique
- `/login` — connexion (Credentials)
- `/dashboard` — vue synthétique (auth requise)
- `/sites`, `/sites/[id]` — sites surveillés + classification
- `/blocklist` — règles actives
- `/audit` — journal d'audit (rôle ANALYST+)
- `/users` — gestion utilisateurs (rôle ADMIN+)
- `POST /api/ingest/traffic` — ingestion NDJSON (token Bearer)
- `GET /api/blocklist/{rpz,json,hosts,bgp}` — diffusion blocklist (token Bearer + ETag)

## Scripts npm

| Script | Description |
|---|---|
| `npm run dev` | Serveur dev (Turbopack). |
| `npm run build` | `prisma generate && next build`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run db:migrate` | `prisma migrate dev` (dev local). |
| `npm run db:deploy` | `prisma migrate deploy` (prod / CI). |
| `npm run db:studio` | GUI Prisma Studio. |
| `npm run db:seed` | Crée le super-admin initial. |
| `npm run db:reset` | ⚠️ Reset complet (dev uniquement). |
