/**
 * @fileoverview Dependency graph model.
 * @module domain/models/graph
 *
 * This module defines the DependencyGraph entity which represents
 * the complete dependency structure of a codebase.
 */

import type { Node } from './node.js';
import type { Edge } from './edge.js';

/**
 * Metadata about the dependency graph analysis.
 *
 * Contains information about when and how the graph was generated.
 *
 * @example
 * ```typescript
 * const metadata: GraphMetadata = {
 *   rootDir: '/path/to/project',
 *   analyzedAt: '2024-01-15T10:30:00.000Z',
 *   fileCount: 42,
 *   version: '0.1.0',
 * };
 * ```
 */
export interface GraphMetadata {
  /**
   * Root directory that was analyzed.
   */
  readonly rootDir: string;

  /**
   * ISO 8601 timestamp of when the analysis was performed.
   */
  readonly analyzedAt: string;

  /**
   * Total number of files analyzed.
   */
  readonly fileCount: number;

  /**
   * Version of graphts used to generate the graph.
   */
  readonly version: string;
}

/**
 * The complete dependency graph structure.
 *
 * Contains all nodes (code elements) and edges (dependencies)
 * discovered during the analysis, along with metadata.
 *
 * @example
 * ```typescript
 * const graph: DependencyGraph = {
 *   nodes: [{ id: 'src/index.ts', label: 'index.ts', ... }],
 *   edges: [{ source: 'src/index.ts', target: 'src/utils.ts', type: 'import' }],
 *   metadata: { rootDir: '/project', analyzedAt: '...', fileCount: 10, version: '0.1.0' },
 * };
 * ```
 */
export interface DependencyGraph {
  /**
   * All nodes (code elements) in the graph.
   * @see {@link Node}
   */
  readonly nodes: readonly Node[];

  /**
   * All edges (dependencies) in the graph.
   * @see {@link Edge}
   */
  readonly edges: readonly Edge[];

  /**
   * Metadata about the analysis.
   * @see {@link GraphMetadata}
   */
  readonly metadata: GraphMetadata;
}

/**
 * Parameters for creating a new DependencyGraph.
 */
interface CreateDependencyGraphParams {
  /** Array of nodes in the graph */
  nodes: Node[];
  /** Array of edges in the graph */
  edges: Edge[];
  /** Metadata about the analysis */
  metadata: GraphMetadata;
}

/**
 * Creates a new immutable DependencyGraph instance.
 *
 * @param params - The parameters for creating the graph
 * @returns A frozen DependencyGraph object that cannot be modified
 *
 * @example
 * ```typescript
 * const graph = createDependencyGraph({
 *   nodes: [node1, node2],
 *   edges: [edge1],
 *   metadata: createGraphMetadata({ rootDir: '/project' }),
 * });
 * ```
 */
export function createDependencyGraph(
  params: CreateDependencyGraphParams
): DependencyGraph {
  return Object.freeze({
    nodes: Object.freeze([...params.nodes]),
    edges: Object.freeze([...params.edges]),
    metadata: Object.freeze(params.metadata),
  });
}

/**
 * Parameters for creating graph metadata.
 */
interface CreateGraphMetadataParams {
  /** Root directory that was analyzed */
  rootDir: string;
  /** Total number of files analyzed */
  fileCount?: number | undefined;
  /** Version of graphts used */
  version?: string | undefined;
}

/**
 * Creates a new immutable GraphMetadata instance.
 *
 * @param params - The parameters for creating the metadata
 * @returns A frozen GraphMetadata object with the current timestamp
 *
 * @example
 * ```typescript
 * const metadata = createGraphMetadata({
 *   rootDir: '/path/to/project',
 *   fileCount: 42,
 * });
 * ```
 */
export function createGraphMetadata(
  params: CreateGraphMetadataParams
): GraphMetadata {
  return Object.freeze({
    rootDir: params.rootDir,
    analyzedAt: new Date().toISOString(),
    fileCount: params.fileCount ?? 0,
    version: params.version ?? '0.1.0',
  });
}
