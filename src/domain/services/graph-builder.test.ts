import { describe, it, expect } from 'vitest';
import { buildGraph } from './graph-builder.js';
import type { ParsedFile } from '../ports/index.js';
import { createNode } from '../models/node.js';
import { createEdge } from '../models/edge.js';

describe('buildGraph', () => {
  it('should build a graph from parsed files', () => {
    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [
          createNode({
            id: 'a#funcA',
            label: 'funcA',
            type: 'function',
            filePath: '/src/a.ts',
            line: 1,
            column: 1,
          }),
        ],
        edges: [
          createEdge({
            source: 'a',
            target: 'b',
            type: 'import',
          }),
        ],
      },
      {
        filePath: '/src/b.ts',
        nodes: [
          createNode({
            id: 'b#funcB',
            label: 'funcB',
            type: 'function',
            filePath: '/src/b.ts',
            line: 1,
            column: 1,
          }),
        ],
        edges: [],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.metadata.rootDir).toBe('/project');
    expect(graph.metadata.fileCount).toBe(2);
  });

  it('should deduplicate nodes with same id', () => {
    const duplicateNode = createNode({
      id: 'shared#util',
      label: 'util',
      type: 'function',
      filePath: '/src/shared.ts',
      line: 1,
      column: 1,
    });

    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [duplicateNode],
        edges: [],
      },
      {
        filePath: '/src/b.ts',
        nodes: [duplicateNode],
        edges: [],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]?.id).toBe('shared#util');
  });

  it('should deduplicate edges with same source, target, and type', () => {
    const duplicateEdge = createEdge({
      source: 'a',
      target: 'b',
      type: 'import',
    });

    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [],
        edges: [duplicateEdge],
      },
      {
        filePath: '/src/b.ts',
        nodes: [],
        edges: [duplicateEdge],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.edges).toHaveLength(1);
  });

  it('should keep edges with different types even if same source and target', () => {
    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [],
        edges: [
          createEdge({
            source: 'a',
            target: 'b',
            type: 'import',
          }),
          createEdge({
            source: 'a',
            target: 'b',
            type: 'call',
          }),
        ],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.edges).toHaveLength(2);
  });

  it('should handle empty parsed files', () => {
    const graph = buildGraph([], { rootDir: '/project' });

    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.metadata.fileCount).toBe(0);
  });

  it('should use provided version', () => {
    const graph = buildGraph([], {
      rootDir: '/project',
      version: '2.0.0',
    });

    expect(graph.metadata.version).toBe('2.0.0');
  });

  it('should use default version when not provided', () => {
    const graph = buildGraph([], { rootDir: '/project' });

    expect(graph.metadata.version).toBe('0.1.0');
  });

  it('should return an immutable graph', () => {
    const graph = buildGraph([], { rootDir: '/project' });

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
    expect(Object.isFrozen(graph.edges)).toBe(true);
    expect(Object.isFrozen(graph.metadata)).toBe(true);
  });

  it('should preserve node metadata', () => {
    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [
          createNode({
            id: 'a#MyClass',
            label: 'MyClass',
            type: 'class',
            filePath: '/src/a.ts',
            line: 5,
            column: 1,
            metadata: { exported: true, abstract: false },
          }),
        ],
        edges: [],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.nodes[0]?.metadata).toEqual({
      exported: true,
      abstract: false,
    });
  });

  it('should preserve edge metadata', () => {
    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/src/a.ts',
        nodes: [],
        edges: [
          createEdge({
            source: 'a',
            target: 'b',
            type: 'import',
            metadata: { importPath: './b' },
          }),
        ],
      },
    ];

    const graph = buildGraph(parsedFiles, { rootDir: '/project' });

    expect(graph.edges[0]?.metadata).toEqual({ importPath: './b' });
  });
});
