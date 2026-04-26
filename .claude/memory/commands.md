# Commandes utiles

## Setup initial (une fois)

```bash
npm install                       # installe toutes les deps
npx prisma generate               # génère le client Prisma dans app/generated/prisma
npx prisma migrate dev --name init# crée la première migration
npm run db:seed                   # (à créer) seed le super-admin initial
```

## Dev quotidien

```bash
npm run dev                       # next dev (http://localhost:3000)
npm run lint                      # eslint
npm run build                     # next build (vérifie types + bundle)
npx tsc --noEmit                  # typecheck seul, sans build
```

## Prisma

```bash
npx prisma studio                 # GUI navigateur pour la DB
npx prisma migrate dev --name <description>   # nouvelle migration en dev
npx prisma migrate deploy         # applique en prod (CI/CD)
npx prisma generate               # régénère le client après changement de schéma
npx prisma db push                # ⚠️ uniquement en exploration locale, sans migration
npx prisma format                 # formate schema.prisma
```

## Local DB (Prisma local dev server)

L'URL `.env` pointe sur le serveur Prisma dev local (port `51214`). Démarré automatiquement par Prisma 7. Si problème :

```bash
npx prisma dev                    # lance/relance le serveur dev local
```

## Auth.js v5 — debug

```bash
# Vérifier que AUTH_SECRET est défini
node -e "console.log(process.env.AUTH_SECRET ? 'OK' : 'MISSING')"

# Générer un nouveau secret pour rotation
openssl rand -base64 32
```

## Git

```bash
git status
git diff
git log --oneline -20
git push -u origin claude/work-on-project-0x4NV
```

## Scripts npm à ajouter (TODO)

À ajouter dans `package.json#scripts` quand on en aura besoin :

- `"typecheck": "tsc --noEmit"`
- `"db:migrate": "prisma migrate dev"`
- `"db:generate": "prisma generate"`
- `"db:studio": "prisma studio"`
- `"db:seed": "tsx prisma/seed.ts"`
- `"test": "vitest"` (si on choisit Vitest plus tard)
- `"test:watch": "vitest --watch"`
