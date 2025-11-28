import { describe, it, expect } from 'vitest';
import { createEdge, EDGE_TYPES } from './edge.js';
import type { EdgeType } from './edge.js';

describe('createEdge', () => {
  it('should create an edge with required properties', () => {
    const edge = createEdge({
      source: 'moduleA',
      target: 'moduleB',
      type: 'import',
    });

    expect(edge.source).toBe('moduleA');
    expect(edge.target).toBe('moduleB');
    expect(edge.type).toBe('import');
    expect(edge.metadata).toBeUndefined();
  });

  it('should create an edge with optional metadata', () => {
    const edge = createEdge({
      source: 'moduleA',
      target: 'moduleB',
      type: 'import',
      metadata: { importPath: './moduleB' },
    });

    expect(edge.metadata).toEqual({ importPath: './moduleB' });
  });

  it('should create an immutable edge', () => {
    const edge = createEdge({
      source: 'a',
      target: 'b',
      type: 'call',
    });

    expect(Object.isFrozen(edge)).toBe(true);
  });

  it('should freeze metadata if provided', () => {
    const edge = createEdge({
      source: 'a',
      target: 'b',
      type: 'reference',
      metadata: { line: 42 },
    });

    expect(Object.isFrozen(edge.metadata)).toBe(true);
  });

  it('should support all edge types', () => {
    const edgeTypes: EdgeType[] = [
      'import',
      'export',
      'call',
      'reference',
      'extends',
      'implements',
    ];

    for (const type of edgeTypes) {
      const edge = createEdge({
        source: 'a',
        target: 'b',
        type,
      });
      expect(edge.type).toBe(type);
    }
  });
});

describe('EDGE_TYPES', () => {
  it('should contain all expected edge types', () => {
    expect(EDGE_TYPES).toContain('import');
    expect(EDGE_TYPES).toContain('export');
    expect(EDGE_TYPES).toContain('call');
    expect(EDGE_TYPES).toContain('reference');
    expect(EDGE_TYPES).toContain('extends');
    expect(EDGE_TYPES).toContain('implements');
  });

  it('should have exactly 6 edge types', () => {
    expect(EDGE_TYPES).toHaveLength(6);
  });
});
