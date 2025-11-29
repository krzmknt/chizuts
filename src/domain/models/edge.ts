/**
 * @fileoverview Edge model for the dependency graph.
 * @module domain/models/edge
 *
 * This module defines the Edge entity which represents a dependency
 * relationship between two nodes in the graph.
 */

/**
 * Available edge types representing different kinds of dependency relationships.
 *
 * @remarks
 * Each type represents a different kind of relationship:
 * - `import`: An import statement dependency
 * - `export`: An export relationship
 * - `call`: A function/method call relationship
 * - `reference`: A reference to a symbol
 * - `extends`: A class inheritance relationship
 * - `implements`: An interface implementation relationship
 */
export const EDGE_TYPES = [
  'import',
  'export',
  'call',
  'reference',
  'extends',
  'implements',
] as const;

/**
 * Union type of all possible edge types.
 *
 * @example
 * ```typescript
 * const type: EdgeType = 'import';
 * ```
 */
export type EdgeType = (typeof EDGE_TYPES)[number];

/**
 * Represents an edge (dependency relationship) in the dependency graph.
 *
 * An edge connects two nodes and describes the type of dependency
 * between them (e.g., import, call, extends).
 *
 * @example
 * ```typescript
 * const edge: Edge = {
 *   source: 'src/index.ts#main',
 *   target: 'src/utils/helper.ts#formatDate',
 *   type: 'call',
 * };
 * ```
 */
export interface Edge {
  /**
   * The ID of the source node (the node that depends on the target).
   */
  readonly source: string;

  /**
   * The ID of the target node (the node being depended upon).
   */
  readonly target: string;

  /**
   * The type of dependency relationship.
   * @see {@link EdgeType}
   */
  readonly type: EdgeType;

  /**
   * Optional additional metadata for the edge.
   * Can contain extra information like import specifiers, call arguments, etc.
   */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Parameters for creating a new Edge.
 */
interface CreateEdgeParams {
  /** The ID of the source node */
  source: string;
  /** The ID of the target node */
  target: string;
  /** The type of dependency relationship */
  type: EdgeType;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Creates a new immutable Edge instance.
 *
 * @param params - The parameters for creating the edge
 * @returns A frozen Edge object that cannot be modified
 *
 * @example
 * ```typescript
 * const edge = createEdge({
 *   source: 'src/app.ts#App',
 *   target: 'src/components/Header.tsx#Header',
 *   type: 'import',
 * });
 * ```
 */
export function createEdge(params: CreateEdgeParams): Edge {
  return Object.freeze({
    source: params.source,
    target: params.target,
    type: params.type,
    metadata: params.metadata ? Object.freeze(params.metadata) : undefined,
  });
}
