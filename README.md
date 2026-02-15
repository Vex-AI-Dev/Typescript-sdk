# Vex TypeScript SDK

The reliability layer for AI agents in production. Zero runtime dependencies.

## Installation

```bash
npm install @vex_dev/sdk
```

## Quick Start

```typescript
import { Vex, VexBlockError } from '@vex_dev/sdk';

const vex = new Vex({ apiKey: process.env.VEX_API_KEY! });

// Async trace (fire-and-forget telemetry)
const result = await vex.trace(
  { agentId: 'my-agent', task: 'Summarize earnings', input: query },
  (ctx) => {
    ctx.setGroundTruth(sourceData);
    ctx.record(agentOutput);
  },
);

// Sync verification (inline scoring)
const vexSync = new Vex({
  apiKey: process.env.VEX_API_KEY!,
  config: { mode: 'sync' },
});

try {
  const result = await vexSync.trace(
    { agentId: 'my-agent', task: 'Answer questions' },
    (ctx) => {
      ctx.setGroundTruth('The capital of France is Paris.');
      ctx.record('The capital of France is Paris.');
    },
  );
  console.log(result.action); // 'pass' | 'flag' | 'block'
} catch (err) {
  if (err instanceof VexBlockError) {
    console.log('Blocked:', err.result.confidence);
  }
}

await vexSync.close();
```

## Multi-Turn Sessions

```typescript
import { Vex, Session } from '@vex_dev/sdk';

const vex = new Vex({ apiKey: process.env.VEX_API_KEY!, config: { mode: 'sync' } });
const session = new Session(vex, 'my-agent');

// Turn 1
await session.trace({ task: 'Q&A', input: 'What is X?' }, (ctx) => {
  ctx.record('X is ...');
});

// Turn 2 — conversation history automatically included
await session.trace({ task: 'Q&A', input: 'Tell me more' }, (ctx) => {
  ctx.record('More about X ...');
});

await vex.close();
```

## Correction Cascade

```typescript
const vex = new Vex({
  apiKey: process.env.VEX_API_KEY!,
  config: {
    mode: 'sync',
    correction: 'cascade',
    transparency: 'transparent', // or 'opaque' for silent replacement
  },
});

const result = await vex.trace(
  { agentId: 'my-agent', task: 'Answer accurately' },
  (ctx) => {
    ctx.setGroundTruth('Paris is the capital of France.');
    ctx.record('Lyon is the capital of France.'); // wrong — will be corrected
  },
);

console.log(result.corrected); // true
console.log(result.output); // corrected answer
console.log(result.originalOutput); // original wrong answer (transparent mode)
```

## Configuration

```typescript
const vex = new Vex({
  apiKey: 'ag_live_...',
  config: {
    mode: 'async',              // 'async' | 'sync'
    correction: 'none',         // 'none' | 'cascade'
    transparency: 'opaque',     // 'opaque' | 'transparent'
    apiUrl: 'https://api.tryvex.dev',
    timeoutMs: 10_000,
    flushIntervalMs: 1_000,
    flushBatchSize: 50,
    conversationWindowSize: 10,
    confidenceThreshold: {
      pass: 0.8,
      flag: 0.5,
      block: 0.3,
    },
  },
});
```

## Requirements

- Node.js 18+ / Deno / Bun
- Zero runtime dependencies

## License

Apache-2.0
