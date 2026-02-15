import {
  type ExecutionEvent,
  type StepRecord,
  type ConversationTurn,
  createExecutionEvent,
  createStepRecord,
} from './models';

export interface TraceContextOptions {
  agentId: string;
  task?: string;
  input?: unknown;
  sessionId?: string;
  sequenceNumber?: number;
  parentExecutionId?: string;
  conversationHistory?: ConversationTurn[];
}

export class TraceContext {
  private readonly agentId: string;
  private readonly task?: string;
  private readonly input: unknown;
  private readonly sessionId?: string;
  private readonly sequenceNumber?: number;
  private readonly parentExecutionId?: string;
  private readonly conversationHistory?: ConversationTurn[];
  private readonly startTime: number;
  private output: unknown = undefined;
  private groundTruth: unknown = undefined;
  private schema: Record<string, unknown> | undefined;
  private steps: StepRecord[] = [];
  private metadata: Record<string, unknown> = {};
  private tokenCount: number | undefined;
  private costEstimate: number | undefined;

  constructor(opts: TraceContextOptions) {
    this.agentId = opts.agentId;
    this.task = opts.task;
    this.input = opts.input;
    this.sessionId = opts.sessionId;
    this.sequenceNumber = opts.sequenceNumber;
    this.parentExecutionId = opts.parentExecutionId;
    this.conversationHistory = opts.conversationHistory;
    this.startTime = performance.now();
  }

  record(output: unknown): void {
    this.output = output;
  }

  setGroundTruth(data: unknown): void {
    this.groundTruth = data;
  }

  setSchema(schema: Record<string, unknown>): void {
    this.schema = schema;
  }

  setTokenCount(count: number): void {
    this.tokenCount = count;
  }

  setCostEstimate(cost: number): void {
    this.costEstimate = cost;
  }

  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  step(opts: {
    type: string;
    name: string;
    input?: unknown;
    output?: unknown;
    durationMs?: number;
  }): void {
    this.steps.push(
      createStepRecord({
        stepName: `${opts.type}:${opts.name}`,
        input: typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input ?? ''),
        output: typeof opts.output === 'string' ? opts.output : JSON.stringify(opts.output ?? ''),
        timestamp: opts.durationMs !== undefined ? `${opts.durationMs}ms` : undefined,
      }),
    );
  }

  getOutput(): unknown {
    return this.output;
  }

  getGroundTruth(): unknown {
    return this.groundTruth;
  }

  getSchema(): Record<string, unknown> | undefined {
    return this.schema;
  }

  getSteps(): StepRecord[] {
    return [...this.steps];
  }

  getTokenCount(): number | undefined {
    return this.tokenCount;
  }

  getCostEstimate(): number | undefined {
    return this.costEstimate;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  buildEvent(): ExecutionEvent {
    return createExecutionEvent({
      agentId: this.agentId,
      task: this.task,
      input: this.input,
      output: this.output,
      sessionId: this.sessionId,
      sequenceNumber: this.sequenceNumber,
      parentExecutionId: this.parentExecutionId,
      conversationHistory: this.conversationHistory,
      steps: this.steps,
      tokenCount: this.tokenCount,
      costEstimate: this.costEstimate,
      latencyMs: performance.now() - this.startTime,
      groundTruth: this.groundTruth,
      schemaDefinition: this.schema,
      metadata: this.metadata,
    });
  }
}
