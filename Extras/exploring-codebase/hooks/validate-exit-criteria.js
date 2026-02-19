#!/usr/bin/env node
/**
 * Stop Hook: Validate Exit Criteria
 * 
 * This hook fires when the main agent (orchestrator) attempts to complete
 * the exploring-codebase skill. It validates all exit criteria are met.
 * 
 * Input (stdin): JSON with skill context and state
 * Output (stdout): JSON with decision
 */

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

// Exit criteria checklist
const EXIT_CRITERIA = {
  phase1: [
    { 
      check: (ctx) => ctx.discovery_complete === true,
      name: 'Phase 1 Discovery completed',
      recovery: 'Run discovery-agent to map codebase structure'
    },
    {
      check: (ctx) => ctx.architecture_identified,
      name: 'Architecture pattern identified with evidence',
      recovery: 'Discovery must identify architecture pattern with file references'
    },
    {
      check: (ctx) => ctx.components_enumerated && ctx.components_count > 0,
      name: 'All components/modules enumerated',
      recovery: 'Discovery must list all major components'
    },
    {
      check: (ctx) => ctx.layers_documented,
      name: 'Layers/boundaries documented',
      recovery: 'Discovery must document layer boundaries'
    },
  ],
  phase2: [
    {
      check: (ctx) => ctx.deep_dives_complete === ctx.deep_dives_total && ctx.deep_dives_total > 0,
      name: 'All discovered perspectives explored',
      recovery: `Run deep-dive-agent for remaining perspectives`
    },
    {
      check: (ctx) => ctx.target_found_in_all_areas,
      name: 'Target found and documented in each area',
      recovery: 'Each deep-dive must document target manifestation'
    },
    {
      check: (ctx) => ctx.execution_flows_traced,
      name: 'Execution flows traced with file:line',
      recovery: 'Deep-dives must include execution flow traces'
    },
    {
      check: (ctx) => ctx.integration_points_identified,
      name: 'Integration points identified',
      recovery: 'Deep-dives must document integration points'
    },
  ],
  synthesis: [
    {
      check: (ctx) => ctx.synthesis_complete,
      name: 'Discovery and deep dive integrated',
      recovery: 'Orchestrator must synthesize all findings'
    },
    {
      check: (ctx) => ctx.cross_cutting_insights,
      name: 'Cross-cutting insights identified',
      recovery: 'Synthesis must identify patterns across areas'
    },
    {
      check: (ctx) => ctx.recommendations_specific,
      name: 'Implementation guidance specific',
      recovery: 'Must provide actionable recommendations'
    },
    {
      check: (ctx) => ctx.next_steps_clear,
      name: 'Next steps clear and actionable',
      recovery: 'Must define concrete next steps'
    },
  ]
};

