import { describe, it, expect } from 'vitest';
import { toSnakeCase, toCamelCase } from '../src/utils';

describe('toSnakeCase', () => {
  it('converts flat object keys to snake_case', () => {
    expect(toSnakeCase({ apiUrl: 'x', timeoutMs: 10 })).toEqual({
      api_url: 'x',
      timeout_ms: 10,
    });
  });

  it('converts nested object keys recursively', () => {
    expect(toSnakeCase({ outerKey: { innerKey: 'val' } })).toEqual({
      outer_key: { inner_key: 'val' },
    });
  });

  it('converts arrays of objects', () => {
    expect(toSnakeCase([{ fooBar: 1 }, { bazQux: 2 }])).toEqual([
      { foo_bar: 1 },
      { baz_qux: 2 },
    ]);
  });

  it('passes through primitives and null/undefined', () => {
    expect(toSnakeCase(null)).toBe(null);
    expect(toSnakeCase(undefined)).toBe(undefined);
    expect(toSnakeCase(42)).toBe(42);
    expect(toSnakeCase('hello')).toBe('hello');
    expect(toSnakeCase(true)).toBe(true);
  });

  it('handles already snake_case keys', () => {
    expect(toSnakeCase({ already_snake: 1 })).toEqual({ already_snake: 1 });
  });
});

describe('toCamelCase', () => {
  it('converts flat object keys to camelCase', () => {
    expect(toCamelCase({ api_url: 'x', timeout_ms: 10 })).toEqual({
      apiUrl: 'x',
      timeoutMs: 10,
    });
  });

  it('converts nested object keys recursively', () => {
    expect(toCamelCase({ outer_key: { inner_key: 'val' } })).toEqual({
      outerKey: { innerKey: 'val' },
    });
  });

  it('converts arrays of objects', () => {
    expect(toCamelCase([{ foo_bar: 1 }, { baz_qux: 2 }])).toEqual([
      { fooBar: 1 },
      { bazQux: 2 },
    ]);
  });

  it('passes through primitives and null/undefined', () => {
    expect(toCamelCase(null)).toBe(null);
    expect(toCamelCase(undefined)).toBe(undefined);
    expect(toCamelCase(42)).toBe(42);
    expect(toCamelCase('hello')).toBe('hello');
  });

  it('handles already camelCase keys', () => {
    expect(toCamelCase({ alreadyCamel: 1 })).toEqual({ alreadyCamel: 1 });
  });
});
