import type {
  DependencyGraph,
  IParser,
  IFileReader,
  FileReaderOptions,
} from '../../domain/index.js';
import { buildGraph } from '../../domain/index.js';

/**
 * Options for analyzing a project
 */
export interface AnalyzeProjectOptions {
  /** Root directory to analyze */
  readonly rootDir: string;
  /** Path to tsconfig.json (defaults to rootDir/tsconfig.json) */
  readonly tsconfigPath?: string | undefined;
  /** Glob patterns to include */
  readonly include?: readonly string[] | undefined;
  /** Glob patterns to exclude */
  readonly exclude?: readonly string[] | undefined;
}

/**
 * Use case for analyzing a TypeScript project and building its dependency graph.
 * Orchestrates the parser and file reader adapters.
 */
export class AnalyzeProjectUseCase {
  constructor(
    private readonly parser: IParser,
    private readonly fileReader: IFileReader
  ) {}

  /**
   * Executes the analysis and returns the dependency graph
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
