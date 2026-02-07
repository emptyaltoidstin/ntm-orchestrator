#!/usr/bin/env node
/**
 * ntm-orchestrator SubagentStop Hook (v1.0.0)
 *
 * Lightweight completion-evidence check for subagents.
 *
 * Reads the subagent's transcript JSONL to extract the final assistant output,
 * then checks whether completion claims include quality gate evidence.
 *
 * Only blocks when BOTH:
 *   (a) the subagent appears to claim completion, AND
 *   (b) there is no mention of quality gates (typecheck/lint/test) or verification.
 *
 * Exit codes:
 *   0 = allow
 *   2 = block
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

// Skip for NTM-spawned agents — these hooks are for the orchestrator only.
// NTM sets pane titles like "session__cc_1" or "session__cod_2".
const tmuxPane = process.env.TMUX_PANE;
if (tmuxPane && process.env.TMUX) {
  try {
    const title = execFileSync(
      '/usr/bin/tmux',
      ['display-message', '-t', tmuxPane, '-p', '#{pane_title}'],
      { encoding: 'utf8', timeout: 2000 }
    ).trim();
    if (/__(?:cc|cod|gem)_\d+$/.test(title)) {
      process.exit(0);
    }
  } catch {
    // fail-open: can't determine pane title, continue with checks
  }
}

function allow() { process.exit(0); }
function block(msg) {
  process.stderr.write(`BLOCKED: ${msg}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  allow();
}

// Extract the last assistant message text from the transcript JSONL
const transcriptPath = input?.agent_transcript_path;
if (!transcriptPath) {
  allow();
}

let text = '';
try {
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
  // Walk backwards to find the last assistant message with text content
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (entry.type !== 'assistant' || !entry.message?.content) continue;
    const contents = entry.message.content;
    if (!Array.isArray(contents)) continue;
    const textParts = contents
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text);
    if (textParts.length > 0) {
      text = textParts.join('\n').toLowerCase();
      break;
    }
  }
} catch {
  // Can't read transcript -> fail-open
  allow();
}

if (!text) {
  allow();
}

const claimsComplete = /(task\s+complete|completed|done|finished|all\s+set|ready\s+for\s+review)/.test(text);
if (!claimsComplete) {
  allow();
}

const mentionsGates = /(typecheck|lint|unit\s+test|tests?\s+pass|bun\s+run\s+(typecheck|lint|test)|quality\s+gate)/.test(text);
const mentionsVerification = /(verified|verification|reproduced|validated|passes\s+ci|green)/.test(text);

if (!mentionsGates && !mentionsVerification) {
  block(
    'Subagent appears to claim completion without evidence of verification/quality gates. ' +
    'Require explicit gate results (typecheck/lint/test) or verification notes before accepting completion.'
  );
}

allow();
