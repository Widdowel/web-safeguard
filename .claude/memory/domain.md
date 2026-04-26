# Domaine métier

## Pitch

Plateforme institutionnelle destinée à un régulateur national (Bénin / CNIN — Centre National d'Informatique et du Numérique). Objectif : protéger les utilisateurs résidents du pays contre la fraude en ligne (financière notamment) en bloquant l'accès aux sites et applications identifiés comme dangereux.

## Pipeline fonctionnel

```
[Sources de trafic] → [Ingestion] → [Identification] → [Scan profond] → [Classification] → [Blocage] → [Diffusion FAI]
```

1. **Ingestion** : les FAI / sondes DPI / DNS récursifs nationaux poussent leurs logs anonymisés vers la plateforme via un endpoint API générique (NDJSON).
2. **Identification** : agrégation par domaine cible et par pays. On remonte les sites/apps avec le plus de trafic depuis le pays.
3. **Scan profond** : pour chaque cible suspecte, batterie d'analyses (cf. `decisions.md` ADR-0004) — agrégateur d'APIs externes (VirusTotal, Google Safe Browsing, urlscan.io, PhishTank), puis crawler maison (screenshot, WHOIS, TLS, heuristiques fraude).
4. **Classification** : un analyste valide / invalide la classification automatique. Statuts : `PENDING`, `SAFE`, `SUSPICIOUS`, `DANGEROUS`, `WHITELISTED`.
5. **Blocage** : un site `DANGEROUS` validé entre dans la blocklist autoritative.
6. **Diffusion** : la blocklist est exposée en plusieurs formats pour que les FAI / opérateurs DNS la consomment (RPZ DNS, JSON, hosts, BGP blackhole). Webhook push optionnel.

## Rôles et autorité

| Rôle | Permissions principales |
|---|---|
| `SUPER_ADMIN` | Tout. Gestion des utilisateurs, configuration système, accès aux logs bruts. |
| `ADMIN` | Gestion utilisateurs (sauf super-admins), configuration des sources d'ingestion, diffusion. |
| `ANALYST` | Examiner les sites scannés, valider classification, demander un re-scan, ajouter notes. |
| `OPERATOR` | Mettre en application les blocages validés (publier blocklist, déclencher webhook). |
| `VIEWER` | Lecture seule des dashboards et rapports. Aucune mutation. |

Toute mutation d'état d'un site (changement de classification, ajout/retrait blocklist) **doit** être tracée dans l'audit log avec : qui, quand, ancien état, nouvel état, justification optionnelle.

## Glossaire

- **RPZ** (Response Policy Zone) : mécanisme DNS (BIND, Knot, Unbound) pour réécrire/bloquer des réponses DNS. Format zone file standard.
- **BGP blackhole** : annonce BGP pour router le trafic d'un préfixe IP vers nulle part (drop niveau backbone).
- **DPI** (Deep Packet Inspection) : sonde réseau qui inspecte le contenu des paquets pour identifier protocole/destination.
- **Typosquatting** : domaine ressemblant à un domaine légitime (ex: `paypa1.com` au lieu de `paypal.com`).
- **PII** : Personally Identifiable Information. IPs utilisateurs en font partie → toujours hashées avec sel rotatif avant stockage.
