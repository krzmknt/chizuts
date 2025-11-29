/**
 * Node types in the dependency graph
 */
export const NODE_TYPES = [
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
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

/**
 * Represents a node in the dependency graph.
 * A node can be a module, function, variable, class, or component.
 */
export interface Node {
  /** Unique identifier for the node */
  readonly id: string;
  /** Display label for the node */
  readonly label: string;
  /** Type of the node */
  readonly type: NodeType;
  /** File path where this node is defined */
  readonly filePath: string;
  /** Line number where this node is defined */
  readonly line: number;
  /** Column number where this node is defined */
  readonly column: number;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Creates a new Node instance
 */
export function createNode(params: {
  id: string;
  label: string;
  type: NodeType;
  filePath: string;
  line: number;
  column: number;
  metadata?: Record<string, unknown>;
}): Node {
  return Object.freeze({
    id: params.id,
    label: params.label,
    type: params.type,
    filePath: params.filePath,
    line: params.line,
    column: params.column,
    metadata: params.metadata ? Object.freeze(params.metadata) : undefined,
  });
}
