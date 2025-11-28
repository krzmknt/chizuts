#!/usr/bin/env node

/**
 * graphts CLI entry point
 *
 * Wires up dependencies and executes the analyze command.
 */

import { AnalyzeProjectUseCase } from '../application/index.js';
import {
  TypeScriptParserAdapter,
  FileReaderAdapter,
} from '../infrastructure/index.js';
import { startServer } from '../web/server/index.js';

export const VERSION = '0.1.0';

export interface CliOptions {
  rootDir: string;
  port: number;
  include: string[];
  exclude: string[];
  tsconfigPath?: string | undefined;
  help: boolean;
  version: boolean;
}

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

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
  --include <pattern>    Glob patterns to include (can be specified multiple times)
  --exclude <pattern>    Glob patterns to exclude (can be specified multiple times)
  --tsconfig <path>      Path to tsconfig.json

Examples:
  graphts                        Analyze current directory
  graphts ./my-project           Analyze specific directory
  graphts -p 8080                Use custom port
  graphts --exclude "**/*.test.ts"  Exclude test files
`);
}

export function showVersion(): void {
  console.log(`graphts v${VERSION}`);
}

export function parseArgs(args: string[], defaultRootDir?: string): CliOptions {
  const options: CliOptions = {
    rootDir: defaultRootDir ?? process.cwd(),
    port: 3000,
    include: [],
    exclude: [],
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

/**
 * Main CLI entry point
 */
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

  console.log(`Analyzing: ${options.rootDir}`);

  // Execute use case
  const graph = analyzeProject.execute({
    rootDir: options.rootDir,
    include: options.include.length > 0 ? options.include : undefined,
    exclude: options.exclude.length > 0 ? options.exclude : undefined,
    tsconfigPath: options.tsconfigPath,
  });

  console.log(`Found ${graph.nodes.length} nodes`);
  console.log(`Found ${graph.edges.length} edges`);
  console.log(`Analyzed ${graph.metadata.fileCount} files`);

  // Start visualization server
  await startServer({ graph, port: options.port });
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
