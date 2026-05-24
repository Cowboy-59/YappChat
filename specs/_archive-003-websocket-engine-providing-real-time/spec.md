# Spec 003: Dockerized Flask Layout — Reorganize src/ into client/server

**Spec Number**: 003
**Short Name**: DockerizedFlaskLayout
**Status**: `draft`
**Created**: 2026-05-13
**Depends On**: 002 (amendment dated 2026-05-13)
**Source**: `specs/Project-Scope/003-DockerizedFlaskLayout.md`

---

## Overview

Reorganize the imported `src/` Flask drop into a Docker-ready `client/` + `server/` + `db/` + `data/` layout, drop Windows-only artifacts, and stand up the minimum container scaffold needed to boot the existing 21 Flask routes against SQL Server. This spec executes the structural pivot committed in the 2026-05-13 amendment to Spec 002 (from Windows desktop MSIX to web + Docker), but is scoped strictly to file reorganization and the minimum container plumbing.

This spec does **not** add features, does **not** implement multi-tenancy (deferred to Spec 002 follow-ups), and does **not** replace the auth model (`REMOTE_USER` / dev-login stays in place until the Spec 002 email+password auth work lands).

## Actors

- Primary: Project maintainer / DevOps engineer preparing the TCI-ExpenseManager codebase for containerized deployment. Owns the file moves, the Dockerfile, the compose file, and the smoke tests; definition of done is `docker compose up` working on a clean clone with zero Windows dependencies.
- Secondary: Future application runtime — the Linux container hosting Flask + gunicorn + pyodbc + Microsoft ODBC Driver 18, consuming the layout this spec produces.
- Secondary: Downstream Spec 002 implementers — every engineer working on multi-tenant SaaS features, email/password auth, Azure Blob storage, or production hardening builds on the foundation this spec lays down.
- Secondary: New-contributor developer onboarding to the repo — relies on the resulting README + `.env.example` + `docker compose up` to bootstrap a working local environment with zero Windows dependencies.

## Business Problem

The imported `src/` drop is a Windows-only Flask application packaged for `pywin32` service installation, with hardcoded SQL Server host, port, secret key, and a brace-expansion-broken empty directory. The repository also still contains a v1 prototype (root-level 7-route `app.py`, empty `static/`, empty `data/`) left over from earlier work. Without a clean Docker-ready layout the team cannot run the application on any non-Windows host, cannot stand up reproducible dev environments, and cannot proceed with the Spec 002 multi-tenant SaaS work that depends on a containerized runtime. The cost of leaving this unaddressed is permanent coupling to a Windows host and blocked progress on every downstream Spec 002 feature.

## In Scope (Scope Boundary)

- Move `src/app.py` → `server/app.py`
- Move `src/requirements.txt` → `server/requirements.txt`
- Move `src/templates/*.html` → `client/templates/`
- Create empty `client/static/{css,js,img}/` placeholders
- Move `src/setup_database.sql` → `db/migrations/001_init.sql`
- Move `src/README.txt` → `docs/legacy-windows-deployment.txt` (historical reference)
- Delete `src/install_service.py` (Windows-only service installer)
- Delete `src/START_APP.bat` (Windows-only launcher)
- Delete `src/{templates,static` (broken brace-expansion artifact from unzip)
- Delete root-level prototype: `app.py`, `templates/`, empty `static/`, empty `data/` (superseded by `src/` drop; verified differ on 2026-05-13 — 7-route v1 vs 21-route v2 enterprise drop)
- Add `server/Dockerfile` — python:3.11-slim base; install Microsoft ODBC Driver 18 for Linux + msodbcsql18 + unixodbc-dev; COPY server/; EXPOSE 5000; run via `gunicorn -w 4 -b 0.0.0.0:5000 app:app`
- Add `server/entrypoint.sh` — `wait-for` loop against the database service, then invoke `init_db()` once, then start gunicorn
- Add `docker-compose.yml` — `app` service + `db` service (mssql/server:2022-latest) + named volumes for `receipts` and `logs`
- Add `.env.example` — `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`, `UPLOAD_FOLDER`
- Edit `server/app.py` minimally:
  - Configure `Flask(__name__, template_folder='../client/templates', static_folder='../client/static')`
  - Read `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY` from `os.environ` (no hardcoded values)
  - Connection string: `DRIVER={ODBC Driver 18 for SQL Server};...;Encrypt=yes;TrustServerCertificate=yes` (dev posture; prod hardening separate)
  - `UPLOAD_FOLDER` honors env var, defaults to `/data/uploads`
