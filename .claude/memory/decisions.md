# Décisions techniques (ADR léger)

Format : chaque décision a un numéro, une date, un statut (`accepted` / `superseded by N`), un contexte court, la décision, et les conséquences.

---

## ADR-0001 — Stack : Next.js 16 + Prisma 7 + Auth.js v5 + Tailwind 4

- **Date** : 2026-04-09 (commit initial)
- **Statut** : accepted
- **Contexte** : besoin d'un dashboard d'admin avec auth solide, DB relationnelle, UI moderne. Cible Bénin / régulateur national → audit trail et sécurité critiques.
- **Décision** : Next 16 (App Router, Server Actions stables) + Prisma 7 (typed ORM, migrations) + Auth.js v5 beta (sessions cookie, Credentials + OAuth si besoin) + Tailwind 4 + shadcn 4 (style `base-nova`).
- **Conséquences** : versions très récentes → docs locales à consulter avant tout code (`node_modules/next/dist/docs/`). Auth.js v5 en beta → suivre les releases.

---

## ADR-0002 — Ingestion du trafic via endpoint NDJSON générique

- **Date** : 2026-04-26
- **Statut** : accepted
- **Contexte** : plusieurs sources possibles (FAI, sondes DPI, DNS récursifs nationaux), formats hétérogènes. On ne veut pas se coupler à un fournisseur.
- **Décision** : exposer un endpoint unique `POST /api/ingest/traffic` acceptant du **NDJSON** (1 événement par ligne), authentifié par token API (rotatable). Schéma minimal :
  ```
  { ts, src_ip_hash, dst_domain, dst_ip, bytes, country_iso }
  ```
  Adapters spécifiques (FAI X format propriétaire) ajoutés plus tard si besoin, sans toucher l'endpoint cœur.
- **Conséquences** : chaque source doit hasher l'IP source côté émetteur (ou on l'hache au reçu — à trancher). Rate-limit par token. Ingestion idempotente sur `(ts, src_ip_hash, dst_domain)`.

---

## ADR-0003 — Diffusion de la blocklist en multi-format pull

- **Date** : 2026-04-26
- **Statut** : accepted
- **Contexte** : les FAI / opérateurs DNS ont des stacks différentes (BIND, Unbound, Knot, firewalls custom). Pas question de leur imposer un format.
- **Décision** : la plateforme est l'unique source de vérité ; expose la blocklist en plusieurs formats via endpoints GET dédiés :
  - `/api/blocklist/rpz` → DNS RPZ zone file (BIND/Knot/Unbound)
  - `/api/blocklist/json` → JSON pour intégrations custom
  - `/api/blocklist/hosts` → format `hosts` Unix
  - `/api/blocklist/bgp` → liste de préfixes IP pour blackhole BGP
  - Webhook push optionnel (notifie les FAI quand la liste change).
- **Conséquences** : auth des FAI (token long-lived). Versioning de la blocklist (`If-None-Match` ETag). Génération à la demande ou cache courte durée.

---

## ADR-0004 — Scan profond hybride 3-couches

- **Date** : 2026-04-26
- **Statut** : accepted
- **Contexte** : besoin de détecter les sites/apps frauduleux à grande échelle, sans réinventer ce qui existe.
- **Décision** : pipeline en 3 couches, du moins coûteux au plus coûteux :
  1. **Agrégateur d'APIs externes** : Google Safe Browsing (gratuit), PhishTank (gratuit), urlscan.io (freemium), VirusTotal (freemium). Score combiné.
  2. **Crawler maison léger** : screenshot + DOM fingerprint, WHOIS (âge domaine, registrar), TLS cert (issuer, âge), heuristiques fraude (typosquatting, mots-clés FR/EN, formulaires de paiement non-HTTPS).
  3. **Score ML** (phase ultérieure) : entraîné sur les classifications validées par les analystes.
- **Conséquences** : démarre par la phase 1 (rentabilité maximale, peu de code). Phases 2 et 3 ajoutées progressivement. Chaque couche stocke son verdict séparément → un site a un historique complet de scans.

---

## ADR-0005 — RBAC à 5 rôles

- **Date** : 2026-04-26
- **Statut** : accepted
- **Contexte** : plateforme gouvernementale → séparation des responsabilités obligatoire pour audit.
- **Décision** : 5 rôles : `SUPER_ADMIN`, `ADMIN`, `ANALYST`, `OPERATOR`, `VIEWER`. Cf. `domain.md` pour la matrice de permissions. Implémenté côté serveur via `lib/rbac.ts#requireRole(...)`. Le middleware Next n'effectue qu'un gate auth grossier (présence de cookie session).
- **Conséquences** : chaque Server Action / API route sensible a un appel `requireRole`. Tests d'intégration sur les routes critiques vérifient les 5 rôles + non-authentifié.

---

## ADR-0006 — Hashing IP avec sel rotatif

- **Date** : 2026-04-26
- **Statut** : accepted
- **Contexte** : ingestion de logs trafic = données personnelles (IPs). Impossible de stocker en clair sans risque légal.
- **Décision** : hash HMAC-SHA256 avec sel rotatif périodique (config). Le sel courant et les N précédents sont conservés pour pouvoir re-corréler récemment, mais après expiration du sel l'identifiabilité disparaît.
- **Conséquences** : agrégation par utilisateur fonctionne court terme (sel courant). Long terme : seules les statistiques par domaine restent. Helper `lib/hash.ts#hashIp(ip)`. Sel stocké hors DB principale (env / secrets manager).
