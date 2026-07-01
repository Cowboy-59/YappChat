#!/usr/bin/env node
/**
 * Single-command deploy: `deploy <target> [flags]`.
 *
 * Each deployable is one JSON file in deploy/targets/<name>.json. The command
 * builds the image, pushes it to ECR, then deploys an ECS Express Mode service
 * via CloudFormation (AWS::ECS::ExpressGatewayService) — idempotent, so the same
 * command creates the stack the first time and updates it on every run after.
 *
 * Usage:
 *   deploy <target>              build + push + deploy
 *   deploy <target> --dry-run    render the plan + CFN template, touch nothing
 *   deploy <target> --build-only build the image, skip push + deploy
 *   deploy <target> --no-build   skip build (reuse existing tag), push + deploy
 *   deploy <target> --tag T      image tag (default: git short SHA, else "latest")
 *   deploy <target> --region R   override target.region
 *   deploy <target> --profile P  pass --profile P to every aws call
 *   deploy list                  list available targets
 *
 * No SDKs — shells out to the `docker`, `aws`, and `git` CLIs already on PATH.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEPLOY_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(DEPLOY_DIR, "..");
const TARGETS_DIR = join(DEPLOY_DIR, "targets");
const GENERATED_DIR = join(DEPLOY_DIR, ".generated");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};
const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error(c.red(`\n✗ ${msg}\n`));
  process.exit(1);
};

// ── arg parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else flags[key] = true;
  } else positional.push(a);
}

const targetName = positional[0];
if (!targetName || flags.help || flags.h) {
  log(`${c.bold("deploy")} — build + push + deploy an ECS Express service

  ${c.cyan("deploy <target>")}              build, push to ECR, deploy via CloudFormation
  ${c.cyan("deploy <target> --dry-run")}    print the plan + render the template, no side effects
  ${c.cyan("deploy <target> --build-only")} build image only
  ${c.cyan("deploy <target> --no-build")}   skip build; push + deploy an existing tag
  ${c.cyan("deploy <target> --tag T")}      image tag (default: git short SHA)
  ${c.cyan("deploy <target> --region R")}   override the target region
  ${c.cyan("deploy <target> --profile P")}  AWS named profile
  ${c.cyan("deploy list")}                  list available targets`);
  process.exit(targetName ? 0 : 1);
}

if (targetName === "list") {
  if (!existsSync(TARGETS_DIR)) die("no deploy/targets directory");
  const files = readdirSync(TARGETS_DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) die("no targets defined in deploy/targets/");
  log(c.bold("\nAvailable deploy targets:\n"));
  for (const f of files) {
    const t = JSON.parse(readFileSync(join(TARGETS_DIR, f), "utf8"));
    log(`  ${c.cyan(t.name ?? f.replace(/\.json$/, ""))}  ${c.dim("— " + (t.description ?? ""))}`);
  }
  log("");
  process.exit(0);
}

// ── load + validate target ───────────────────────────────────────────────────
const targetPath = join(TARGETS_DIR, `${targetName}.json`);
if (!existsSync(targetPath)) die(`unknown target "${targetName}" (expected ${targetPath})`);
const target = JSON.parse(readFileSync(targetPath, "utf8"));

const region = flags.region || target.region || "us-east-1";
const profileArgs = flags.profile ? ["--profile", String(flags.profile)] : [];
const dryRun = Boolean(flags["dry-run"]);

for (const req of ["build", "ecr", "express"]) {
  if (!target[req]) die(`target "${targetName}" is missing required "${req}" section`);
}
const ex = target.express;
for (const req of ["serviceName", "executionRoleArn", "infrastructureRoleArn"]) {
  if (!ex[req]) die(`target.express is missing required "${req}"`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function run(cmd, args, { capture = false, allowFail = false } = {}) {
  log(c.dim(`$ ${cmd} ${args.join(" ")}`));
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32", // resolve .cmd shims (docker/aws/git) on Windows
  });
  if (r.error) {
    if (r.error.code === "ENOENT") die(`"${cmd}" not found on PATH`);
    die(`${cmd} failed to start: ${r.error.message}`);
  }
  if (r.status !== 0 && !allowFail) die(`${cmd} exited with code ${r.status}`);
  return { status: r.status, stdout: (r.stdout || "").trim() };
}
const aws = (args, opts) => run("aws", [...args, "--region", region, ...profileArgs], opts);

// Substitute <ACCOUNT_ID> / <REGION> tokens in any string the config carries.
function subst(value, accountId) {
  if (typeof value === "string")
    return value.replaceAll("<ACCOUNT_ID>", accountId).replaceAll("<REGION>", region);
  if (Array.isArray(value)) return value.map((v) => subst(v, accountId));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = subst(v, accountId);
    return out;
  }
  return value;
}

// ── resolve identity + image coordinates ─────────────────────────────────────
let accountId = "<ACCOUNT_ID>";
if (!dryRun) {
  accountId = aws(["sts", "get-caller-identity", "--query", "Account", "--output", "text"], {
    capture: true,
  }).stdout;
  if (!accountId) die("could not resolve AWS account (is `aws` configured / logged in?)");
}

let tag = flags.tag ? String(flags.tag) : "";
if (!tag) {
  const sha = run("git", ["rev-parse", "--short", "HEAD"], { capture: true, allowFail: true });
  tag = sha.status === 0 && sha.stdout ? sha.stdout : "latest";
}
const repo = subst(target.ecr.repository, accountId);
const registry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
const imageRepoUri = `${registry}/${repo}`;
const imageRef = `${imageRepoUri}:${tag}`;
const latestRef = `${imageRepoUri}:latest`;

log(`\n${c.bold("Deploy target:")} ${c.cyan(target.name ?? targetName)}`);
log(`  ${target.description ?? ""}`);
log(`  region   ${region}`);
log(`  image    ${dryRun ? c.yellow(imageRef) : imageRef}`);
log(`  stack    ${ex.stackName ?? ex.serviceName}`);
log(`  tasks    min=${ex.minTaskCount ?? 1} max=${ex.maxTaskCount ?? 1}`);
if (dryRun) log(c.yellow("  (dry-run — no image build/push, no AWS changes)"));

// ── render the CloudFormation template from the target ───────────────────────
const environment = Object.entries(subst(ex.env ?? {}, accountId)).map(([Name, Value]) => ({
  Name,
  Value: String(Value),
}));
const secrets = Object.entries(subst(ex.secrets ?? {}, accountId)).map(([Name, ValueFrom]) => ({
  Name,
  ValueFrom,
}));

const primaryContainer = {
  Image: { Ref: "ImageUri" },
  ContainerPort: ex.containerPort ?? 80,
  ...(environment.length ? { Environment: environment } : {}),
  ...(secrets.length ? { Secrets: secrets } : {}),
};

const serviceProps = {
  ServiceName: ex.serviceName,
  ...(ex.cluster ? { Cluster: ex.cluster } : {}),
  ...(ex.cpu ? { Cpu: String(ex.cpu) } : {}),
  ...(ex.memory ? { Memory: String(ex.memory) } : {}),
  ...(ex.healthCheckPath ? { HealthCheckPath: ex.healthCheckPath } : {}),
  ExecutionRoleArn: subst(ex.executionRoleArn, accountId),
  InfrastructureRoleArn: subst(ex.infrastructureRoleArn, accountId),
  ...(ex.taskRoleArn ? { TaskRoleArn: subst(ex.taskRoleArn, accountId) } : {}),
  ScalingTarget: {
    MinTaskCount: ex.minTaskCount ?? 1,
    MaxTaskCount: ex.maxTaskCount ?? 1,
    ...(ex.autoScalingMetric ? { AutoScalingMetric: ex.autoScalingMetric } : {}),
    ...(ex.autoScalingTargetValue ? { AutoScalingTargetValue: ex.autoScalingTargetValue } : {}),
  },
  PrimaryContainer: primaryContainer,
  ...(target.tags
    ? { Tags: Object.entries(target.tags).map(([Key, Value]) => ({ Key, Value: String(Value) })) }
    : {}),
};

const template = {
  AWSTemplateFormatVersion: "2010-09-09",
  Description: `ECS Express service "${ex.serviceName}" (deploy target: ${targetName})`,
  Parameters: { ImageUri: { Type: "String", Description: "Container image URI to deploy" } },
  Resources: { ExpressService: { Type: "AWS::ECS::ExpressGatewayService", Properties: serviceProps } },
  Outputs: {
    Endpoint: { Description: "Service endpoint URL", Value: { "Fn::GetAtt": ["ExpressService", "Endpoint"] } },
    ServiceArn: { Value: { "Fn::GetAtt": ["ExpressService", "ServiceArn"] } },
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
const templatePath = join(GENERATED_DIR, `${targetName}.cfn.json`);
writeFileSync(templatePath, JSON.stringify(template, null, 2));
log(`\n${c.bold("Rendered CloudFormation template")} → ${c.dim(templatePath)}`);

if (dryRun) {
  log("\n" + JSON.stringify(template, null, 2));
  log(c.yellow(`\nDry run complete. Would deploy stack "${ex.stackName ?? ex.serviceName}" with image ${imageRef}.`));
  process.exit(0);
}

// ── build ────────────────────────────────────────────────────────────────────
if (!flags["no-build"]) {
  const dockerfile = join(target.build.context, target.build.dockerfile);
  log(`\n${c.bold("① Build")}`);
  // Optional build args (target.build.args): baked into the image at build time.
  // Needed for e.g. Next.js NEXT_PUBLIC_* vars, which are inlined into the client
  // bundle at build and can't be set from the runtime task env. <ACCOUNT_ID>/<REGION>
  // tokens are substituted just like env/secret values.
  const buildArgs = Object.entries(target.build.args ?? {}).flatMap(([k, v]) => [
    "--build-arg",
    `${k}=${subst(String(v), accountId)}`,
  ]);
  run("docker", ["build", "-f", dockerfile, ...buildArgs, "-t", imageRef, "-t", latestRef, target.build.context]);
}

if (flags["build-only"]) {
  log(c.green(`\n✓ Built ${imageRef} (build-only; not pushed)`));
  process.exit(0);
}

// ── ensure ECR repo + push ───────────────────────────────────────────────────
log(`\n${c.bold("② Push to ECR")}`);
const exists = aws(["ecr", "describe-repositories", "--repository-names", repo], {
  capture: true,
  allowFail: true,
});
if (exists.status !== 0) {
  log(c.dim(`  repository "${repo}" not found — creating`));
  aws(["ecr", "create-repository", "--repository-name", repo, "--image-scanning-configuration", "scanOnPush=true"]);
}
// docker login to ECR (pipe the token in)
const pw = aws(["ecr", "get-login-password"], { capture: true }).stdout;
const login = spawnSync("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
  input: pw,
  stdio: ["pipe", "inherit", "inherit"],
  shell: process.platform === "win32",
});
if (login.status !== 0) die("docker login to ECR failed");
run("docker", ["push", imageRef]);
run("docker", ["push", latestRef]);

// ── deploy via CloudFormation (create-or-update) ─────────────────────────────
log(`\n${c.bold("③ Deploy (CloudFormation)")}`);
const stackName = ex.stackName ?? ex.serviceName;
aws([
  "cloudformation",
  "deploy",
  "--stack-name",
  stackName,
  "--template-file",
  templatePath,
  "--parameter-overrides",
  `ImageUri=${imageRef}`,
  "--capabilities",
  "CAPABILITY_IAM",
  "CAPABILITY_NAMED_IAM",
  "--no-fail-on-empty-changeset",
]);

// ── report outputs ───────────────────────────────────────────────────────────
const outputs = aws(
  ["cloudformation", "describe-stacks", "--stack-name", stackName, "--query", "Stacks[0].Outputs", "--output", "json"],
  { capture: true, allowFail: true },
);
log(c.green(`\n✓ Deployed "${targetName}" (stack ${stackName})`));
if (outputs.stdout) {
  try {
    for (const o of JSON.parse(outputs.stdout)) log(`  ${o.OutputKey}: ${c.cyan(o.OutputValue)}`);
  } catch {
    /* non-fatal */
  }
}
log(c.dim(`\nCustom domain (e.g. ws.wxperts.com) is mapped separately — see apps/web/DEPLOY-WS.md §3-4.`));
