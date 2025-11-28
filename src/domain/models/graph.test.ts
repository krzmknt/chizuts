import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDependencyGraph, createGraphMetadata } from './graph.js';
import type { Node, Edge } from './index.js';

describe('createGraphMetadata', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create metadata with required properties', () => {
    const metadata = createGraphMetadata({
      rootDir: '/project',
    });

    expect(metadata.rootDir).toBe('/project');
    expect(metadata.analyzedAt).toBe('2024-01-15T10:30:00.000Z');
    expect(metadata.fileCount).toBe(0);
    expect(metadata.version).toBe('0.1.0');
  });

  it('should create metadata with optional fileCount', () => {
    const metadata = createGraphMetadata({
      rootDir: '/project',
      fileCount: 42,
    });

    expect(metadata.fileCount).toBe(42);
  });

  it('should create metadata with optional version', () => {
    const metadata = createGraphMetadata({
      rootDir: '/project',
      version: '1.0.0',
    });

    expect(metadata.version).toBe('1.0.0');
  });

  it('should create immutable metadata', () => {
    const metadata = createGraphMetadata({
      rootDir: '/project',
    });

    expect(Object.isFrozen(metadata)).toBe(true);
  });
});

describe('createDependencyGraph', () => {
  const sampleNodes: Node[] = [
    {
      id: 'module-a',
      label: 'moduleA',
      type: 'module',
      filePath: '/src/a.ts',
      line: 1,
      column: 1,
    },
    {
      id: 'module-b',
      label: 'moduleB',
      type: 'module',
      filePath: '/src/b.ts',
      line: 1,
      column: 1,
    },
  ];

  const sampleEdges: Edge[] = [
    {
      source: 'module-a',
      target: 'module-b',
      type: 'import',
    },
  ];

  const sampleMetadata = {
    rootDir: '/project',
    analyzedAt: '2024-01-15T10:30:00.000Z',
    fileCount: 2,
    version: '0.1.0',
  };

  it('should create a dependency graph with all properties', () => {
    const graph = createDependencyGraph({
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMetadata,
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.metadata.rootDir).toBe('/project');
  });

  it('should create an immutable graph', () => {
    const graph = createDependencyGraph({
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMetadata,
    });

    expect(Object.isFrozen(graph)).toBe(true);
  });

  it('should freeze nodes array', () => {
    const graph = createDependencyGraph({
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMetadata,
    });

    expect(Object.isFrozen(graph.nodes)).toBe(true);
  });

  it('should freeze edges array', () => {
    const graph = createDependencyGraph({
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMetadata,
    });

    expect(Object.isFrozen(graph.edges)).toBe(true);
  });

  it('should freeze metadata', () => {
    const graph = createDependencyGraph({
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMetadata,
    });

    expect(Object.isFrozen(graph.metadata)).toBe(true);
  });

  it('should create a copy of the input arrays', () => {
    const nodes = [...sampleNodes];
    const edges = [...sampleEdges];

    const graph = createDependencyGraph({
      nodes,
      edges,
      metadata: sampleMetadata,
    });

    // Modify original arrays
    nodes.push({
      id: 'new-node',
      label: 'new',
      type: 'function',
      filePath: '/src/c.ts',
      line: 1,
      column: 1,
    });

    // Graph should not be affected
    expect(graph.nodes).toHaveLength(2);
  });

  it('should handle empty nodes and edges', () => {
    const graph = createDependencyGraph({
      nodes: [],
      edges: [],
      metadata: sampleMetadata,
    });

    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
