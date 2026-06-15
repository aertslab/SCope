# SCope v2 (Modernized)

This is the modernized version of SCope, featuring a FastAPI backend and a React (Vite) frontend.

## Prerequisites

*   Docker and Docker Compose (v2)
*   Python 3.13 (only if running the backend without Docker)
*   Node 20+ (only if running the frontend without Docker)

## Quick start (development)

1.  **Create a backend env file:**

    ```bash
    cp backend/.env.example backend/.env
    ```

    Generate two distinct random secrets and paste them into `JWT_SECRET` and `SESSION_SECRET`:

    ```bash
    python -c "import secrets; print(secrets.token_urlsafe(64))"
    ```

    For local development with the placeholder values you can set `ALLOW_INSECURE_SECRETS=true`. Production deployments must leave it `false` (or unset).

2.  **Start the stack:**

    ```bash
    docker compose up --build
    ```

    This starts:

    *   PostgreSQL on the internal network (port 5432 published to host for dev convenience)
    *   Redis on the internal network (port 6379 published)
    *   Backend API at <http://localhost:8000>
    *   Celery worker
    *   Frontend dev server at <http://localhost:3000>

3.  **Apply database migrations:**

    ```bash
    docker compose exec backend alembic upgrade head
    ```

4.  **Create a superuser:**

    ```bash
    docker compose exec backend python -m app.cli create-superuser \
        --email admin@example.com --password 'choose-something-strong'
    ```

### Running the frontend outside Docker

```bash
cd frontend
npm install
npm run dev   # Vite serves on http://localhost:5173 by default
```

Set `VITE_API_TARGET=http://localhost:8000` if you also run the backend on the host.

## Production deployment

The production compose file (`docker-compose.prod.yml`) differs from the development one in three important ways:

*   The `db` and `redis` services do **not** publish ports — they are reachable only on the internal compose network.
*   Postgres credentials are sourced from `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}` — the file refuses to start if any are missing.
*   The frontend Dockerfile builds a static bundle served by the hardened `frontend/nginx.conf` (HSTS, CSP, X-Frame-Options, etc.).

### Required environment

Provide all of the following before bringing the stack up. The simplest way is a single sibling `.env` file (Docker Compose auto-loads it) plus the populated `backend/.env`:

| Variable | Where | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | sibling `.env` next to `docker-compose.prod.yml` | DB bootstrap + composed `DATABASE_URL` |
| `JWT_SECRET` | `backend/.env` | Signs auth tokens; must be ≥32 random bytes |
| `SESSION_SECRET` | `backend/.env` | Signs Authlib OAuth state; **must differ** from `JWT_SECRET` |
| `FRONTEND_URL` | `backend/.env` | Public HTTPS origin of the SPA |
| `AUTH_COOKIE_SECURE=true` | `backend/.env` | Required when `FRONTEND_URL` is HTTPS |
| `AUTH_COOKIE_SAMESITE` | `backend/.env` | `lax` (same site), `strict`, or `none` (cross-site, requires `secure=true`) |
| `BACKEND_CORS_ORIGINS` | `backend/.env` | JSON array of allowed origins; wildcards rejected at startup |

The backend will refuse to start in any of these conditions:

1.  `JWT_SECRET` or `SESSION_SECRET` is the placeholder/empty value and `ALLOW_INSECURE_SECRETS` is not `true`.
2.  `JWT_SECRET == SESSION_SECRET` and `ALLOW_INSECURE_SECRETS` is not `true`.
3.  `AUTH_COOKIE_SAMESITE=none` with `AUTH_COOKIE_SECURE=false`.
4.  `FRONTEND_URL` starts with `https://` but `AUTH_COOKIE_SECURE=false`.
5.  `BACKEND_CORS_ORIGINS` contains `*`, `null`, or any wildcard entry.

These guard rails exist to make a misconfigured deployment fail loudly instead of silently shipping cleartext sessions.

### Bring it up

```bash
# 1. populate the env files (see backend/.env.example)
cp backend/.env.example backend/.env  # then edit
# 2. populate ./env (POSTGRES_*) — may live alongside the compose file
# 3. build & start
docker compose -f docker-compose.prod.yml up -d --build
# 4. apply migrations on first run / after upgrades
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
# 5. seed the first superuser
docker compose -f docker-compose.prod.yml exec backend python -m app.cli \
    create-superuser --email admin@example.org --password 'strong-pass'
```

Front the `frontend` container with a TLS-terminating reverse proxy (Caddy, Traefik, nginx, an ALB, etc.). The bundled `frontend/nginx.conf` already emits `Strict-Transport-Security: max-age=31536000; includeSubDomains` so browsers will pin HTTPS once they see it over a TLS connection.

### Upgrade procedure

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

`alembic upgrade head` is idempotent. Existing JWTs continue to work after an upgrade unless a migration touches `users.tokens_invalidated_after`; users will simply be asked to log in again.

## Security notes

*   Auth is carried by an **HttpOnly** cookie (`scope_access_token`); the SPA never stores tokens in `localStorage`.
*   Cookie-authenticated mutations require a matching **CSRF double-submit token** (`scope_csrf` cookie + `X-CSRF-Token` header). Bearer/PAT clients are exempt because they aren't browser-driven.
*   Logout, password change, and password reset all bump `users.tokens_invalidated_after`, instantly invalidating every prior JWT for that user.
*   Personal Access Tokens (`scope_pat_…`) are SHA-256 hashed at rest and `last_used_at` is throttled to one write per minute.
*   Admin endpoints redact credentials in `DATABASE_URL` and `REDIS_URL` and the Redis health probe returns only `"reachable"` rather than the host.

## Backend structure

*   `app/main.py` — entry point, middleware wiring (CORS, CSRF, rate limiter, sessions)
*   `app/api/` — versioned API endpoints
*   `app/models/` — SQLAlchemy models
*   `app/schemas/` — Pydantic schemas
*   `app/core/` — config, security, cookies, CSRF, rate limiter
*   `app/worker.py` — Celery tasks
*   `app/cli.py` — operational CLI commands

## Frontend structure

*   `src/pages/` — application pages
*   `src/components/` — reusable components
*   `src/api/` — axios client (cookie-based auth, automatic CSRF header)
*   `src/store/` — Zustand stores

## Database migrations

Generate a new revision (autogenerate from model changes):

```bash
docker compose exec backend alembic revision --autogenerate -m "describe the change"
docker compose exec backend alembic upgrade head
```

Roll back one revision (development only):

```bash
docker compose exec backend alembic downgrade -1
```

## Management commands

### Create superuser

```bash
docker compose exec backend python -m app.cli create-superuser \
    --email admin@example.com --password 'strong-password'
```
