import { describe, it, expect, vi } from 'vitest';
import { createStepRecord, createExecutionEvent } from '../src/models';

describe('createStepRecord', () => {
  it('auto-generates timestamp', () => {
    const step = createStepRecord({
      stepType: 'llm',
      name: 'call_openai',
      input: 'hello',
      output: 'world',
    });
    expect(step.stepType).toBe('llm');
    expect(step.name).toBe('call_openai');
    expect(step.input).toBe('hello');
    expect(step.output).toBe('world');
    expect(typeof step.timestamp).toBe('string');
    // ISO 8601 format
    expect(() => new Date(step.timestamp)).not.toThrow();
  });

  it('allows overriding timestamp', () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const step = createStepRecord({
      stepType: 'tool',
      name: 'search',
      input: 'a',
      output: 'b',
      timestamp: ts,
    });
    expect(step.timestamp).toBe(ts);
  });

  it('records durationMs', () => {
    const step = createStepRecord({
      stepType: 'db_query',
      name: 'fetch_users',
      durationMs: 42,
    });
    expect(step.durationMs).toBe(42);
    expect(step.input).toBeNull();
    expect(step.output).toBeNull();
  });
});

describe('createExecutionEvent', () => {
  it('auto-generates executionId and timestamp with defaults', () => {
    const event = createExecutionEvent({
      agentId: 'agent-1',
      input: 'q',
      output: 'a',
    });
    expect(event.agentId).toBe('agent-1');
    expect(event.input).toBe('q');
    expect(event.output).toBe('a');
    expect(typeof event.executionId).toBe('string');
    expect(event.executionId.length).toBeGreaterThan(0);
    expect(typeof event.timestamp).toBe('string');
    expect(event.steps).toEqual([]);
    expect(event.metadata).toEqual({});
  });

  it('preserves provided fields', () => {
    const event = createExecutionEvent({
      agentId: 'a',
      input: 'i',
      output: 'o',
      executionId: 'custom-id',
      steps: [{ stepType: 'tool', name: 's', input: 'x', output: 'y', timestamp: 't' }],
      metadata: { key: 'val' },
      sessionId: 'sess-1',
      conversationHistory: [{ role: 'user', content: 'hi', turnIndex: 0 }],
    });
    expect(event.executionId).toBe('custom-id');
    expect(event.steps).toHaveLength(1);
    expect(event.metadata).toEqual({ key: 'val' });
    expect(event.sessionId).toBe('sess-1');
    expect(event.conversationHistory).toHaveLength(1);
  });
});
