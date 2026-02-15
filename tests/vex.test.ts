import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vex } from '../src/vex';
import { ConfigurationError, VexBlockError } from '../src/errors';

const VALID_KEY = 'vex_test_key_1234567890';

function mockFetchResponse(body: Record<string, unknown>, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

function mockFetchError(error: Error): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

describe('Vex', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('throws ConfigurationError for empty API key', () => {
    expect(() => new Vex({ apiKey: '' })).toThrow(ConfigurationError);
    expect(() => new Vex({ apiKey: '' })).toThrow('API key cannot be empty');
  });

  it('throws ConfigurationError for whitespace-only API key', () => {
    expect(() => new Vex({ apiKey: '   ' })).toThrow(ConfigurationError);
    expect(() => new Vex({ apiKey: '   ' })).toThrow('API key cannot be empty');
  });

  it('throws ConfigurationError for too-short API key', () => {
    expect(() => new Vex({ apiKey: 'short' })).toThrow(ConfigurationError);
    expect(() => new Vex({ apiKey: 'short' })).toThrow('too short');
  });

  it('creates with valid key and default config', async () => {
    mockFetchResponse({});
    const vex = new Vex({ apiKey: VALID_KEY });
    expect(vex.config.mode).toBe('async');
    expect(vex.config.apiUrl).toBe('https://api.tryvex.dev');
    await vex.close();
  });

  it('async trace returns pass-through VexResult', async () => {
    mockFetchResponse({});
    const vex = new Vex({ apiKey: VALID_KEY });
    const result = await vex.trace({ agentId: 'a1', input: 'hello' }, (ctx) => {
      ctx.record('world');
    });
    expect(result.action).toBe('pass');
    expect(result.output).toBe('world');
    expect(result.confidence).toBeNull();
    expect(result.corrected).toBe(false);
    expect(typeof result.executionId).toBe('string');
    await vex.close();
  });

  it('sync trace returns server verification result', async () => {
    mockFetchResponse({
      execution_id: 'exec-1',
      confidence: 0.95,
      action: 'pass',
      output: 'verified output',
      checks: { hallucination: { score: 0.95 } },
      corrected: false,
      original_output: null,
      correction_attempts: null,
    });
    const vex = new Vex({ apiKey: VALID_KEY, config: { mode: 'sync' } });
    const result = await vex.trace({ agentId: 'a1', input: 'q' }, (ctx) => {
      ctx.record('answer');
    });
    expect(result.action).toBe('pass');
    expect(result.confidence).toBe(0.95);
    expect(result.output).toBe('verified output');
    expect(result.verification).toEqual({ hallucination: { score: 0.95 } });
    await vex.close();
  });

  it('sync trace throws VexBlockError on block action', async () => {
    mockFetchResponse({
      execution_id: 'exec-2',
      confidence: 0.1,
      action: 'block',
      output: 'blocked',
      checks: {},
      corrected: false,
      original_output: null,
      correction_attempts: null,
    });
    const vex = new Vex({ apiKey: VALID_KEY, config: { mode: 'sync' } });
    await expect(
      vex.trace({ agentId: 'a1' }, (ctx) => {
        ctx.record('bad output');
      }),
    ).rejects.toThrow(VexBlockError);
    await vex.close();
  });

  it('sync trace returns result with warning on flag action', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchResponse({
      execution_id: 'exec-3',
      confidence: 0.45,
      action: 'flag',
      output: 'flagged output',
      checks: {},
      corrected: false,
      original_output: null,
      correction_attempts: null,
    });
    const vex = new Vex({ apiKey: VALID_KEY, config: { mode: 'sync' } });
    const result = await vex.trace({ agentId: 'a1' }, (ctx) => {
      ctx.record('output');
    });
    expect(result.action).toBe('flag');
    expect(result.confidence).toBe(0.45);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('flagged'),
    );
    await vex.close();
  });

  it('sync trace falls through to pass on verification error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchError(new Error('network down'));
    const vex = new Vex({ apiKey: VALID_KEY, config: { mode: 'sync' } });
    const result = await vex.trace({ agentId: 'a1' }, (ctx) => {
      ctx.record('output');
    });
    expect(result.action).toBe('pass');
    expect(result.confidence).toBeNull();
    expect(result.output).toBe('output');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sync verification failed'),
    );
    await vex.close();
  });

  it('sync trace with correction returns corrected result', async () => {
    mockFetchResponse({
      execution_id: 'exec-4',
      confidence: 0.85,
      action: 'pass',
      output: 'corrected output',
      checks: { hallucination: { score: 0.85 } },
      corrected: true,
      original_output: 'original bad output',
      correction_attempts: [{ attempt: 1, output: 'corrected output' }],
    });
    const vex = new Vex({
      apiKey: VALID_KEY,
      config: { mode: 'sync', correction: 'auto' },
    });
    const result = await vex.trace({ agentId: 'a1' }, (ctx) => {
      ctx.record('original bad output');
    });
    expect(result.corrected).toBe(true);
    expect(result.output).toBe('corrected output');
    expect(result.originalOutput).toBe('original bad output');
    expect(result.corrections).toEqual([{ attempt: 1, output: 'corrected output' }]);
    await vex.close();
  });
});