// Parse state tracking from session context
function parseStateTracking(sessionContext) {
  if (!sessionContext) return {};
  
  const state = {};
  
  // Parse SKILL state tracking block
  const stateMatch = sessionContext.match(/SKILL:\s*exploring-codebase[\s\S]*?(?=\n\n|\n[A-Z]|$)/);
  if (stateMatch) {
    const stateBlock = stateMatch[0];
    
    // Parse individual fields
    if (/DISCOVERY_COMPLETE:\s*true/i.test(stateBlock)) {
      state.discovery_complete = true;
    }
    
    const perspectivesMatch = stateBlock.match(/PERSPECTIVES_FOUND:\s*(\d+)/);
    if (perspectivesMatch) {
      state.deep_dives_total = parseInt(perspectivesMatch[1]);
    }
    
    const completedMatch = stateBlock.match(/DEEP_DIVES_COMPLETE:\s*(\d+)\/(\d+)/);
    if (completedMatch) {
      state.deep_dives_complete = parseInt(completedMatch[1]);
      state.deep_dives_total = parseInt(completedMatch[2]);
    }
  }
  
  // Check for key indicators in full context
  state.architecture_identified = /ARCHITECTURE\s*PATTERN[\s\S]*?Pattern:\s*\w+/i.test(sessionContext);
  state.components_enumerated = /COMPONENTS[\s\S]*?\|[^|]+\|[^|]+\|/i.test(sessionContext);
  state.components_count = (sessionContext.match(/^\|\s*\w+\s*\|.*\|.*\|.*\|/gm) || []).length;
  state.layers_documented = /LAYERS[\s\S]*?\|[^|]+\|[^|]+\|/i.test(sessionContext);
  
  // Phase 2 indicators
  state.target_found_in_all_areas = !/TARGET.*not\s*found/i.test(sessionContext);
  state.execution_flows_traced = /EXECUTION\s*FLOW[\s\S]*?Step\s*\d+:/i.test(sessionContext);
  state.integration_points_identified = /INTEGRATION\s*POINTS[\s\S]*?(Outbound|Inbound)/i.test(sessionContext);
  
  // Synthesis indicators
  state.synthesis_complete = /##\s*(Architecture\s*Overview|Exploration\s*Results)/i.test(sessionContext);
  state.cross_cutting_insights = /Cross[- ]Cutting\s*(Patterns|Insights)/i.test(sessionContext);
  state.recommendations_specific = /##\s*Recommendations[\s\S]*?`[^`]+\.(go|ts|js)/i.test(sessionContext);
  state.next_steps_clear = /##\s*Next\s*Steps[\s\S]*?(\d+\.|-).*\w{10,}/i.test(sessionContext);
  
  return state;
}

async function main() {
  try {
    const input = await readStdin();
    const ctx = JSON.parse(input);
    
    const {
      skill_name,
      session_context,
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
    
    // Parse state from context
    const state = parseStateTracking(session_context);
    
    // Collect all failures
    const failures = [];
    
    // Check Phase 1 criteria
    for (const criterion of EXIT_CRITERIA.phase1) {
      if (!criterion.check(state)) {
        failures.push({
          phase: 'Phase 1 (Discovery)',
          criterion: criterion.name,
          recovery: criterion.recovery
        });
      }
    }
    
    // Only check Phase 2 if Phase 1 passed
    if (state.discovery_complete) {
      for (const criterion of EXIT_CRITERIA.phase2) {
        if (!criterion.check(state)) {
          failures.push({
            phase: 'Phase 2 (Deep Dive)',
            criterion: criterion.name,
            recovery: criterion.recovery
          });
        }
      }
    }
    
    // Only check Synthesis if Phase 2 passed
    if (state.deep_dives_complete === state.deep_dives_total && state.deep_dives_total > 0) {
      for (const criterion of EXIT_CRITERIA.synthesis) {
        if (!criterion.check(state)) {
          failures.push({
            phase: 'Phase 3 (Synthesis)',
            criterion: criterion.name,
            recovery: criterion.recovery
          });
        }
      }
    }
    
    // Block if any criteria failed
    if (failures.length > 0) {
      const failureReport = failures.map(f => 
        `  ❌ ${f.criterion}\n     Phase: ${f.phase}\n     Recovery: ${f.recovery}`
      ).join('\n\n');
      
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Cannot complete skill - exit criteria not met.

FAILED CRITERIA:

${failureReport}

Per skill rules: "Incomplete checklist = not done. Do not claim completion."

CURRENT STATE:
- Discovery complete: ${state.discovery_complete || false}
- Deep dives: ${state.deep_dives_complete || 0}/${state.deep_dives_total || '?'}
- Synthesis complete: ${state.synthesis_complete || false}

Complete the required phases before attempting to finish.`
      }));
      return;
    }
    
    // All criteria passed
    console.log(JSON.stringify({ 
      decision: 'approve',
      inject_context: `✅ All exit criteria verified:
- Phase 1: Discovery complete with ${state.components_count} components identified
- Phase 2: ${state.deep_dives_complete}/${state.deep_dives_total} deep dives complete
- Phase 3: Synthesis with cross-cutting insights and recommendations`
    }));
    
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
