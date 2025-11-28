import type { Node } from './node.js';
import type { Edge } from './edge.js';

/**
 * Metadata about the dependency graph analysis
 */
export interface GraphMetadata {
  /** Root directory that was analyzed */
  readonly rootDir: string;
  /** Timestamp of the analysis */
  readonly analyzedAt: string;
  /** Total number of files analyzed */
  readonly fileCount: number;
  /** graphts version used */
  readonly version: string;
}

/**
 * The complete dependency graph structure
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  readonly nodes: readonly Node[];
  /** All edges in the graph */
  readonly edges: readonly Edge[];
  /** Metadata about the analysis */
  readonly metadata: GraphMetadata;
}

/**
 * Creates a new DependencyGraph instance
 */
export function createDependencyGraph(params: {
  nodes: Node[];
  edges: Edge[];
  metadata: GraphMetadata;
}): DependencyGraph {
  return Object.freeze({
    nodes: Object.freeze([...params.nodes]),
    edges: Object.freeze([...params.edges]),
    metadata: Object.freeze(params.metadata),
  });
}

/**
 * Creates empty graph metadata
 */
export function createGraphMetadata(params: {
  rootDir: string;
  fileCount?: number | undefined;
  version?: string | undefined;
}): GraphMetadata {
  return Object.freeze({
    rootDir: params.rootDir,
    analyzedAt: new Date().toISOString(),
    fileCount: params.fileCount ?? 0,
    version: params.version ?? '0.1.0',
  });
}
