// Idempotently apply the yappchat-web WAF (deploy/waf/web-acl.json) and associate
// it with the shared ECS Express gateway ALB.
//
// WHY a script (not the service CloudFormation): ECS Express Mode creates ONE
// shared gateway ALB that fronts BOTH yappchat-web and the WS engine; our service
// stack doesn't own that ALB, so the WebACLAssociation can't live cleanly in it.
// This re-creates the ACL from the checked-in config and (re)associates it — run
// it after first deploy and after any stack teardown/rebuild that rotates the ALB.
//
//   AWS_PROFILE=Andy node deploy/waf/apply-waf.mjs
//
// Safe to re-run: creates the ACL if missing, otherwise updates it to match
// web-acl.json, then associates (idempotent).

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const REGION = "us-east-2";
const here = dirname(fileURLToPath(import.meta.url));
const acl = JSON.parse(readFileSync(join(here, "web-acl.json"), "utf8"));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

if (!process.env.AWS_PROFILE) {
  console.warn("!  AWS_PROFILE not set — run:  AWS_PROFILE=Andy node deploy/waf/apply-waf.mjs\n");
}

const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const runJson = (cmd) => JSON.parse(run(cmd));

// Pass structured/blob payloads via file:// temp files (avoids inline-JSON quoting
// and blob-encoding pitfalls; SearchString stays a literal, as the API expects here).
function ref(name, obj) {
  const p = join(tmpdir(), `yappchat-waf-${name}.json`).replace(/\\/g, "/");
  writeFileSync(p, JSON.stringify(obj));
  return `"file://${p}"`;
}
const rulesRef = ref("rules", acl.Rules);
const defaultRef = ref("default", acl.DefaultAction);
const visRef = ref("vis", acl.VisibilityConfig);
const B = `--scope REGIONAL --region ${REGION}`;

// 1. Resolve the shared ECS Express gateway ALB.
const albArn = run(
  `aws elbv2 describe-load-balancers --region ${REGION} --query "LoadBalancers[?contains(LoadBalancerName,'ecs-express-gateway')].LoadBalancerArn | [0]" --output text`,
).trim();
if (!albArn || albArn === "None") {
  console.error("x  ECS Express gateway ALB not found — deploy the service (deploy yappchat) first.");
  process.exit(1);
}
console.log("ALB :", albArn);

// 2. Create or update the Web ACL to match web-acl.json.
const existing = (runJson(`aws wafv2 list-web-acls ${B} --output json`).WebACLs || []).find((w) => w.Name === acl.Name);
let arn;
if (!existing) {
  console.log("Creating Web ACL:", acl.Name);
  arn = runJson(
    `aws wafv2 create-web-acl --name ${acl.Name} ${B} --description "${acl.Description}" --default-action ${defaultRef} --visibility-config ${visRef} --rules ${rulesRef} --output json`,
  ).Summary.ARN;
} else {
  console.log("Updating Web ACL:", acl.Name);
  arn = existing.ARN;
  const token = runJson(`aws wafv2 get-web-acl --name ${acl.Name} ${B} --id ${existing.Id} --output json`).LockToken;
  run(
    `aws wafv2 update-web-acl --name ${acl.Name} ${B} --id ${existing.Id} --lock-token ${token} --description "${acl.Description}" --default-action ${defaultRef} --visibility-config ${visRef} --rules ${rulesRef}`,
  );
}
console.log("ACL :", arn);

// 3. Associate with the ALB (idempotent; retry the WAF eventual-consistency error).
for (let i = 1; i <= 6; i++) {
  try {
    run(`aws wafv2 associate-web-acl --region ${REGION} --web-acl-arn "${arn}" --resource-arn "${albArn}"`);
    console.log("OK  WAF applied + associated with the gateway ALB.");
    process.exit(0);
  } catch (e) {
    if (i === 6) {
      console.error("x  association failed:", String(e.stderr || e.message).trim());
      process.exit(1);
    }
    console.log(`   association not ready, retrying (${i}/6)...`);
    sleep(8000);
  }
}
