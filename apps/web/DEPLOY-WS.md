# Deploying the WebSocket Engine separately — ws.wxperts.com (ECS Express Mode)

Stands up the spec 003 WebSocket engine (`src/server/ws.ts`) as its **own** service
at `ws.wxperts.com`, independent of the YappChat web app. `ws.wxperts.com` is
intended as shared realtime infrastructure reusable by other apps.

**Scope of this runbook:** the WS *service* only — image, ECS Express service,
domain, TLS, ALB hardening. App-side integration (how browsers authenticate to a
cross-domain WS) is intentionally **deferred** — see "Known gap: auth" below.

---

## 0. Prerequisites
- AWS account with ECS Express Mode available (region **us-east-1**, to match `pgkanban` / S3).
- An ECR repo, e.g. `yappchat-ws`.
- A task-execution role and an infrastructure role (the two IAM roles ECS Express requires).
- Access to manage DNS for `wxperts.com` (same place `pgkanban.wxperts.com` is hosted).
- Network reachability from the service to Postgres at `pgkanban.wxperts.com:5432`.

## 1. Build & push the image
Build context is `apps/web` (self-contained npm project; the root `wxkanban`
package is unrelated).
```bash
cd apps/web
docker build -f Dockerfile.ws -t yappchat-ws .

# tag + push to ECR (replace ACCOUNT)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag yappchat-ws:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/yappchat-ws:latest
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/yappchat-ws:latest
```
> Reproducibility follow-up: `apps/web` has no committed lockfile, so the image
> uses `npm install`. Commit an `apps/web/package-lock.json` and switch the
> Dockerfile to `npm ci` when you want byte-reproducible builds.

## 2. Create the ECS Express service
Give Express its three inputs: the image above + the two IAM roles. It provisions
Fargate, a shared ALB with HTTPS:443 + TLS, autoscaling, CloudWatch, and a
`*.ecs.us-east-1.on.aws` URL.

- **Container port:** `3001`
- **Health check path:** `/health` (engine returns `200 {"ok":true,...}`)
- **Visibility:** public (browsers connect directly).

### 2a. Pin to a SINGLE task (required for now)
The engine's default `LocalBroker` keeps presence + event routing **in-process**.
With >1 task, clients on task A never see events published to task B, and the
`/publish` seam lands on a random task. Until the Redis broker is enabled
(Phase 2), set the underlying service autoscaling to **min = max = desired = 1**.
Capacity ceiling is `WS_MAX_CONNECTIONS` (default 1000); the engine emits 70%/90%
capacity alerts as you approach it.

### 2b. Task environment variables
| Var | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgres://…@pgkanban.wxperts.com:5432/yappchat` | Same DB as the app. Put in Secrets Manager / SSM. |
| `WS_PORT` | `3001` | Matches container port + health check. |
| `WS_MAX_CONNECTIONS` | `1000` | Single-process ceiling. |
| `WS_INTERNAL_SECRET` | *(strong random)* | Guards `/publish` `/presence` `/stats` `/sessions`. Secret store. |
| `WS_BROKER` | `local` | Redis path deferred (Phase 2). |
| `NODE_ENV` | `production` | Set in the image; can override here. |

No `.env.local` ships in the image (excluded via `.dockerignore`); the engine's
env-loader only fills vars *not already* set, so the task env always wins.

## 3. Custom domain ws.wxperts.com + TLS
Express hands out an `*.on.aws` URL; map the real subdomain on top of its ALB:
1. **ACM cert** for `ws.wxperts.com` in `us-east-1` (DNS-validated).
2. Add the cert to the Express ALB's **HTTPS:443 listener** (SNI) and add a
   **host-header rule** `ws.wxperts.com → yappchat-ws target group` (the Express
   ALB is shared, so route by host).
3. **DNS**: point `ws.wxperts.com` at the ALB (Route53 alias, or CNAME wherever
   `wxperts.com` DNS lives). ALB supports the WebSocket upgrade natively.

## 4. Harden the internal seam (chosen)
`/publish`, `/presence`, `/stats`, `/sessions/*` are served on the **same port**
as public WebSockets, guarded only by the `x-internal-secret` header. On a public
host they'd be internet-reachable. Add **public-listener rules** (on the
`ws.wxperts.com` host) that return **403** for those paths — allow only `/health`
and the WS upgrade. Consuming apps reach the seam over **private** networking
(VPC service endpoint / the `*.on.aws` URL), never via `https://ws.wxperts.com`.

---

## Known gap: cross-domain auth (deferred — app discussion)
The engine authenticates browser sockets from the `yc_session` **cookie**
(`ws.ts` ~L559). A cookie only travels to the **same site** as the app. Because
`ws.wxperts.com` is a *different* domain from the YappChat app (and is meant to be
shared across apps), browsers will **not** send the cookie to it — so real browser
auth will fail (`close 4401`) until auth is changed.

The infra in this runbook still stands up fully (`/health`, TLS, ALB). The auth
fix — a short-lived signed **ticket** minted by each consuming app and passed in
the WS handshake — touches the engine *and* each app's client, and is deferred
per decision ("just deploy the WS separately, then discuss the app").

---

## Verification
1. `curl https://ws.wxperts.com/health` → `200 {"ok":true,"clients":0}`.
2. `openssl s_client -connect ws.wxperts.com:443 -servername ws.wxperts.com` → cert CN = `ws.wxperts.com`.
3. `curl -i https://ws.wxperts.com/publish` from the public internet → **403** (hardening rule), not 401/200.
4. Internal seam over the private path with the secret header → `200`.
5. CloudWatch shows one task, log line `[ws] engine listening on :3001 (max 1000 conns)`.
6. (After auth is wired) a logged-in browser opens `wss://ws.wxperts.com?...` and receives the `connected` frame.

## Phase 2 — horizontal scale (deferred)
Provision ElastiCache Redis, implement the designed-in `RedisBroker`
(`src/lib/ws/broker.ts`), set `WS_BROKER=redis` + `REDIS_URL`, then lift the
single-task pin and let Express autoscale. No engine logic changes beyond the broker.
