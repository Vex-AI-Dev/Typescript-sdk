[![npm](https://img.shields.io/npm/v/@vex_dev/sdk)](https://www.npmjs.com/package/@vex_dev/sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Vex-AI-Dev/Typescript-sdk)](https://github.com/Vex-AI-Dev/Typescript-sdk)
[![Docs](https://img.shields.io/badge/docs-docs.tryvex.dev-brightgreen)](https://docs.tryvex.dev)

# Vex TypeScript SDK

**Your AI agent doesn't crash. It drifts.** Vex is the runtime reliability layer that detects when your agent's behavior silently changes in production — before your customers notice.

The agent passes all evals. Ships to production. Works great for a week. Then slowly starts producing subtly different outputs. No error. No crash. No alert. Just quietly doing 90% of the job instead of 100%.

Vex catches that moment.

## What it does

- **Drift Detection** — knows what "normal" looks like for your agent and catches when behavior shifts
- **Execution Tracing** — auto-capture input/output/latency with callbacks. Zero changes to your agent code
- **Sync Verification** — real-time pass/flag/block decisions with configurable confidence thresholds
- **Correction Cascade** — auto-repairs unreliable outputs instead of just blocking them

## See it in action

```bash
npm install @vex_dev/sdk
```

```typescript
import { Vex } from '@vex_dev/sdk';

const vex = new Vex({
  apiKey: process.env.VEX_API_KEY!,
  config: { mode: 'sync' },
});

const result = await vex.trace(
  { agentId: 'support-bot', task: 'handle-ticket', input: 'How do I reset my password?' },
  (ctx) => {
    ctx.record(agentOutput);
  },
);

console.log(result.action);     // 'pass' | 'flag' | 'block'
console.log(result.confidence); // 0.92

// If the agent's response drifts from its baseline behavior,
// Vex flags it before your customer sees it.
```

## Why Vex?

| | Evals / Testing | Tracing (LangSmith etc.) | **Vex** |
|---|---|---|---|
| When | Before deployment | After something breaks | **Continuously in production** |
| What it tells you | "Agent was good" | "Here's what happened" | **"Agent just changed"** |
| Catches drift? | No | No | **Yes** |

Most monitoring tells you the agent ran. Vex tells you the agent changed.

## Detailed Usage

### Quick Start

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

### Multi-Turn Sessions

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

### Correction Cascade

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

## Integrations

Vex works with any AI agent framework. Drop it into:

- **LangChain / LangGraph** agents
- **CrewAI** crews
- **OpenAI Assistants** / function calling
- **Custom agents** — any TypeScript function that calls an LLM

No framework lock-in. If your code calls an LLM, Vex can watch it.

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

## Get Started

1. `npm install @vex_dev/sdk`
2. Get your API key at [tryvex.dev](https://tryvex.dev)
3. Wrap your agent function with `vex.trace()`
4. Deploy. Vex learns what "normal" looks like and alerts you when it changes.

Full docs: [docs.tryvex.dev](https://docs.tryvex.dev)

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

If you find Vex useful, consider starring this repo — it helps others discover it.

## Links

- Website: [tryvex.dev](https://tryvex.dev)
- Docs: [docs.tryvex.dev](https://docs.tryvex.dev)
- Twitter: [@7hakurg](https://x.com/7hakurg)
- Issues: [GitHub Issues](https://github.com/Vex-AI-Dev/Typescript-sdk/issues)

## Requirements

- Node.js 18+ / Deno / Bun
- Zero runtime dependencies

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
