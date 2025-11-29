#!/usr/bin/env node

/**
 * @fileoverview graphts CLI entry point.
 * @module cli
 *
 * This module provides the command-line interface for graphts.
 * It wires up dependencies and executes the analysis pipeline,
 * then starts the visualization server.
 */

import { AnalyzeProjectUseCase } from '../application/index.js';
import {
  TypeScriptParserAdapter,
  FileReaderAdapter,
} from '../infrastructure/index.js';
import { startServer } from '../web/server/index.js';

/**
 * Current version of graphts.
 */
export const VERSION = '0.1.0';

/**
 * Parsed command-line options.
 */
export interface CliOptions {
  /** Root directory to analyze */
  rootDir: string;
  /** Port for the visualization server */
  port: number;
  /** Glob patterns for files to include */
  include: string[];
  /** Glob patterns for files to exclude */
  exclude: string[];
  /** Path to tsconfig.json */
  tsconfigPath?: string | undefined;
  /** Enable watch mode with auto-reload */
  watch: boolean;
  /** Show help message */
  help: boolean;
  /** Show version number */
  version: boolean;
}

/**
 * Custom error class for CLI-related errors.
 *
 * Used to distinguish user-facing errors (like invalid arguments)
 * from unexpected internal errors.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

/**
 * Displays the help message with usage information and available options.
 */
export function showHelp(): void {
  console.log(`
graphts - TypeScript Dependency Graph Analyzer

Usage:
  graphts [options] [directory]

Arguments:
  directory              Project directory to analyze (default: current directory)

Options:
  -h, --help             Show this help message
  -v, --version          Show version number
  -p, --port <number>    Server port (default: 3000)
  -w, --watch            Watch for file changes and auto-reload
  --include <pattern>    Glob patterns to include (can be specified multiple times)
  --exclude <pattern>    Glob patterns to exclude (can be specified multiple times)
  --tsconfig <path>      Path to tsconfig.json

Examples:
  graphts                        Analyze current directory
  graphts ./my-project           Analyze specific directory
  graphts -p 8080                Use custom port
  graphts -w                     Watch mode with auto-reload
  graphts --exclude "**/*.test.ts"  Exclude test files
`);
}

/**
 * Displays the current version of graphts.
 */
export function showVersion(): void {
  console.log(`graphts v${VERSION}`);
}

/**
 * Parses command-line arguments into a CliOptions object.
 *
 * @param args - Array of command-line arguments (typically process.argv.slice(2))
 * @param defaultRootDir - Default root directory if not specified
 * @returns Parsed CLI options
 * @throws CliError if an invalid argument is provided
 */
export function parseArgs(args: string[], defaultRootDir?: string): CliOptions {
  const options: CliOptions = {
    rootDir: defaultRootDir ?? process.cwd(),
    port: 3000,
    include: [],
    exclude: [],
    watch: false,
    help: false,
    version: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;

      case '-v':
      case '--version':
        options.version = true;
        break;

      case '-w':
      case '--watch':
        options.watch = true;
        break;

      case '-p':
      case '--port': {
        const portValue = args[++i];
        if (portValue === undefined) {
          throw new CliError('--port requires a value');
        }
        const port = parseInt(portValue, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new CliError('--port must be a valid port number (1-65535)');
        }
        options.port = port;
        break;
      }

      case '--include': {
        const includeValue = args[++i];
        if (includeValue === undefined) {
          throw new CliError('--include requires a value');
        }
        options.include.push(includeValue);
        break;
      }

      case '--exclude': {
        const excludeValue = args[++i];
        if (excludeValue === undefined) {
          throw new CliError('--exclude requires a value');
        }
        options.exclude.push(excludeValue);
        break;
      }

      case '--tsconfig': {
        const tsconfigValue = args[++i];
        if (tsconfigValue === undefined) {
          throw new CliError('--tsconfig requires a value');
        }
        options.tsconfigPath = tsconfigValue;
        break;
      }

      default:
        if (arg?.startsWith('-')) {
          throw new CliError(
            `Unknown option: ${arg}\nRun "graphts --help" for usage information.`
          );
        }
        // Positional argument (directory)
        if (arg !== undefined) {
          options.rootDir = arg;
        }
        break;
    }

    i++;
  }

  return options;
}

/**
 * Applies environment variable overrides to CLI options.
 *
 * Currently supports:
 * - `PORT` - Overrides the default port (only if port is still default)
 *
 * @param options - The parsed CLI options
 * @returns Options with environment overrides applied
 */
export function applyEnvOverrides(options: CliOptions): CliOptions {
  const envPort = process.env['PORT'];
  if (envPort !== undefined && options.port === 3000) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port >= 1 && port <= 65535) {
      return { ...options, port };
    }
  }
  return options;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsedOptions = parseArgs(args);
  const options = applyEnvOverrides(parsedOptions);

  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  console.log('graphts - TypeScript Dependency Graph Analyzer');
  console.log('');

  // Wire up dependencies
  const parser = new TypeScriptParserAdapter();
  const fileReader = new FileReaderAdapter();
  const analyzeProject = new AnalyzeProjectUseCase(parser, fileReader);

  const analyzeOptions = {
    rootDir: options.rootDir,
    include: options.include.length > 0 ? options.include : undefined,
    exclude: options.exclude.length > 0 ? options.exclude : undefined,
    tsconfigPath: options.tsconfigPath,
  };

  console.log(`Analyzing: ${options.rootDir}`);

  // Execute use case
  let graph = analyzeProject.execute(analyzeOptions);

  console.log(`Found ${graph.nodes.length} nodes`);
  console.log(`Found ${graph.edges.length} edges`);
  console.log(`Analyzed ${graph.metadata.fileCount} files`);

  // Start visualization server
  const server = await startServer({
    graph,
    port: options.port,
    watch: options.watch,
    ...(options.include.length > 0 && { include: options.include }),
    ...(options.exclude.length > 0 && { exclude: options.exclude }),
  });

  // Set up file watching if watch mode is enabled
  if (options.watch) {
    const { watch } = await import('node:fs');

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const reanalyze = (): void => {
      console.log('\nFile change detected, re-analyzing...');
      try {
        graph = analyzeProject.execute(analyzeOptions);
        server.updateGraph(graph);
        console.log(
          `Updated: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
        );
      } catch (error) {
        console.error('Error during re-analysis:', error);
      }
    };

    // Watch the root directory recursively
    const watcher = watch(
      options.rootDir,
      { recursive: true },
      (eventType, filename) => {
        // Only watch TypeScript files
        if (
          filename &&
          (filename.endsWith('.ts') || filename.endsWith('.tsx')) &&
          !filename.endsWith('.d.ts')
        ) {
          // Debounce to avoid multiple rapid re-analyses
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(reanalyze, 300);
        }
      }
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      watcher.close();
      void server.close().then(() => process.exit(0));
    });
  }
}

// Only run main when this file is the entry point (not when imported for testing)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/dist/cli/index.js');

if (isMainModule) {
  main().catch((error: unknown) => {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  });
}
