# `deploy` — one command, many targets

Build, push, and deploy any containerized service to **AWS ECS Express Mode** with
a single command. Each deployable is one JSON file in [`targets/`](targets/).

```powershell
deploy websocket              # build → push to ECR → deploy/update the ECS Express service
deploy websocket --dry-run    # render the plan + CloudFormation template, change nothing
deploy list                   # list available targets
```

> Windows (PowerShell/cmd): use `deploy …` (via `deploy.cmd` at repo root).
> Git-Bash / macOS / Linux: run `node deploy/deploy.mjs …` (a root `deploy` file
> can't coexist with the `deploy/` directory on Windows, so there's no shim).

## How it works
1. **Build** the image from the target's Dockerfile/context.
2. **Push** to ECR (auto-creates the repo if missing). Tags `:<git-sha>` and `:latest`.
3. **Deploy** an `AWS::ECS::ExpressGatewayService` via CloudFormation — **idempotent**:
   the first run creates the stack (ALB, HTTPS/TLS, target group, autoscaling,
   CloudWatch), every later run just rolls the image/config.

The CloudFormation template is **generated from the target JSON** into
`deploy/.generated/<name>.cfn.json` (gitignored) — no template to hand-maintain.

## Flags
| Flag | Effect |
|------|--------|
| `--dry-run` | Print the plan + write the rendered template. No build/push/AWS calls. |
| `--build-only` | Build the image, stop (no push/deploy). |
| `--no-build` | Skip build; push + deploy an existing tag. |
| `--tag T` | Image tag (default: `git rev-parse --short HEAD`, else `latest`). |
| `--region R` | Override `target.region`. |
| `--profile P` | Pass `--profile P` to every `aws` call. |

## Adding a target
Drop a `targets/<name>.json`. Schema (see [`targets/websocket.json`](targets/websocket.json)):

```jsonc
{
  "name": "yappchat",                       // logical name (deploy yappchat)
  "description": "…",
  "region": "us-east-1",
  "build": { "context": "apps/web", "dockerfile": "Dockerfile" },
  "ecr": { "repository": "yappchat-web" },
  "express": {
    "stackName": "yappchat-web",            // CloudFormation stack
    "serviceName": "yappchat-web",
    "cpu": "512", "memory": "1024",
    "containerPort": 3000,
    "healthCheckPath": "/api/health",
    "minTaskCount": 1, "maxTaskCount": 4,   // app is stateless → can autoscale
    "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/…",
    "infrastructureRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/…",
    "env":     { "NODE_ENV": "production" },                 // plaintext
    "secrets": { "DATABASE_URL": "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:parameter/…" } // ValueFrom
  },
  "tags": { "project": "yappchat" }
}
```

- `<ACCOUNT_ID>` and `<REGION>` tokens in any string are substituted at deploy time.
- `env` → plaintext container env. `secrets` → ECS secrets pulled from SSM/Secrets
  Manager `ValueFrom` ARNs (the execution role needs read access).
- **Stateful services** (like the WS engine on `LocalBroker`) must set
  `minTaskCount = maxTaskCount = 1`. See [apps/web/DEPLOY-WS.md](../apps/web/DEPLOY-WS.md).

## Prerequisites
- `docker`, `aws` (v2), and `git` on PATH; AWS credentials configured (or `--profile`).
- IAM execution + infrastructure roles created once (referenced by every target).

## Not handled here (one-time, per service)
Custom domain + TLS (e.g. `ws.wxperts.com`) and any ALB hardening rules are mapped
once on the ECS-managed ALB — see [apps/web/DEPLOY-WS.md](../apps/web/DEPLOY-WS.md) §3–4.
