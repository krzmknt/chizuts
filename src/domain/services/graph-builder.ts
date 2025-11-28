import type { Node, Edge, DependencyGraph } from '../models/index.js';
import { createDependencyGraph, createGraphMetadata } from '../models/index.js';
import type { ParsedFile } from '../ports/index.js';

/**
 * Options for building the dependency graph
 */
export interface GraphBuilderOptions {
  /** Root directory being analyzed */
  readonly rootDir: string;
  /** graphts version */
  readonly version?: string | undefined;
}

/**
 * Builds a DependencyGraph from parsed file data.
 * This is a pure domain service with no external dependencies.
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
