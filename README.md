# STWR Poissonnerie — API (Phase 1 Auth)

Backend Node.js + MySQL pour le dashboard Next.js [`dashdoard-stwr`](../dashdoard-stwr).  
Phase 1 : **tenants, users, sessions, audit, auth cookie**.  
Phase 2 : **état métier** (`GET/PUT /business`) — stocks, factures, clients, etc. persistés MySQL (JSON par tenant).

## Stack

- Fastify + TypeScript
- Prisma + MySQL 8
- Argon2id
- Sessions serveur (cookie `HttpOnly`)
- Zod + package partagé `@stwr/shared` (RBAC)

## Prérequis

- Node.js ≥ 20
- MySQL 8 (Docker Compose **ou** instance locale)

## Démarrage rapide (MySQL local)

```bash
cp .env.example .env
# Ajuster DATABASE_URL si besoin (ex. mysql://stwr:stwr@127.0.0.1:3306/stwr)

npm install
npm run build -w @stwr/shared
npm run db:generate -w @stwr/api
npm run db:migrate -w @stwr/api   # nécessite apps/api/.env (copié depuis la racine)
cp .env apps/api/.env             # si pas déjà fait
npm run db:seed -w @stwr/api
npm run dev                       # API sur http://localhost:3001
```

Healthcheck : `GET http://localhost:3001/health`

## Docker Compose (local)

```bash
cp .env.example .env
docker compose up --build
```

Démarre MySQL + API (migrate + seed au boot). L’API écoute sur le port **3001**.
MySQL n’est publié que sur `127.0.0.1`.

## Dokploy (OVH)

Deux applications Git séparées : ce repo = **API + MySQL**, `dashdoard-stwr` = **frontend**.

### 1. Backend (ce repo)

- Type **Compose**, fichier `docker-compose.dokploy.yml`
- Variables d’environnement (exemple) :

```bash
MYSQL_ROOT_PASSWORD=...mot-de-passe-fort...
MYSQL_DATABASE=stwr
MYSQL_USER=stwr
MYSQL_PASSWORD=...mot-de-passe-fort...
WEB_ORIGIN=https://dashboard.votre-domaine
SESSION_COOKIE_NAME=stwr_session
COOKIE_SECURE=true
COOKIE_SAMESITE=none
ADMIN_EMAIL=ton-email@stwr.mg
ADMIN_PASSWORD=un-mot-de-passe-fort
ADMIN_NOM=Administrateur
RUN_SEED=true
```

- Domaine du service **`api`** : `https://api.votre-domaine` (HTTPS / Let’s Encrypt dans Dokploy)
- Port conteneur : **3001**

Évitez `@`, `#`, `:` dans `MYSQL_PASSWORD` (interpolé dans `DATABASE_URL`).

`COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` est obligatoire : le navigateur appelle l’API sur un autre sous-domaine (`credentials: include`).

### 2. Frontend (`dashdoard-stwr`)

- Type **Dockerfile** (ou Compose `docker-compose.dokploy.yml`)
- **Build Argument** (et variable) : `NEXT_PUBLIC_API_URL=https://api.votre-domaine`
- Domaine : `https://dashboard.votre-domaine`

`NEXT_PUBLIC_API_URL` est incrusté au **build**. Un changement d’URL impose un rebuild.

### Première mise en ligne

1. Déployer l’API, vérifier `https://api.votre-domaine/health`
2. Déployer le front avec l’URL API définitive
3. Se connecter avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`

Le seed crée (ou met à jour) cet admin et **supprime les anciens comptes démo**. Passer `RUN_SEED=false` ensuite.

## Frontend (repo sibling)

Dans `dashdoard-stwr` :

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev   # http://localhost:3000
```

Le login / administration appellent l’API avec `credentials: "include"` (cookie session).

Le premier compte se crée via `ADMIN_EMAIL` / `ADMIN_PASSWORD` au seed.

## Endpoints Phase 1

| Méthode | Chemin | Notes |
|---------|--------|-------|
| GET | `/health` | DB ping |
| POST | `/auth/login` | rate-limit |
| POST | `/auth/logout` | |
| GET | `/auth/me` | |
| POST | `/auth/session/touch` | idle refresh |
| POST | `/auth/password/change` | |
| POST | `/auth/password/forgot` | |
| POST | `/auth/password/reset` | |
| GET/POST | `/users` | `users.gerer` |
| PATCH | `/users/:id` | incl. reset MDP admin |
| GET | `/admin/roles` | matrice RBAC |
| GET | `/admin/audit` | |
| GET/DELETE | `/admin/sessions` | |
| GET | `/business` | état métier du tenant |
| PUT | `/business` | sync état (écriture selon permissions) |
| POST | `/business/reset` | vide l'état métier (`parametres.gerer`) |

## Variables d’environnement

Voir [`.env.example`](.env.example) :

- `DATABASE_URL`
- `WEB_ORIGIN` (CORS strict, URL exacte du dashboard)
- `SESSION_COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` (optionnel)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOM` (seed)
- `RUN_SEED` (container uniquement)

## Tests

```bash
npm test
```

Couvre : login + cookie, 401 sans session, isolation tenant, refus caissier sur `POST /users`.

## Structure

```
apps/api/           Fastify + Prisma
packages/shared/    Rôles, permissions, schémas Zod
Dockerfile
docker-compose.yml
docker-compose.dokploy.yml
```

## Suite prévue

Découpage CRUD normalisé (tables Prisma par domaine) — l’API `/business` couvre déjà la sync complète en JSON.
