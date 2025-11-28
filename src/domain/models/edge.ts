/**
 * Edge types representing dependency relationships
 */
export const EDGE_TYPES = [
  'import',
  'export',
  'call',
  'reference',
  'extends',
  'implements',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

/**
 * Represents an edge (dependency relationship) in the graph
 */
export interface Edge {
  /** Source node ID */
  readonly source: string;
  /** Target node ID */
  readonly target: string;
  /** Type of dependency */
  readonly type: EdgeType;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Creates a new Edge instance
 */
export function createEdge(params: {
  source: string;
  target: string;
  type: EdgeType;
  metadata?: Record<string, unknown>;
}): Edge {
  return Object.freeze({
    source: params.source,
    target: params.target,
    type: params.type,
    metadata: params.metadata ? Object.freeze(params.metadata) : undefined,
  });
}
