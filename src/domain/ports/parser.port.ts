import type { Node, Edge } from '../models/index.js';

/**
 * Represents a parsed source file with extracted symbols and dependencies
 */
export interface ParsedFile {
  /** Absolute file path */
  readonly filePath: string;
  /** Extracted nodes (functions, classes, etc.) */
  readonly nodes: readonly Node[];
  /** Extracted edges (imports, calls, etc.) */
  readonly edges: readonly Edge[];
}

/**
 * Options for parsing source files
 */
export interface ParserOptions {
  /** Root directory of the project */
  readonly rootDir: string;
  /** Path to tsconfig.json */
  readonly tsconfigPath?: string | undefined;
}

/**
 * Port interface for source code parsing.
 * Implementations provide actual parsing logic (e.g., TypeScript Compiler API).
 */
export interface IParser {
  /**
   * Parses source files and extracts dependency information
   * @param filePaths - Array of file paths to parse
   * @param options - Parser configuration
   * @returns Parsed file information with nodes and edges
   */
  parse(filePaths: readonly string[], options: ParserOptions): ParsedFile[];
}
