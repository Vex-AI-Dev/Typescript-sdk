#!/usr/bin/env npx tsx
/**
 * Live smoke test — exercises the full TS SDK → Gateway → Storage pipeline.
 *
 * Runs 6 scenarios against the live API with real LLM scoring:
 *   1. Async ingest       — fire-and-forget trace, no exception
 *   2. Sync pass          — correct answer + ground truth → pass/flag (high conf)
 *   3. Sync flag/block    — wrong answer → flag or block
 *   4. Correction cascade — wrong answer + correction=cascade (transparent)
 *   5. Auto-correct       — wrong answer + correction=cascade (opaque)
 *   6. Multi-turn session — contradictory answers → coherence check
 *
 * Usage:
 *   VEX_API_KEY=ag_live_... npx tsx sdk/typescript/scripts/test_live_smoke.ts
 */

import { Vex, VexBlockError, Session } from '../src/index';
import type { VexResult, VexConfigInput } from '../src/index';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.VEX_API_KEY ?? process.env.AGENTGUARD_API_KEY ?? '';
const API_URL =
  process.env.VEX_API_URL ?? process.env.AGENTGUARD_API_URL ?? 'https://api.tryvex.dev';

if (!API_KEY) {
  console.error('ERROR: Set VEX_API_KEY (or AGENTGUARD_API_KEY) environment variable.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const CYAN = '\x1b[96m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function header(title: string): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${BOLD}${CYAN}${title}${RESET}`);
  console.log(`${'='.repeat(70)}`);
}

function ok(msg: string): void {
  console.log(`  ${GREEN}PASS${RESET}  ${msg}`);
}
function fail(msg: string): void {
  console.log(`  ${RED}FAIL${RESET}  ${msg}`);
}

type ScenarioResult = [boolean, string];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeVex(configOverrides?: VexConfigInput): Vex {
  return new Vex({
    apiKey: API_KEY,
    config: { apiUrl: API_URL, ...configOverrides },
  });
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenario1AsyncIngest(): Promise<ScenarioResult> {
  header('Scenario 1: ASYNC INGEST (fire-and-forget)');
  const vex = makeVex({ mode: 'async' });
  try {
    await vex.trace(
      {
        agentId: 'smoke-test-ts',
        task: 'Summarize quarterly earnings',
        input: { query: 'Summarize Q4 earnings for ACME Corp' },
      },
      (ctx) => {
        ctx.setGroundTruth({ revenue: '$5.2B', profit: '$800M' });
        ctx.record({
          response: 'ACME Corp reported $5.2B in revenue and $800M profit in Q4.',
        });
      },
    );
    await vex.close();
    ok('Async trace completed without exception');
    return [true, 'accepted'];
  } catch (err) {
    fail(`Async trace raised: ${err}`);
    return [false, String(err)];
  }
}

async function scenario2SyncPass(): Promise<ScenarioResult> {
  header('Scenario 2: SYNC VERIFICATION — PASS');
  const vex = makeVex({ mode: 'sync' });

  const result = await vex.trace(
    {
      agentId: 'smoke-test-ts',
      task: 'Answer geography questions accurately',
      input: { query: 'What is the capital of France?' },
    },
    (ctx) => {
      ctx.setGroundTruth('The capital of France is Paris.');
      ctx.record({
        response:
          'The capital of France is Paris. It is known for the Eiffel Tower and the Louvre Museum.',
      });
    },
  );
  await vex.close();

  console.log(`  Action:     ${result.action}`);
  console.log(`  Confidence: ${result.confidence}`);

  if (
    (result.action === 'pass' || result.action === 'flag') &&
    (result.confidence === null || result.confidence >= 0.5)
  ) {
    ok(`action=${result.action}, confidence=${result.confidence}`);
    return [true, result.action];
  }
  fail(`Expected pass/flag (high conf), got action=${result.action} conf=${result.confidence}`);
  return [false, result.action];
}

async function scenario3SyncFlagBlock(): Promise<ScenarioResult> {
  header('Scenario 3: SYNC VERIFICATION — FLAG/BLOCK');
  const vex = makeVex({ mode: 'sync' });

  try {
    const result = await vex.trace(
      {
        agentId: 'smoke-test-ts',
        task: 'Answer geography questions accurately',
        input: { query: 'What is the capital of France?' },
      },
      (ctx) => {
        ctx.setGroundTruth('The capital of France is Paris.');
        ctx.record({
          response:
            'The capital of France is Berlin. France is located in Asia ' +
            'and has a population of 10 billion people. The country was ' +
            'founded in 3024 by Emperor Napoleon XVII.',
        });
      },
    );
    await vex.close();

    console.log(`  Action:     ${result.action}`);
    console.log(`  Confidence: ${result.confidence}`);

    if (result.action === 'flag' || result.action === 'block') {
      ok(`action=${result.action}`);
      return [true, result.action];
    }
    fail(`Expected flag/block, got action=${result.action}`);
    return [false, result.action];
  } catch (err) {
    await vex.close();
    if (err instanceof VexBlockError) {
      ok('VexBlockError raised (action=block)');
      return [true, 'block'];
    }
    fail(`Unexpected error: ${err}`);
    return [false, 'error'];
  }
}

async function scenario4CorrectionCascade(): Promise<ScenarioResult> {
  header('Scenario 4: CORRECTION CASCADE (transparent)');
  const vex = makeVex({
    mode: 'sync',
    correction: 'cascade',
    transparency: 'transparent',
  });

  try {
    const result = await vex.trace(
      {
        agentId: 'smoke-test-ts',
        task: 'Answer geography questions accurately',
        input: { query: 'What is the capital of France?' },
      },
      (ctx) => {
        ctx.setGroundTruth('The capital of France is Paris.');
        ctx.record({
          response:
            'The capital of France is Lyon. It is a beautiful city ' +
            'known for the Eiffel Tower and the Louvre Museum.',
        });
      },
    );
    await vex.close();

    console.log(`  Action:     ${result.action}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Corrected:  ${result.corrected}`);

    if (result.corrected) {
      console.log(`  Output:     ${String(result.output).slice(0, 120)}...`);
      if (result.originalOutput) {
        console.log(`  Original:   ${String(result.originalOutput).slice(0, 120)}...`);
      }
      ok(`corrected=true, action=${result.action}`);
      return [true, 'corrected'];
    }
    fail(`Expected corrected=true, got corrected=${result.corrected}`);
    return [false, `corrected=${result.corrected}`];
  } catch (err) {
    await vex.close();
    if (err instanceof VexBlockError && err.result.corrected) {
      ok('corrected=true (blocked after correction)');
      return [true, 'corrected'];
    }
    fail(`Error: ${err}`);
    return [false, 'error'];
  }
}

async function scenario5AutoCorrect(): Promise<ScenarioResult> {
  header('Scenario 5: AUTO-CORRECT (opaque)');
  const vex = makeVex({
    mode: 'sync',
    correction: 'cascade',
    transparency: 'opaque',
  });

  const original = {
    response:
      'The capital of France is Lyon. It is a beautiful city ' +
      'known for the Eiffel Tower and the Louvre Museum.',
  };

  try {
    const result = await vex.trace(
      {
        agentId: 'smoke-test-ts',
        task: 'Answer geography questions accurately',
        input: { query: 'What is the capital of France?' },
      },
      (ctx) => {
        ctx.setGroundTruth('The capital of France is Paris.');
        ctx.record(original);
      },
    );
    await vex.close();

    console.log(`  Action:     ${result.action}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Corrected:  ${result.corrected}`);

    if (result.corrected) {
      console.log(`  Output:     ${String(result.output).slice(0, 120)}...`);
      if (result.originalOutput === null) {
        ok('Opaque: corrected output returned, original hidden');
      } else {
        ok('Corrected output returned, original_output present');
      }
      if (String(result.output) !== String(original)) {
        ok('Corrected output differs from original');
        return [true, 'auto-corrected'];
      }
      fail('Corrected output is identical to original');
      return [false, 'unchanged'];
    }
    fail(`Expected corrected=true, got corrected=${result.corrected}`);
    return [false, `corrected=${result.corrected}`];
  } catch (err) {
    await vex.close();
    fail(`Error: ${err}`);
    return [false, 'error'];
  }
}

async function scenario6MultiturnSession(): Promise<ScenarioResult> {
  header('Scenario 6: MULTI-TURN SESSION (contradiction)');
  const vex = makeVex({ mode: 'sync' });
  const session = new Session(vex, 'smoke-test-ts-session');

  // Turn 1: correct answer
  const r1 = await session.trace(
    {
      task: 'Answer geography questions accurately',
      input: { query: 'What is the capital of France?' },
    },
    (ctx) => {
      ctx.setGroundTruth('The capital of France is Paris.');
      ctx.record({ response: 'The capital of France is Paris.' });
    },
  );
  console.log(`  Turn 1: action=${r1.action}`);

  // Turn 2: contradictory answer
  try {
    const r2 = await session.trace(
      {
        task: 'Answer geography questions accurately',
        input: { query: 'What is the capital of France?' },
      },
      (ctx) => {
        ctx.setGroundTruth('The capital of France is Paris.');
        ctx.record({
          response:
            'Actually, the capital of France is Marseille. ' +
            'I was wrong before — it has never been Paris.',
        });
      },
    );
    await vex.close();

    console.log(`  Turn 2: action=${r2.action}, confidence=${r2.confidence}`);

    if (r2.action === 'flag' || r2.action === 'block') {
      ok(`Contradiction detected: action=${r2.action}`);
      return [true, r2.action];
    }
    fail(`Expected flag/block on contradiction, got action=${r2.action}`);
    return [false, r2.action];
  } catch (err) {
    await vex.close();
    if (err instanceof VexBlockError) {
      ok('VexBlockError raised on contradictory turn (coherence check)');
      return [true, 'block'];
    }
    fail(`Error: ${err}`);
    return [false, 'error'];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SCENARIOS: [string, () => Promise<ScenarioResult>][] = [
  ['Async Ingest', scenario1AsyncIngest],
  ['Sync Pass', scenario2SyncPass],
  ['Sync Flag/Block', scenario3SyncFlagBlock],
  ['Correction Cascade', scenario4CorrectionCascade],
  ['Auto-Correct (opaque)', scenario5AutoCorrect],
  ['Multi-turn Session', scenario6MultiturnSession],
];

async function main(): Promise<number> {
  console.log(`${BOLD}Vex TypeScript SDK Live Smoke Test${RESET}`);
  console.log(`  API URL: ${API_URL}`);
  console.log(`  API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);

  const results: [string, boolean, string][] = [];

  for (const [name, fn] of SCENARIOS) {
    const t0 = performance.now();
    try {
      const [passed, detail] = await fn();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(`  ${CYAN}(${elapsed}s)${RESET}`);
      results.push([name, passed, detail]);
    } catch (err) {
      fail(`Unhandled exception in ${name}: ${err}`);
      results.push([name, false, 'exception']);
    }
  }

  header('SUMMARY');
  let totalPassed = 0;
  for (const [name, passed, detail] of results) {
    const status = passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`  ${name.padEnd(25)}  [${status}]  ${detail}`);
    if (passed) totalPassed++;
  }

  console.log(`\n  ${BOLD}${totalPassed}/${results.length} scenarios passed${RESET}`);

  if (totalPassed === results.length) {
    console.log(`\n  ${GREEN}${BOLD}ALL SCENARIOS PASSED${RESET}`);
    return 0;
  }
  console.log(`\n  ${RED}${BOLD}SOME SCENARIOS FAILED${RESET}`);
  return 1;
}

main().then((code) => process.exit(code));
