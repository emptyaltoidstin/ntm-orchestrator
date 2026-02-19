#!/usr/bin/env node
/**
 * SubagentStop Hook: Validate Subagent Completion
 * 
 * This hook fires when a subagent (discovery or deep-dive) attempts to stop.
 * It validates that the subagent has completed all required sections.
 * 
 * Input (stdin): JSON with subagent context and output
 * Output (stdout): JSON with decision
 */

const readline = require('readline');

// Required sections for discovery agent
const DISCOVERY_REQUIRED_SECTIONS = [
  { pattern: /##\s*DISCOVERY\s*SUMMARY/i, name: 'DISCOVERY SUMMARY' },
  { pattern: /##\s*ARCHITECTURE\s*PATTERN/i, name: 'ARCHITECTURE PATTERN' },
  { pattern: /##\s*COMPONENTS/i, name: 'COMPONENTS/MODULES' },
  { pattern: /##\s*LAYERS/i, name: 'LAYERS/BOUNDARIES' },
  { pattern: /##\s*RECOMMENDED\s*DEEP\s*DIVES/i, name: 'RECOMMENDED DEEP DIVES' },
];

// Required sections for deep-dive agent
const DEEP_DIVE_REQUIRED_SECTIONS = [
  { pattern: /##\s*DEEP\s*DIVE\s*SUMMARY/i, name: 'DEEP DIVE SUMMARY' },
  { pattern: /##\s*ENTRY\s*POINTS/i, name: 'ENTRY POINTS' },
  { pattern: /##\s*EXECUTION\s*FLOW/i, name: 'EXECUTION FLOW' },
  { pattern: /##\s*DATA\s*TRANSFORMATIONS/i, name: 'DATA TRANSFORMATIONS' },
  { pattern: /##\s*INTEGRATION\s*POINTS/i, name: 'INTEGRATION POINTS' },
  { pattern: /##\s*KEY\s*FILES/i, name: 'KEY FILES' },
];

// Patterns that indicate incomplete work
const INCOMPLETE_INDICATORS = [
  { pattern: /TODO:?\s*\[?complete/i, message: 'Contains incomplete TODO' },
  { pattern: /\[to\s*be\s*(filled|completed|added)\]/i, message: 'Contains placeholder brackets' },
  { pattern: /\.\.\.\s*$/m, message: 'Ends with ellipsis (incomplete)' },
  { pattern: /I\s*(will|need\s*to|should)\s*(continue|finish|complete)/i, message: 'Contains future-tense commitment' },
  { pattern: /more\s*(exploration|investigation|analysis)\s*needed/i, message: 'Explicitly states more work needed' },
];

// Patterns that indicate evidence-free claims
const EVIDENCE_FREE_PATTERNS = [
  { pattern: /probably\s+(is|has|uses|works)/i, message: 'Uses "probably" without evidence' },
  { pattern: /likely\s+(is|has|uses|works)/i, message: 'Uses "likely" without evidence' },
  { pattern: /seems?\s+to\s+(be|have|use)/i, message: 'Uses "seems to" without verification' },
  { pattern: /I\s*(think|believe|assume)/i, message: 'Uses assumption language' },
  { pattern: /might\s+(be|have|use)/i, message: 'Uses speculative "might"' },
];

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

function getRequiredSections(agentType) {
  if (agentType === 'discovery-agent') {
    return DISCOVERY_REQUIRED_SECTIONS;
  }
  if (agentType === 'deep-dive-agent') {
    return DEEP_DIVE_REQUIRED_SECTIONS;
  }
  return [];
}

function checkMissingSections(output, requiredSections) {
  const missing = [];
  for (const section of requiredSections) {
    if (!section.pattern.test(output)) {
      missing.push(section.name);
    }
  }
  return missing;
}

function checkIncompleteIndicators(output) {
  const issues = [];
  for (const indicator of INCOMPLETE_INDICATORS) {
    if (indicator.pattern.test(output)) {
      issues.push(indicator.message);
    }
  }
  return issues;
}

function checkEvidenceFreePatterns(output) {
  const issues = [];
  for (const pattern of EVIDENCE_FREE_PATTERNS) {
    const matches = output.match(new RegExp(pattern.pattern, 'gi'));
    if (matches && matches.length > 2) {
      // Allow occasional uncertainty, but flag if pervasive
      issues.push(`${pattern.message} (${matches.length} instances)`);
    }
  }
  return issues;
}

function hasFileLineReferences(output) {
  // Check for file:line patterns like `file.go:45` or `path/file.ts:123`
  const fileLinePattern = /`[^`]+\.(go|ts|js|py|rs|java|rb|php|c|cpp|h):\d+`/gi;
  const matches = output.match(fileLinePattern);
  return matches && matches.length >= 3; // Expect at least 3 references
}

async function main() {
  try {
    const input = await readStdin();
    const ctx = JSON.parse(input);
    
    const {
      skill_name,
      agent_type,
      subagent_output,
      stop_hook_active
    } = ctx;
    
    // Prevent infinite loops
    if (stop_hook_active) {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }
    
    // Only check during exploring-codebase skill
    if (skill_name !== 'exploring-codebase') {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }
    
    // Skip if no output to validate
    if (!subagent_output) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: 'Subagent attempting to stop without producing output. Must complete analysis first.'
      }));
      return;
    }
    
    const output = subagent_output;
    const issues = [];
    
    // Check for required sections
    const requiredSections = getRequiredSections(agent_type);
    const missingSections = checkMissingSections(output, requiredSections);
    if (missingSections.length > 0) {
      issues.push(`Missing required sections: ${missingSections.join(', ')}`);
    }
    
    // Check for incomplete indicators
    const incompleteIssues = checkIncompleteIndicators(output);
    issues.push(...incompleteIssues);
    
    // Check for evidence-free claims (warning, not blocking)
    const evidenceIssues = checkEvidenceFreePatterns(output);
    
    // Check for file:line references
    if (!hasFileLineReferences(output)) {
      issues.push('Insufficient file:line references. All claims must have evidence.');
    }
    
    // Decide based on issues
    if (issues.length > 0) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Subagent output validation failed.

ISSUES FOUND:
${issues.map(i => `- ${i}`).join('\n')}

${evidenceIssues.length > 0 ? `\nWARNINGS (review these):\n${evidenceIssues.map(i => `- ${i}`).join('\n')}\n` : ''}
REQUIRED: Complete all required sections with file:line evidence before stopping.

Per skill rules: "Incomplete checklist = not done. Do not claim completion."

Continue analysis and retry when all sections are complete.`
      }));
      return;
    }
    
    // Passed validation but has warnings
    if (evidenceIssues.length > 0) {
      console.log(JSON.stringify({
        decision: 'approve',
        inject_context: `NOTE: Output contains uncertainty language (${evidenceIssues.length} instances). Consider verifying these claims with code evidence.`
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
