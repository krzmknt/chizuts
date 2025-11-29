/**
 * Web server entry point
 *
 * Serves the visualization UI and provides API endpoints.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DependencyGraph } from '../../domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Options for starting the visualization server
 */
export interface ServerOptions {
  /** Port to listen on (default: 3000) */
  readonly port?: number;
  /** Open browser automatically (default: true) */
  readonly open?: boolean;
  /** The dependency graph to visualize */
  readonly graph: DependencyGraph;
  /** Enable watch mode with SSE updates */
  readonly watch?: boolean;
  /** Include patterns for filtering */
  readonly include?: readonly string[];
  /** Exclude patterns for filtering */
  readonly exclude?: readonly string[];
}

/**
 * Server instance with update capability
 */
export interface ServerInstance {
  /** Update the graph and notify connected clients */
  updateGraph: (graph: DependencyGraph) => void;
  /** Close the server */
  close: () => Promise<void>;
}

/**
 * MIME types for static files
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Starts a local server for visualizing the dependency graph.
 */
export function startServer(options: ServerOptions): Promise<ServerInstance> {
  const port = options.port ?? 3000;
  // Resolve public dir relative to project root (works in both src and dist)
  const projectRoot = path.resolve(__dirname, '../../..');
  const publicDir = path.resolve(projectRoot, 'src/web/public');

  let currentGraph = options.graph;
  const sseClients: Set<http.ServerResponse> = new Set();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/';

      // API endpoint for graph data
      if (url === '/api/graph') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(currentGraph));
        return;
      }

      // API endpoint for filter config
      if (url === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            include: options.include ?? [],
            exclude: options.exclude ?? [],
          })
        );
        return;
      }

      // SSE endpoint for watch mode
      if (url === '/api/events' && options.watch) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Send initial connection message
        res.write('event: connected\ndata: {}\n\n');

        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });

        return;
      }

      // Serve static files
      let filePath = path.join(publicDir, url === '/' ? 'index.html' : url);

      // Security: prevent directory traversal
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(500);
            res.end('Server error');
          }
          return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, () => {
      console.log(`\nVisualization server running at http://localhost:${port}`);
      if (options.watch) {
        console.log(
          'Watch mode enabled - graph will auto-update on file changes'
        );
      }
      console.log('Press Ctrl+C to stop\n');

      // Open browser if requested
      if (options.open !== false) {
        openBrowser(`http://localhost:${port}`);
      }

      const instance: ServerInstance = {
        updateGraph: (graph: DependencyGraph) => {
          currentGraph = graph;
          // Notify all connected SSE clients
          for (const client of sseClients) {
            client.write(
              `event: update\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`
            );
          }
        },
        close: () => {
          return new Promise<void>((resolveClose) => {
            // Close all SSE connections
            for (const client of sseClients) {
              client.end();
            }
            sseClients.clear();
            server.close(() => resolveClose());
          });
        },
      };

      resolve(instance);
    });
  });
}

/**
 * Opens the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }

  void import('node:child_process').then(({ exec }) => {
    exec(command, (err) => {
      if (err) {
        console.log(
          `Could not open browser automatically. Please visit: ${url}`
        );
      }
    });
  });
}
