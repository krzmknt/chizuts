import { describe, it, expect } from 'vitest';
import { createNode, NODE_TYPES } from './node.js';
import type { NodeType } from './node.js';

describe('createNode', () => {
  it('should create a node with required properties', () => {
    const node = createNode({
      id: 'test-module#myFunction',
      label: 'myFunction',
      type: 'function',
      filePath: '/src/test.ts',
      line: 10,
      column: 5,
    });

    expect(node.id).toBe('test-module#myFunction');
    expect(node.label).toBe('myFunction');
    expect(node.type).toBe('function');
    expect(node.filePath).toBe('/src/test.ts');
    expect(node.line).toBe(10);
    expect(node.column).toBe(5);
    expect(node.metadata).toBeUndefined();
  });

  it('should create a node with optional metadata', () => {
    const node = createNode({
      id: 'test-module#MyClass',
      label: 'MyClass',
      type: 'class',
      filePath: '/src/test.ts',
      line: 1,
      column: 1,
      metadata: { exported: true, abstract: false },
    });

    expect(node.metadata).toEqual({ exported: true, abstract: false });
  });

  it('should create an immutable node', () => {
    const node = createNode({
      id: 'test',
      label: 'test',
      type: 'variable',
      filePath: '/test.ts',
      line: 1,
      column: 1,
    });

    expect(Object.isFrozen(node)).toBe(true);
  });

  it('should freeze metadata if provided', () => {
    const node = createNode({
      id: 'test',
      label: 'test',
      type: 'function',
      filePath: '/test.ts',
      line: 1,
      column: 1,
      metadata: { key: 'value' },
    });

    expect(Object.isFrozen(node.metadata)).toBe(true);
  });
});

describe('NODE_TYPES', () => {
  it('should contain all expected node types', () => {
    expect(NODE_TYPES).toContain('module');
    expect(NODE_TYPES).toContain('function');
    expect(NODE_TYPES).toContain('class');
    expect(NODE_TYPES).toContain('variable');
    expect(NODE_TYPES).toContain('component');
    expect(NODE_TYPES).toContain('type');
    expect(NODE_TYPES).toContain('interface');
    expect(NODE_TYPES).toContain('enum');
    expect(NODE_TYPES).toContain('method');
    expect(NODE_TYPES).toContain('field');
  });

  it('should have exactly 10 node types', () => {
    expect(NODE_TYPES).toHaveLength(10);
  });

  it('should be a readonly array', () => {
    // TypeScript ensures this at compile time, but we can verify the values don't change
    const types: readonly NodeType[] = NODE_TYPES;
    expect(types).toEqual([
      'module',
      'function',
      'class',
      'variable',
      'component',
      'type',
      'interface',
      'enum',
      'method',
      'field',
    ]);
  });
});
