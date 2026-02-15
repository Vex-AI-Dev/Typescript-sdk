import { describe, it, expect } from 'vitest';
import { TraceContext } from '../src/trace';

describe('TraceContext', () => {
  it('records output', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    expect(ctx.getOutput()).toBeUndefined();
    ctx.record('hello');
    expect(ctx.getOutput()).toBe('hello');
  });

  it('sets ground truth', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    expect(ctx.getGroundTruth()).toBeUndefined();
    ctx.setGroundTruth({ expected: 'value' });
    expect(ctx.getGroundTruth()).toEqual({ expected: 'value' });
  });

  it('sets schema', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    expect(ctx.getSchema()).toBeUndefined();
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    ctx.setSchema(schema);
    expect(ctx.getSchema()).toEqual(schema);
  });

  it('records steps', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    ctx.step({ type: 'llm', name: 'call_openai', input: 'prompt', output: 'response' });
    ctx.step({ type: 'tool', name: 'search', input: 'query', output: 'results', durationMs: 150 });
    const steps = ctx.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].stepName).toBe('llm:call_openai');
    expect(steps[1].stepName).toBe('tool:search');
    // Verify getSteps returns a copy
    steps.push(steps[0]);
    expect(ctx.getSteps()).toHaveLength(2);
  });

  it('sets token count and cost estimate', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    expect(ctx.getTokenCount()).toBeUndefined();
    expect(ctx.getCostEstimate()).toBeUndefined();
    ctx.setTokenCount(1500);
    ctx.setCostEstimate(0.003);
    expect(ctx.getTokenCount()).toBe(1500);
    expect(ctx.getCostEstimate()).toBe(0.003);
  });

  it('sets metadata', () => {
    const ctx = new TraceContext({ agentId: 'a1' });
    expect(ctx.getMetadata()).toEqual({});
    ctx.setMetadata('model', 'gpt-4');
    ctx.setMetadata('temperature', 0.7);
    const meta = ctx.getMetadata();
    expect(meta).toEqual({ model: 'gpt-4', temperature: 0.7 });
    // Verify getMetadata returns a copy
    meta.extra = true;
    expect(ctx.getMetadata()).not.toHaveProperty('extra');
  });

  it('builds an ExecutionEvent with all fields', () => {
    const history = [{ role: 'user', content: 'hi', turnIndex: 0 }];
    const ctx = new TraceContext({
      agentId: 'agent-1',
      task: 'summarize',
      input: 'long text',
      sessionId: 'sess-1',
      sequenceNumber: 3,
      parentExecutionId: 'parent-1',
      conversationHistory: history,
    });
    ctx.record('summary');
    ctx.setGroundTruth('expected summary');
    ctx.setSchema({ type: 'string' });
    ctx.setTokenCount(500);
    ctx.setCostEstimate(0.001);
    ctx.setMetadata('model', 'gpt-4');
    ctx.step({ type: 'llm', name: 'summarize', input: 'text', output: 'summary' });

    const event = ctx.buildEvent();
    expect(event.agentId).toBe('agent-1');
    expect(event.task).toBe('summarize');
    expect(event.input).toBe('long text');
    expect(event.output).toBe('summary');
    expect(event.sessionId).toBe('sess-1');
    expect(event.sequenceNumber).toBe(3);
    expect(event.parentExecutionId).toBe('parent-1');
    expect(event.conversationHistory).toEqual(history);
    expect(event.steps).toHaveLength(1);
    expect(event.tokenCount).toBe(500);
    expect(event.costEstimate).toBe(0.001);
    expect(event.groundTruth).toBe('expected summary');
    expect(event.schemaDefinition).toEqual({ type: 'string' });
    expect(event.metadata).toEqual({ model: 'gpt-4' });
    expect(typeof event.executionId).toBe('string');
    expect(typeof event.timestamp).toBe('string');
    expect(typeof event.latencyMs).toBe('number');
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