- Add root `.gitignore` entries for `data/`, `.env`, `__pycache__`, `*.pyc`

## Out of Scope

- Multi-tenant `TenantId` columns and data isolation (deferred to Spec 002 follow-ups)
- Email/password auth implementation (Spec 002)
- Replacing `REMOTE_USER` / dev-login (Spec 002)
- Receipt migration to Azure Blob (Spec 002 OQ-28)
- Production TLS termination (Spec 002 OQ-29)
- Session store / Redis (Spec 002 OQ-30)
- Outbound email channel (Spec 002 OQ-27)
- Production Dockerfile hardening (non-root user, multi-stage builds, pinned base image digests, distroless variant) — separate spec
- CI pipeline, image registry, automated deployment
- Rewriting Flask routes (preserved as-is from `src/app.py`)
- Replacing raw pyodbc with SQLAlchemy/Alembic (Spec 002 OQ-26 confirmed pyodbc stays)
- Splitting inline CSS/JS in `index.html` into separate static assets

## Integration Context

- **Spec 002 (ExpenseManager)** — this spec executes a precondition of the 2026-05-13 amendment to Spec 002. All Spec 002 functional requirements that reference desktop/MSIX are now superseded by web/Docker; the file layout produced by this spec is the foundation those rewrites build on.
- **Imported `src/` drop** — 902-line Flask app, 6 SQL Server tables (DDL idempotent via `IF NOT EXISTS`), 21 routes, embedded `templates/index.html` (57KB with inline CSS/JS), Windows-targeted by way of `pywin32` and hardcoded `C:\Apps\ExpenseManager\` paths.
- **Root v1 prototype** — `app.py` (196 lines, 7 routes, JSON-file storage), `templates/index.html` (38KB), empty `static/`, empty `data/`. Superseded by `src/` drop and slated for deletion in this spec.
- **wxkanban-agent orchestrator** — present at `wxkanban-agent/`; MCP server at `localhost:3002` is the canonical surface for spec creation. CLI shim `bin/wxkanban-agent.cmd` has a Node 24 escape bug and `createspecs` is not registered as a CLI handler (tracked separately, not blocking).
- **Microsoft ODBC Driver 18 for Linux** — Docker image must install via Microsoft apt repo (`packages.microsoft.com`). Layer size ~150MB. Pin and document.

## Constraints

- **C1** — All file moves must preserve git history via `git mv` (not delete+create). Required for blame/log traceability.
- **C2** — Zero feature changes. The 21 routes in `src/app.py` must respond identically after the move; the only edits to `app.py` are the Flask constructor `template_folder`/`static_folder` paths and the `os.environ` config reads.
- **C3** — No production hardening in this spec. Dev posture only (`TrustServerCertificate=yes` in connection string, no non-root user in Dockerfile). Production hardening is a separate downstream spec.
- **C4** — `data/` directory must be gitignored except for `.gitkeep`. Receipts persist via named Docker volume only.
- **C5** — Dockerfile must pin Microsoft ODBC Driver **18** (not 17). Driver 17 reaches EOL within the v1 horizon.
- **C6** — `mssql/server:2022-latest` requires ≥2GB RAM allocated to Docker Desktop. Document in root `README.md`.

## Success Metrics

1. **Smoke boot ≤2 minutes from clean clone** — On a fresh git clone with `.env` copied from `.env.example` and Docker Desktop running, `docker compose up --build` brings up `app` + `db` containers and `/login` responds with HTTP 200 within 120 seconds (excluding image pull time).
2. **All 21 routes responsive** — All 21 Flask routes from the imported `src/app.py` respond against the containerized SQL Server (no 500-class errors) and `init_db()` has populated all 6 tables before the first request reaches gunicorn.
3. **Receipt persistence across restarts** — A test receipt uploaded via `POST /api/transactions/<tid>/receipt` is still retrievable after `docker compose down && docker compose up`, proving the named volume is wired correctly.
4. **Zero Windows-only code paths** — `grep` across the resulting `server/` and `client/` trees finds zero references to `pywin32`, `win32serviceutil`, `C:\Apps\`, or `\\`-only path separators. Final check before merge.
5. **No orphan v1 artifacts** — `git ls-files` shows no top-level `app.py`, `templates/`, empty `static/`, or empty `data/` after the move.

## Functional Requirements

- **FR-Layout-001** — Final tree matches the "Target Layout" section below exactly.
- **FR-Layout-002** — All file moves preserve `git` history (`git mv`, not delete+create).
- **FR-Layout-003** — `server/app.py` reads all configuration from environment variables. No hardcoded `DB_SERVER`, `SERVER_IP`, `APP_PORT`, or `SECRET_KEY` survives the move.
- **FR-Layout-004** — `docker compose up --build` succeeds on a clean clone (no manual setup beyond `cp .env.example .env`).
- **FR-Layout-005** — `data/` directory is gitignored except for `.gitkeep`. Receipt uploads persist via named Docker volume.
- **FR-Layout-006** — Dockerfile pins Microsoft ODBC Driver 18 (not 17).
- **FR-Layout-007** — `entrypoint.sh` waits for `db` healthy before invoking `init_db()` and starting gunicorn.

## Target Layout

```
TCI-ExpenseManager/
├── client/
│   ├── templates/
│   │   ├── index.html
│   │   └── login.html
│   └── static/
│       ├── css/.gitkeep
│       ├── js/.gitkeep
│       └── img/.gitkeep
├── server/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── entrypoint.sh
├── db/
│   └── migrations/
│       └── 001_init.sql
├── data/                    # gitignored runtime volume
│   └── .gitkeep
├── docs/
│   └── legacy-windows-deployment.txt
├── docker-compose.yml
└── .env.example
```

## Risks

- **R1** — The `pyodbc` + `msodbcsql18` install layer in the Dockerfile is the most fragile part of the build. Microsoft's apt repo signing has changed multiple times historically. Mitigation: pin to a known-working install snippet (documented in the Dockerfile header) and verify in CI.
- **R2** — `mssql/server:2022-latest` requires ≥2GB RAM allocated to Docker Desktop, which is above the default on some developer machines. Mitigation: document in root `README.md` and `.env.example`.
- **R3** — Existing `init_db()` in `app.py` is idempotent (uses `IF NOT EXISTS`), but when Spec 002 introduces a real migration tool (Alembic / sqitch / Flyway), this scaffold's "DDL on boot" pattern must be retired. Tracked, not blocking for this spec.
- **R4** — Brace-expansion-broken `src/{templates,static` folder contains only empty nested dirs, but rm-rf on Windows with the literal `{` in the path can be fragile. Mitigation: use `git rm -r` rather than shell `rm -rf`.
- **R5** — Root-level `app.py` deletion may surprise anyone with an in-flight branch referencing it. Mitigation: pre-flight `git branch --all` check before deletion; document in commit message.

## Open Questions

None blocking. The following items are explicitly *deferred to Spec 002 follow-ups* and listed here only for traceability — they are NOT open questions for this spec:

- Outbound email channel (Spec 002 OQ-27) — deferred.
- Receipt storage Azure Blob vs local volume long-term (Spec 002 OQ-28) — this spec uses local volume only; Blob migration is out of scope.
- TLS termination posture (Spec 002 OQ-29) — this spec produces a dev-only container; production reverse proxy / LB decision is downstream.
- Session store / Redis (Spec 002 OQ-30) — single-replica in-memory sessions are acceptable for this spec's dev scope.
- Migration tooling replacement for `init_db()` (Risk R3) — tracked as a follow-up when Spec 002 introduces real migrations.

## Notes

- This spec is intentionally narrow. It is a structural precondition for Spec 002's web/Docker direction, not a delivery of Spec 002 features. Treat the resulting tree as a foundation, not a product.
- The amendment to Spec 002 (re-opening committed decisions OQ-12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26) was landed via direct file edit on 2026-05-13 with explicit user out-of-band authorization, prior to this spec being created via the orchestrator.
