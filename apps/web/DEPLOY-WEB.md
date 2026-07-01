# Deploying the YappChat web app — www.yappchatt.com (ECS Express Mode)

Stands up the Next.js 16 web app (`apps/web`) as its **own** ECS Express service,
separate from the WebSocket engine ([DEPLOY-WS.md](./DEPLOY-WS.md)). This is the
**social slice** going online first: auth + communities + chat + DMs.

Mirrors the WS engine's installation approach — `node:22-slim`, `npm install` (no
committed lockfile), no baked env (config comes from the ECS task) — and ships
through the same [`deploy`](../../deploy/README.md) framework: one target JSON,
one command.

---

## 0. Prerequisites
- The one-time ECS Express IAM roles already created for the WS engine
  (`yappchat-ecs-execution`, `yappchat-ecs-infrastructure`) — reused here.
- `docker`, `aws` v2, `git` on PATH; AWS creds (or `--profile`).
- Region **us-east-2** (same as the WS target, so app↔engine share a region).
- Network reachability from the app task to: Postgres (`pgkanban.wxperts.com:5432`)
  and the WS engine's internal `/publish` seam.

## 1. Target config
Everything is declared in [`deploy/targets/yappchat.json`](../../deploy/targets/yappchat.json):
image build (context `apps/web`, `Dockerfile`), ECR repo `yappchat-web`, the
Express service (port **3000**, health **`/api/health`**, cpu 512 / mem 1024,
autoscale **1–4** — the app is stateless, unlike the single-pinned WS engine), and
`env` / `secrets`. Fill the `<ACCOUNT_ID>` / `<WS_INTERNAL_HOST>` tokens (account is
auto-substituted at deploy; the WS host is the engine's private address).

## 2. Create the SSM parameters (secrets)
The target references these `ValueFrom` ARNs; create them once (SecureString):
```bash
aws ssm put-parameter --region us-east-2 --type SecureString \
  --name /yappchat/web/DATABASE_URL      --value 'postgres://…@pgkanban.wxperts.com:5432/yappchat'
aws ssm put-parameter --region us-east-2 --type SecureString \
  --name /yappchat/web/WS_INTERNAL_SECRET --value '<MUST MATCH the engine’s WS_INTERNAL_SECRET>'
aws ssm put-parameter --region us-east-2 --type SecureString \
  --name /yappchat/web/GOOGLE_CLIENT_ID     --value '…'
aws ssm put-parameter --region us-east-2 --type SecureString \
  --name /yappchat/web/GOOGLE_CLIENT_SECRET --value '…'
```
> ⚠️ **`WS_INTERNAL_SECRET` MUST equal the WS engine's value** (the SSM value
> `/yappchat/ws/WS_INTERNAL_SECRET`) or the app's `/publish` calls and the browser
> WS-handshake tickets it mints won't verify against the engine.

## 3. Build-time vars (`NEXT_PUBLIC_*`)
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_APP_VERSION` are **inlined
into the client bundle at build time** — they can't be set from the runtime task
env. They live in `target.build.args` and are passed to `docker build --build-arg`
by the deploy framework. `NEXT_PUBLIC_WS_URL` = `wss://ws.wxperts.com` (the live
engine); `NEXT_PUBLIC_SITE_URL` = the app domain.

## 4. Deploy
```powershell
deploy yappchat --dry-run     # render the plan + CloudFormation template, change nothing
deploy yappchat               # build → push to ECR → create/update the ECS Express service
```
(Git-Bash/macOS/Linux: `node deploy/deploy.mjs yappchat …`.) First run creates the
stack (ALB, HTTPS/TLS, target group, autoscaling, CloudWatch) and hands out an
`*.on.aws` URL; later runs just roll the image/config.

## 5. Custom domain www.yappchatt.com + TLS
`yappchatt.com` DNS is in **Route 53** (confirmed — not Cloudflare). Map the real
domain onto the Express ALB (same shape as `ws.wxperts.com`, DEPLOY-WS.md §3):
1. **ACM cert** for `www.yappchatt.com` in `us-east-2` (DNS-validated).
2. Attach the cert to the Express ALB's **HTTPS:443 listener** (SNI) + a host-header
   rule `www.yappchatt.com → yappchat-web target group`.
3. **Route 53** alias `www.yappchatt.com` → the ALB.

## 6. Google SSO prod redirect
Add the prod redirect URI to the wxperts Google OAuth client:
`https://www.yappchatt.com/api/auth/sso/google/callback`. Keep `SITE_URL`
(task env) = `https://www.yappchatt.com` so callback URLs resolve correctly.

## 7. Migrations
The DB is shared with the WS engine and already at migration **0020**. Apply any new
migrations out-of-band before/at deploy: `node scripts/db-migrate.mjs` (idempotent,
records in `yappchat.__migrations`). The image does **not** run migrations on boot.

---

## Verification
1. `curl https://www.yappchatt.com/api/health` → `200 {"ok":true,"service":"yappchat-web"}`.
2. Landing page loads; sign-in / sign-up work (SES sends verification mail).
3. Browser opens `wss://ws.wxperts.com?token=…` and receives the `connected` frame
   (token minted by `GET /api/ws/token`, verified by the engine — secrets match).
4. Send a DM between two accounts → delivered live (app `/publish` → engine → subscriber).
5. CloudWatch shows healthy task(s); scaling 1→N works (stateless app).

## Follow-ups (parity with the WS runbook)
- **Reproducible builds:** commit `apps/web/package-lock.json` and switch the
  Dockerfile to `npm ci` (same follow-up noted for Dockerfile.ws).
- **Image size:** move to Next `output: "standalone"` + a multi-stage build to drop
  dev deps and the full `.next` from the runtime layer (current single-stage mirrors
  the WS image for consistency; optimisation deferred).
