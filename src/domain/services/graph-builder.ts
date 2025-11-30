/**
 * @fileoverview Graph builder domain service.
 * @module domain/services/graph-builder
 *
 * This module provides the core domain service for building
 * a dependency graph from parsed file data.
 */

import type { Node, Edge, DependencyGraph } from '../models/index.js';
import { createDependencyGraph, createGraphMetadata } from '../models/index.js';
import type { ParsedFile } from '../ports/index.js';

/**
 * Configuration options for building the dependency graph.
 *
 * @example
 * ```typescript
 * const options: GraphBuilderOptions = {
 *   rootDir: '/path/to/project',
 *   version: '0.1.0',
 * };
 * ```
 */
export interface GraphBuilderOptions {
  /**
   * Root directory of the project being analyzed.
   */
  readonly rootDir: string;

  /**
   * Optional version of chizuts to include in metadata.
   */
  readonly version?: string | undefined;
}

/**
 * Builds a DependencyGraph from parsed file data.
 *
 * This is a pure domain service with no external dependencies.
 * It aggregates nodes and edges from multiple parsed files,
 * removing duplicates and creating the final graph structure.
 *
 * @param parsedFiles - Array of parsed file data containing nodes and edges
 * @param options - Configuration options for the graph builder
 * @returns A complete dependency graph with all nodes, edges, and metadata
 *
 * @example
 * ```typescript
 * const parsedFiles = parser.parse(filePaths, parserOptions);
 * const graph = buildGraph(parsedFiles, {
 *   rootDir: '/project',
 *   version: '0.1.0',
 * });
 * console.log(`Graph has ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
 * ```
 */
export function buildGraph(
  parsedFiles: readonly ParsedFile[],
  options: GraphBuilderOptions
): DependencyGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seenNodeIds = new Set<string>();
  const seenEdgeKeys = new Set<string>();

  for (const file of parsedFiles) {
    // Add unique nodes
    for (const node of file.nodes) {
      if (!seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        nodes.push(node);
      }
    }

    // Add unique edges
    for (const edge of file.edges) {
      const edgeKey = `${edge.source}->${edge.target}:${edge.type}`;
      if (!seenEdgeKeys.has(edgeKey)) {
        seenEdgeKeys.add(edgeKey);
        edges.push(edge);
      }
    }
  }

  const metadata = createGraphMetadata({
    rootDir: options.rootDir,
    fileCount: parsedFiles.length,
    version: options.version,
  });

  return createDependencyGraph({ nodes, edges, metadata });
}
