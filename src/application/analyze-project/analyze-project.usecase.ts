/**
 * @fileoverview Analyze project use case.
 * @module application/analyze-project
 *
 * This module provides the main use case for analyzing a TypeScript
 * project and building its dependency graph.
 */

import type {
  DependencyGraph,
  IParser,
  IFileReader,
  FileReaderOptions,
} from '../../domain/index.js';
import { buildGraph } from '../../domain/index.js';

/**
 * Configuration options for analyzing a project.
 *
 * @example
 * ```typescript
 * const options: AnalyzeProjectOptions = {
 *   rootDir: '/path/to/project',
 *   tsconfigPath: '/path/to/project/tsconfig.json',
 *   exclude: ['**\/*.test.ts'],
 * };
 * ```
 */
export interface AnalyzeProjectOptions {
  /**
   * Root directory of the project to analyze.
   */
  readonly rootDir: string;

  /**
   * Path to tsconfig.json.
   * If not specified, defaults to `{rootDir}/tsconfig.json`.
   */
  readonly tsconfigPath?: string | undefined;

  /**
   * Glob patterns for files to include in the analysis.
   */
  readonly include?: readonly string[] | undefined;

  /**
   * Glob patterns for files to exclude from the analysis.
   */
  readonly exclude?: readonly string[] | undefined;
}

/**
 * Use case for analyzing a TypeScript project and building its dependency graph.
 *
 * This is an application layer use case that orchestrates the parser and
 * file reader adapters to produce a complete dependency graph.
 *
 * @example
 * ```typescript
 * const useCase = new AnalyzeProjectUseCase(parser, fileReader);
 * const graph = useCase.execute({
 *   rootDir: '/path/to/project',
 *   exclude: ['**\/*.test.ts'],
 * });
 * console.log(`Found ${graph.nodes.length} nodes`);
 * ```
 */
export class AnalyzeProjectUseCase {
  /**
   * Creates a new AnalyzeProjectUseCase instance.
   *
   * @param parser - The parser adapter for extracting nodes and edges
   * @param fileReader - The file reader adapter for discovering source files
   */
  constructor(
    private readonly parser: IParser,
    private readonly fileReader: IFileReader
  ) {}

  /**
   * Executes the project analysis and returns the dependency graph.
   *
   * @param options - Configuration options for the analysis
   * @returns The complete dependency graph of the project
   */
  execute(options: AnalyzeProjectOptions): DependencyGraph {
    const fileReaderOptions: FileReaderOptions = {
      include: options.include,
      exclude: options.exclude,
    };

    // Find all TypeScript files
    const filePaths = this.fileReader.findFiles(
      options.rootDir,
      fileReaderOptions
    );

    // Parse files to extract nodes and edges
    const parsedFiles = this.parser.parse(filePaths, {
      rootDir: options.rootDir,
      tsconfigPath: options.tsconfigPath,
    });

    // Build the dependency graph
    return buildGraph(parsedFiles, {
      rootDir: options.rootDir,
    });
  }
}
