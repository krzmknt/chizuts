/**
 * @fileoverview Parser port interface.
 * @module domain/ports/parser
 *
 * This module defines the port interface for source code parsing.
 * Implementations provide the actual parsing logic using tools like
 * the TypeScript Compiler API.
 */

import type { Node, Edge } from '../models/index.js';

/**
 * Represents a parsed source file with extracted symbols and dependencies.
 *
 * Contains all the nodes and edges discovered in a single source file
 * after parsing.
 *
 * @example
 * ```typescript
 * const parsedFile: ParsedFile = {
 *   filePath: '/project/src/utils.ts',
 *   nodes: [{ id: 'src/utils.ts#formatDate', ... }],
 *   edges: [{ source: 'src/utils.ts#formatDate', target: '...', type: 'call' }],
 * };
 * ```
 */
export interface ParsedFile {
  /**
   * Absolute file path of the parsed file.
   */
  readonly filePath: string;

  /**
   * Extracted nodes (functions, classes, variables, etc.) from the file.
   * @see {@link Node}
   */
  readonly nodes: readonly Node[];

  /**
   * Extracted edges (imports, calls, references, etc.) from the file.
   * @see {@link Edge}
   */
  readonly edges: readonly Edge[];
}

/**
 * Configuration options for the parser.
 *
 * @example
 * ```typescript
 * const options: ParserOptions = {
 *   rootDir: '/path/to/project',
 *   tsconfigPath: '/path/to/project/tsconfig.json',
 * };
 * ```
 */
export interface ParserOptions {
  /**
   * Root directory of the project being analyzed.
   */
  readonly rootDir: string;

  /**
   * Optional path to the TypeScript configuration file.
   * If not provided, default compiler options are used.
   */
  readonly tsconfigPath?: string | undefined;
}

/**
 * Port interface for source code parsing.
 *
 * This is a hexagonal architecture port that defines the contract
 * for parsing source code. Implementations (adapters) provide the
 * actual parsing logic using specific tools.
 *
 * @example
 * ```typescript
 * class TypeScriptParser implements IParser {
 *   parse(filePaths: readonly string[], options: ParserOptions): ParsedFile[] {
 *     // Implementation using TypeScript Compiler API
 *   }
 * }
 * ```
 */
export interface IParser {
  /**
   * Parses source files and extracts dependency information.
   *
   * @param filePaths - Array of absolute file paths to parse
   * @param options - Parser configuration options
   * @returns Array of parsed file information with nodes and edges
   */
  parse(filePaths: readonly string[], options: ParserOptions): ParsedFile[];
}
