#!/usr/bin/env node
/**
 * ntm-orchestrator SubagentStop Hook (v1.1.0)
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
const lib = require('./lib');

// Skip for NTM-spawned agents — these hooks are for the orchestrator only.
if (lib.isSpawnedAgent()) process.exit(0);

const input = lib.readStdinJSON();
if (!input) lib.allow();

// Extract the last assistant message text from the transcript JSONL
const transcriptPath = input?.agent_transcript_path;
if (!transcriptPath) {
  lib.allow();
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
  lib.allow();
}

if (!text) {
  lib.allow();
}

const claimsComplete = /(task\s+complete|completed|done|finished|all\s+set|ready\s+for\s+review)/.test(text);
if (!claimsComplete) {
  lib.allow();
}

const mentionsGates = /(typecheck|lint|unit\s+test|tests?\s+pass|bun\s+run\s+(typecheck|lint|test)|quality\s+gate)/.test(text);
const mentionsVerification = /(verified|verification|reproduced|validated|passes\s+ci|green)/.test(text);

if (!mentionsGates && !mentionsVerification) {
  lib.block(
    'Subagent appears to claim completion without evidence of verification/quality gates. ' +
    'Require explicit gate results (typecheck/lint/test) or verification notes before accepting completion.'
  );
}

lib.allow();
