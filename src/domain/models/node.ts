/**
 * @fileoverview Node model for the dependency graph.
 * @module domain/models/node
 *
 * This module defines the Node entity which represents a code element
 * in the dependency graph (e.g., modules, functions, classes, components).
 */

/**
 * Available node types in the dependency graph.
 *
 * @remarks
 * Each type represents a different kind of code element:
 * - `module`: A file/module
 * - `function`: A function declaration
 * - `class`: A class declaration
 * - `variable`: A variable declaration
 * - `component`: A React component
 * - `type`: A type alias
 * - `interface`: An interface declaration
 * - `enum`: An enum declaration
 * - `method`: A method within a class
 * - `field`: A field/property within a class
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

/**
 * Union type of all possible node types.
 *
 * @example
 * ```typescript
 * const type: NodeType = 'function';
 * ```
 */
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * Represents a node in the dependency graph.
 *
 * A node can be any code element such as a module, function, variable,
 * class, or React component. Each node has a unique identifier and
 * contains location information for source mapping.
 *
 * @example
 * ```typescript
 * const node: Node = {
 *   id: 'src/utils/helper.ts#formatDate',
 *   label: 'formatDate',
 *   type: 'function',
 *   filePath: 'src/utils/helper.ts',
 *   line: 10,
 *   column: 1,
 * };
 * ```
 */
export interface Node {
  /**
   * Unique identifier for the node.
   * Format: `{filePath}#{symbolName}` or just `{filePath}` for modules.
   */
  readonly id: string;

  /**
   * Display label for the node in the visualization.
   * Typically the symbol name or file name.
   */
  readonly label: string;

  /**
   * The type of code element this node represents.
   * @see {@link NodeType}
   */
  readonly type: NodeType;

  /**
   * Absolute or relative file path where this node is defined.
   */
  readonly filePath: string;

  /**
   * Line number where this node is defined (1-indexed).
   */
  readonly line: number;

  /**
   * Column number where this node is defined (1-indexed).
   */
  readonly column: number;

  /**
   * Optional additional metadata for the node.
   * Can contain any extra information like JSDoc comments, modifiers, etc.
   */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Parameters for creating a new Node.
 */
interface CreateNodeParams {
  /** Unique identifier for the node */
  id: string;
  /** Display label for the node */
  label: string;
  /** Type of the node */
  type: NodeType;
  /** File path where this node is defined */
  filePath: string;
  /** Line number where this node is defined */
  line: number;
  /** Column number where this node is defined */
  column: number;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Creates a new immutable Node instance.
 *
 * @param params - The parameters for creating the node
 * @returns A frozen Node object that cannot be modified
 *
 * @example
 * ```typescript
 * const node = createNode({
 *   id: 'src/index.ts#main',
 *   label: 'main',
 *   type: 'function',
 *   filePath: 'src/index.ts',
 *   line: 5,
 *   column: 1,
 * });
 * ```
 */
export function createNode(params: CreateNodeParams): Node {
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
