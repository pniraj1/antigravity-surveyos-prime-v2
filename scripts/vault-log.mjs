#!/usr/bin/env node
/**
 * vault-log.mjs
 * Generates a session log in the Obsidian vault using NVIDIA NIM free models.
 *
 * Usage:
 *   node scripts/vault-log.mjs
 *
 * API key — any one of these (checked in order):
 *   1. NVIDIA_API_KEY env var
 *   2. NEXT_PUBLIC_NVIDIA_KEY in .env.local
 *   3. Pass as first argument: node scripts/vault-log.mjs nvapi-xxxx
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VAULT = join(ROOT, 'SurveyOS-Antigravity-Prime-V2-KnowledgeBase');
const SESSIONS_DIR = join(VAULT, 'Sessions');
const TASKS_FILE = join(VAULT, 'Tasks.md');

// ── NVIDIA NIM config ────────────────────────────────────────────────────────
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Llama 3.1 8B is free-tier, fast, good enough for summarization
const MODEL = 'meta/llama-3.1-8b-instruct';

// ── Resolve API key ──────────────────────────────────────────────────────────
function getApiKey() {
  if (process.argv[2]?.startsWith('nvapi-')) return process.argv[2];
  if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY;
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
    const match = env.match(/NVIDIA_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  } catch { /* no .env.local */ }
  return null;
}

// ── Git helpers ──────────────────────────────────────────────────────────────
function git(cmd) {
  try { return execSync(`git -C "${ROOT}" ${cmd}`, { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

function getLastSessionDate() {
  const files = existsSync(SESSIONS_DIR)
    ? execSync(`ls "${SESSIONS_DIR}"`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    : [];
  const dates = files.map(f => f.replace('.md', '')).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.at(-1) ?? null;
}

function gatherContext() {
  const today = new Date().toISOString().slice(0, 10);
  const lastSession = getLastSessionDate();

  // Commits since last session (or last 10 if no prior session)
  const logRange = lastSession ? `--since="${lastSession} 23:59"` : '-10';
  const commits = git(`log ${logRange} --oneline --no-merges`);

  // Files changed (unstaged + staged)
  const status = git('status --short');
  const diffStat = git('diff --stat HEAD');

  // Current branch
  const branch = git('rev-parse --abbrev-ref HEAD');

  // Last session content (for continuity)
  let lastSessionContent = '';
  if (lastSession) {
    const lastFile = join(SESSIONS_DIR, `${lastSession}.md`);
    if (existsSync(lastFile)) {
      lastSessionContent = readFileSync(lastFile, 'utf8').slice(0, 1500);
    }
  }

  // Tasks.md (trimmed)
  const tasks = existsSync(TASKS_FILE)
    ? readFileSync(TASKS_FILE, 'utf8').slice(0, 2000)
    : '';

  return { today, lastSession, commits, status, diffStat, branch, lastSessionContent, tasks };
}

// ── Call NVIDIA NIM ──────────────────────────────────────────────────────────
async function callNvidia(apiKey, prompt) {
  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(ctx) {
  return `You are a developer diary assistant for SurveyOS Prime V2 (a Next.js insurance surveyor app).

Write a concise session log in Obsidian Flavored Markdown for today (${ctx.today}).

## Input

**Branch**: ${ctx.branch}

**Git commits since last session**:
${ctx.commits || '(no new commits — work may be uncommitted)'}

**Uncommitted changes (git status)**:
${ctx.status || '(clean)'}

**Diff stat**:
${ctx.diffStat || '(none)'}

**Current Tasks.md** (truncated):
${ctx.tasks}

**Previous session summary** (${ctx.lastSession ?? 'none'}):
${ctx.lastSessionContent || '(first session)'}

## Instructions
Write ONLY the Markdown content (no code fences). Use Obsidian Flavored Markdown:

Start with YAML frontmatter:
---
date: ${ctx.today}
tags:
  - session-log
branch: ${ctx.branch}
log-model: ${MODEL} (NVIDIA NIM)
---

Then write:
1. A deploy status callout: > [!info] Deploy Status
2. A "What We Did" section — bullet list grouped by feature, use backticks for file paths
3. A "Files Changed" table — file path + one-line description
4. A key decisions callout: > [!tip] Key Decisions  (numbered list inside)
5. An "Open / Next Session" section — checkboxes, use [[Tasks]] wikilink where relevant

Be specific and technical. No fluff.`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('No NVIDIA API key found. Pass it as:\n  node scripts/vault-log.mjs nvapi-xxxx\nor set NVIDIA_API_KEY env var.');
    process.exit(1);
  }

  console.log('Gathering git context...');
  const ctx = gatherContext();
  console.log(`Commits found: ${ctx.commits.split('\n').filter(Boolean).length}`);
  console.log(`Last session: ${ctx.lastSession ?? 'none'}`);

  console.log(`Calling NVIDIA NIM (${MODEL})...`);
  const content = await callNvidia(apiKey, buildPrompt(ctx));

  const outFile = join(SESSIONS_DIR, `${ctx.today}.md`);
  writeFileSync(outFile, content, 'utf8');

  console.log(`\nSession log written: Sessions/${ctx.today}.md`);
  console.log('Open Obsidian to review and edit if needed.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
