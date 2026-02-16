import { randomUUID } from 'node:crypto';

export interface ThresholdConfig {
  pass: number;
  flag: number;
  block: number;
}

export interface ConversationTurn {
  role?: string;
  content?: string;
  turnIndex?: number;
  sequenceNumber?: number;
  input?: unknown;
  output?: unknown;
  task?: string;
}

export interface StepRecord {
  stepType: string;
  name: string;
  input: unknown;
  output: unknown;
  durationMs?: number;
  timestamp: string;
}

export interface ExecutionEvent {
  executionId: string;
  agentId: string;
  input: unknown;
  output: unknown;
  steps: StepRecord[];
  metadata: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
  sequenceNumber?: number;
  parentExecutionId?: string;
  conversationHistory?: ConversationTurn[];
  task?: string;
  tokenCount?: number;
  costEstimate?: number;
  latencyMs?: number;
  groundTruth?: unknown;
  schemaDefinition?: Record<string, unknown>;
}

export interface VexResult {
  executionId: string;
  action: 'pass' | 'flag' | 'block';
  confidence: number | null;
  output: unknown;
  corrections: Record<string, unknown>[] | null;
  verification: Record<string, unknown> | null;
  corrected: boolean;
  originalOutput: unknown | null;
}

export function createStepRecord(opts: {
  stepType: string;
  name: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  timestamp?: string;
}): StepRecord {
  return {
    stepType: opts.stepType,
    name: opts.name,
    input: opts.input ?? null,
    output: opts.output ?? null,
    durationMs: opts.durationMs,
    timestamp: opts.timestamp ?? new Date().toISOString(),
  };
}

export function createExecutionEvent(opts: {
  agentId: string;
  input?: unknown;
  output?: unknown;
  executionId?: string;
  steps?: StepRecord[];
  metadata?: Record<string, unknown>;
  timestamp?: string;
  sessionId?: string;
  sequenceNumber?: number;
  parentExecutionId?: string;
  conversationHistory?: ConversationTurn[];
  task?: string;
  tokenCount?: number;
  costEstimate?: number;
  latencyMs?: number;
  groundTruth?: unknown;
  schemaDefinition?: Record<string, unknown>;
}): ExecutionEvent {
  return {
    executionId: opts.executionId ?? randomUUID(),
    agentId: opts.agentId,
    input: opts.input ?? null,
    output: opts.output ?? null,
    steps: opts.steps ?? [],
    metadata: opts.metadata ?? {},
    timestamp: opts.timestamp ?? new Date().toISOString(),
    sessionId: opts.sessionId,
    sequenceNumber: opts.sequenceNumber,
    parentExecutionId: opts.parentExecutionId,
    conversationHistory: opts.conversationHistory,
    task: opts.task,
    tokenCount: opts.tokenCount,
    costEstimate: opts.costEstimate,
    latencyMs: opts.latencyMs,
    groundTruth: opts.groundTruth,
    schemaDefinition: opts.schemaDefinition,
  };
}
