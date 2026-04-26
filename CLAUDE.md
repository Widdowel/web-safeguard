# web-safeguard — mémoire projet

> Plateforme institutionnelle (gouvernement Bénin / CNIN) qui surveille le trafic sortant national, scanne en profondeur les sites/apps suspects, et bloque ceux qualifiés frauduleux pour toutes les IP du pays.

Ce fichier est le **hub mémoire**. Tous les autres fichiers ci-dessous sont chargés automatiquement par Claude Code à chaque session.

## Imports

@AGENTS.md
@.claude/memory/domain.md
@.claude/memory/stack.md
@.claude/memory/architecture.md
@.claude/memory/conventions.md
@.claude/memory/commands.md
@.claude/memory/decisions.md

## Comment maintenir cette mémoire

- **Quand on prend une décision technique structurante** → ajouter une entrée ADR dans `.claude/memory/decisions.md`.
- **Quand on ajoute une dépendance ou change une version critique** → mettre à jour `.claude/memory/stack.md`.
- **Quand on ajoute un dossier ou une convention** → mettre à jour `.claude/memory/architecture.md` ou `conventions.md`.
- **Quand on ajoute un script npm ou une commande utile** → mettre à jour `.claude/memory/commands.md`.
- **Pour scoper des règles à un sous-dossier** → créer un `CLAUDE.md` dans ce sous-dossier (ex: `app/CLAUDE.md`, `prisma/CLAUDE.md`). Il sera chargé automatiquement quand on bosse dedans.
