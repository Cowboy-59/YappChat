#!/usr/bin/env node
// One-shot pusher: walks specs/NNN-*/{spec.md,tasks.md} and creates the
// matching document + tasks in the wxKanban MCP project hub.
//
// Usage:
//   node scripts/push-specs-to-mcp.mjs            # push all spec dirs
//   node scripts/push-specs-to-mcp.mjs 002        # push a single spec
//   node scripts/push-specs-to-mcp.mjs --dry-run  # no writes; print plan
//
// Reads creds from .env: WXKANBAN_MCP_BASE_URL, WXKANBAN_API_TOKEN,
// WXKANBAN_PROJECT_ID. Idempotent on titles is NOT guaranteed by the MCP —
// re-running creates duplicate tasks.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env');

function loadEnv() {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const env = loadEnv();
const BASE = (process.env.WXKANBAN_MCP_BASE_URL || env.WXKANBAN_MCP_BASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.WXKANBAN_API_TOKEN || env.WXKANBAN_API_TOKEN;
const PROJECT_ID = process.env.WXKANBAN_PROJECT_ID || env.WXKANBAN_PROJECT_ID;

if (!BASE || !TOKEN || !PROJECT_ID) {
  console.error('[push-specs] missing WXKANBAN_MCP_BASE_URL / WXKANBAN_API_TOKEN / WXKANBAN_PROJECT_ID');
  process.exit(2);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlySpec = args.find(a => /^\d{3}$/.test(a));

async function callTool(tool, toolArgs, attempt = 0) {
  const res = await fetch(`${BASE}/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-WxKanban-Project-Id': PROJECT_ID,
      'User-Agent': 'yappchat-push-specs/1',
    },
    body: JSON.stringify({ tool, args: toolArgs }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429 && attempt < 6) {
    const bodyText = await res.text().catch(() => '');
    let waitSec = 2;
    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed.retryAfterSec === 'number') waitSec = parsed.retryAfterSec;
    } catch { /* ignore */ }
    waitSec = Math.max(waitSec, 1) * Math.pow(2, attempt);
    await new Promise(r => setTimeout(r, waitSec * 1000));
    return callTool(tool, toolArgs, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${tool} HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const body = await res.json();
  const inner = body?.content?.[0]?.text;
  if (typeof inner === 'string') {
    try { return JSON.parse(inner); } catch { return inner; }
  }
  return body;
}

function specDirs() {
  const all = fs.readdirSync(path.join(root, 'specs'), { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map(d => d.name)
    .filter(n => n !== '003-websocket-engine-providing-real-time') // stale stub
    .sort();
  if (onlySpec) return all.filter(n => n.startsWith(`${onlySpec}-`));
  return all;
}

function parseTasks(tasksMd) {
  // Tasks live under "## Task Details" as:
  //   ### TNNN — Title
  //
  //   Description (one or more paragraphs)
  const taskDetailsIdx = tasksMd.indexOf('## Task Details');
  if (taskDetailsIdx < 0) return [];
  const detailsBlock = tasksMd.slice(taskDetailsIdx);
  // Split on the heading boundary so the last block isn't lost (JS regex has no \Z).
  const parts = detailsBlock.split(/^### T(\d{3}) — /m);
  // parts[0] is the preamble; then groups of (number, body) repeat.
  const tasks = [];
  for (let i = 1; i < parts.length; i += 2) {
    const taskNumber = parts[i];
    const body = parts[i + 1] ?? '';
    const nl = body.indexOf('\n');
    const title = (nl === -1 ? body : body.slice(0, nl)).trim();
    const description = (nl === -1 ? '' : body.slice(nl + 1)).trim();
    if (title) tasks.push({ taskNumber, title, description });
  }
  return tasks;
}

function parsePriority(tasksMd, taskNumber) {
  // Pull priority from the summary table row | N | Title | priority | status |
  const rowRe = new RegExp(`^\\|\\s*${parseInt(taskNumber, 10)}\\s*\\|[^|]+\\|\\s*(low|medium|high|critical)\\s*\\|`, 'mi');
  const m = tasksMd.match(rowRe);
  return m ? m[1].toLowerCase() : 'medium';
}

async function pushSpec(dirName) {
  const dir = path.join(root, 'specs', dirName);
  const tasksPath = path.join(dir, 'tasks.md');
  if (!fs.existsSync(tasksPath)) {
    console.warn(`[skip] ${dirName} — missing tasks.md`);
    return { dirName, status: 'skip', reason: 'missing files' };
  }
  const tasksBody = fs.readFileSync(tasksPath, 'utf8');

  const tasks = parseTasks(tasksBody);
  const scope = dirName.slice(0, 3);

  console.log(`[${dirName}] parsed ${tasks.length} tasks`);

  if (dryRun) {
    console.log(`  (dry-run) would create ${tasks.length} tasks via project.create_task`);
    return { dirName, status: 'dry-run', taskCount: tasks.length };
  }

  // The hosted MCP's project.create_specs and project.upsert_document silently
  // no-op on the v0.1.0 server; only project.create_task persists. Push tasks
  // individually with a "[NNN-TXXX]" title prefix so they remain searchable
  // back to the spec dir.
  const created = [];
  for (const t of tasks) {
    const priority = parsePriority(tasksBody, t.taskNumber);
    const titleWithPrefix = `[${scope}-T${t.taskNumber}] ${t.title}`;
    try {
      const res = await callTool('project.create_task', {
        projectId: PROJECT_ID,
        title: titleWithPrefix,
        descriptionMarkdown: t.description || t.title,
        status: 'todo',
        priority,
      });
      const taskId = res?.task?.id;
      if (!taskId) {
        console.warn(`    ⚠ create_task no id for T${t.taskNumber}: ${JSON.stringify(res).slice(0, 200)}`);
        continue;
      }
      created.push({ taskNumber: t.taskNumber, taskId, title: titleWithPrefix });
    } catch (err) {
      console.warn(`    ⚠ create_task failed for T${t.taskNumber}: ${err.message}`);
    }
  }
  console.log(`  ✓ created ${created.length} / ${tasks.length} tasks`);
  return { dirName, status: 'ok', created };
}

async function main() {
  console.log(`\nPushing specs → ${BASE}  (project ${PROJECT_ID})`);
  console.log(dryRun ? '(DRY RUN — no writes)\n' : '');

  const dirs = specDirs();
  console.log(`Found ${dirs.length} spec dir(s): ${dirs.join(', ')}\n`);

  const results = [];
  for (const dir of dirs) {
    try {
      results.push(await pushSpec(dir));
    } catch (err) {
      console.error(`[fail] ${dir}: ${err.message}`);
      results.push({ dirName: dir, status: 'error', error: err.message });
    }
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`  ✓ ${r.dirName}  tasks=${r.created.length}`);
    } else if (r.status === 'dry-run') {
      console.log(`  · ${r.dirName}  (dry-run) tasks=${r.taskCount}`);
    } else {
      console.log(`  ✗ ${r.dirName}  ${r.status}${r.error ? ' — ' + r.error : ''}`);
    }
  }
  const totalTasks = results.reduce((n, r) => n + (r.created?.length ?? 0), 0);
  console.log(`\nTotal tasks created: ${totalTasks}`);
}

main().catch(err => {
  console.error('\n[push-specs] unexpected error:', err);
  process.exit(1);
});
