# Conventions

## Code

1. **Server Components par défaut.** `"use client"` uniquement si interactivité. Pousser le client le plus profond possible.
2. **Strict TypeScript, zéro `any`.** Si vraiment nécessaire, justifier en commentaire (`// any: <raison>`). `unknown` autorisé partout.
3. **Validation runtime des entrées.** Schémas Zod pour : body API, params URL, env vars (parsées au boot via `lib/env.ts`), payload Server Actions.
4. **Server Actions** pour les mutations (au lieu d'API routes maison). API routes réservées aux intégrations externes (ingestion FAI, diffusion blocklist, webhooks, OAuth).
5. **RBAC partout côté serveur.** Chaque Server Action / API route sensible commence par `requireRole("ANALYST" | "ADMIN" | …)` (helper `lib/rbac.ts`). Ne pas se fier au middleware.
6. **Audit log obligatoire** sur toute mutation sensible. Helper `logAudit()` appelé dans la même transaction que la mutation.
7. **Pas de PII en clair dans les logs.** IPs hashées (`lib/hash.ts#hashIp`). Emails masqués partiellement si affichés en logs (`j***@example.com`).

## Naming

- **Fichiers** : `kebab-case.ts` / `kebab-case.tsx` (sauf composants : `PascalCase.tsx`).
- **Composants** : `PascalCase`.
- **Server Actions** : verbe d'action en `camelCase` (`updateSiteClassification`, `publishBlocklist`).
- **Tables Prisma** : `PascalCase` singulier (`Site`, `BlockRule`, `AuditEvent`). Champs `camelCase`.
- **Types** : `PascalCase`. Préfixe `T` interdit (TUser → User). Énums : `SCREAMING_SNAKE_CASE` pour les valeurs.

## Commits

- **Anglais uniquement.** Format Conventional Commits :
  - `feat: add traffic ingestion endpoint`
  - `fix: prevent double-publish of blocklist`
  - `chore: bump prisma to 7.7.1`
  - `refactor: extract rbac helpers to lib/rbac.ts`
  - `docs: clarify scan pipeline in domain.md`
  - `test: add coverage for hash.ts salt rotation`
- **Scope optionnel** : `feat(blocklist): expose RPZ format`.
- **Pas de commit géant.** Une intention = un commit.

## UI / UX

- **Textes utilisateur en français.** L'audience est béninoise.
- **Codebase en anglais** (variables, fonctions, fichiers, commits, comments).
- **shadcn obligatoire** pour les primitives UI (Button, Input, Dialog, etc.). Style `base-nova` (cf. `components.json`).
- **Accessibilité** : tout interactif au clavier, labels ARIA sur les contrôles non-textuels.

## Tests

- **Unit tests obligatoires** sur `lib/` (logique pure : `hash.ts`, `rbac.ts`, parsers, validators).
- **Integration tests obligatoires** sur :
  - Routes auth (`/api/auth/*`, login flow)
  - Endpoints blocklist (formats RPZ/JSON/hosts/BGP)
  - Endpoint ingestion (`/api/ingest/traffic`) — auth token, rate limit, parsing NDJSON.
- **Pas de tests E2E à 100% partout.** On les ajoute sur les parcours critiques uniquement (login, valider une classification, publier la blocklist).

## Comments

- **Par défaut : aucun commentaire.** Code self-documenting via noms clairs.
- **Comment uniquement quand** : invariant non-évident, workaround pour un bug spécifique (avec lien), contrainte cachée.
- **Jamais** : "what" du code (les noms suffisent), références au PR/ticket courant (ça pourrit).
