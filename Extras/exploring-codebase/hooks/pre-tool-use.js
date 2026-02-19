#!/usr/bin/env node
/**
 * Pre-Tool-Use Hook: Prevent Grep Shortcuts
 * 
 * This hook fires before Bash tool calls during skill execution.
 * It detects and blocks grep/find shortcuts that bypass systematic discovery.
 * 
 * Input (stdin): JSON with tool context
 * Output (stdout): JSON with decision
 */

const readline = require('readline');

// Shortcut patterns that indicate bypassing discovery
const SHORTCUT_PATTERNS = [
  /grep\s+-r.*\.\s*$/,           // grep -r pattern .
  /grep\s+.*\|\s*head/,          // grep ... | head (quick peek)
  /find\s+.*-name.*\|\s*head/,   // find ... | head (quick peek)
  /rg\s+.*--max-count/,          // ripgrep with max count
  /ag\s+/,                       // silver searcher (often used for quick search)
];

// Legitimate exploration patterns (allowed)
const EXPLORATION_PATTERNS = [
  /find\s+.*-type\s+d/,          // Directory structure discovery
  /ls\s+-la/,                    // Directory listing
  /cat\s+.*README/i,             // Reading documentation
  /cat\s+.*ARCHITECTURE/i,       // Reading architecture docs
  /cat\s+.*CLAUDE\.md/i,         // Reading Claude config
  /head\s+-\d+\s+.*\.md/,        // Reading markdown docs
  /wc\s+-l/,                     // Counting for inventory
];

// Red flag phrases in prompts/context
const RED_FLAG_PHRASES = [
  "just quickly",
  "let me just",
  "quick check",
  "simply grep",
  "just find",
  "faster to",
  "instead of exploring",
  "skip discovery",
];

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

function isShortcutPattern(command) {
  return SHORTCUT_PATTERNS.some(pattern => pattern.test(command));
}

function isExplorationPattern(command) {
  return EXPLORATION_PATTERNS.some(pattern => pattern.test(command));
}

function hasRedFlagPhrase(context) {
  const contextLower = (context || '').toLowerCase();
  return RED_FLAG_PHRASES.some(phrase => contextLower.includes(phrase));
}

function getPhaseFromContext(sessionContext) {
  if (!sessionContext) return 'unknown';
  
  if (sessionContext.includes('PHASE: 1') || 
      sessionContext.includes('phase-1') ||
      sessionContext.includes('Discovery')) {
    return 'phase-1';
  }
  
  if (sessionContext.includes('PHASE: 2') || 
      sessionContext.includes('phase-2') ||
      sessionContext.includes('Deep Dive')) {
    return 'phase-2';
  }
  
  if (sessionContext.includes('DISCOVERY_COMPLETE: true')) {
    return 'phase-2';
  }
  
  return 'unknown';
}

async function main() {
  try {
    const input = await readStdin();
    const ctx = JSON.parse(input);
    
    const {
      skill_name,
      tool_name,
      tool_input,
      session_context,
      agent_type
    } = ctx;
    
    // Only check during exploring-codebase skill
    if (skill_name !== 'exploring-codebase') {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }
    
    // Only check Bash commands
    if (tool_name !== 'Bash') {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }
    
    const command = tool_input?.command || '';
    const phase = getPhaseFromContext(session_context);
    
    // Allow legitimate exploration patterns
    if (isExplorationPattern(command)) {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }
    
    // Check for shortcut patterns during phase 1
    if (phase === 'phase-1' && isShortcutPattern(command)) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Grep/find shortcut detected during Discovery phase.

Per Red Flags table: "Grep is faster for this simple question" is a TRAP.

The command "${command.substring(0, 50)}..." looks like a shortcut that bypasses systematic discovery.

REQUIRED: Complete Phase 1 discovery first. Use directory listing, documentation reading, and component mapping before targeted searches.

If you believe this is legitimate exploration (not a shortcut), rephrase the command to:
1. Use 'find -type d' for directory structure
2. Use 'cat' for reading documentation
3. Use 'ls -la' for inventory

Then retry.`
      }));
      return;
    }
    
    // Check for red flag phrases in context
    if (hasRedFlagPhrase(session_context) || hasRedFlagPhrase(tool_input?.description)) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Red flag phrase detected in reasoning.

Phrases like "just quickly", "let me just", "faster to" indicate rationalization to skip systematic exploration.

Per skill rules: When you catch yourself thinking these phrases, STOP and use the full process.

REQUIRED: Review the Red Flags table in SKILL.md and proceed systematically.`
      }));
      return;
    }
    
    // Check for grep during unknown phase (might be trying to skip discovery entirely)
    if (phase === 'unknown' && isShortcutPattern(command)) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Shortcut command detected before skill phase established.

Cannot determine if Discovery (Phase 1) is complete.

REQUIRED: 
1. Start with Phase 1 Discovery
2. Update state tracking: "PHASE: 1-Discovery"
3. Complete discovery before targeted searches

The exploring-codebase skill requires systematic discovery before targeted exploration.`
      }));
      return;
    }
    
    // All checks passed
    console.log(JSON.stringify({ decision: 'approve' }));
    
  } catch (error) {
    // On error, approve but log warning
    console.error(`Hook error: ${error.message}`);
    console.log(JSON.stringify({ 
      decision: 'approve',
      reason: `Hook encountered error: ${error.message}. Approving by default.`
    }));
  }
}

main();
