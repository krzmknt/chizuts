/**
 * @fileoverview Web server for the visualization UI.
 * @module web/server
 *
 * This module provides a local HTTP server that serves the graph
 * visualization UI and provides API endpoints for accessing graph data.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DependencyGraph } from '../../domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration options for starting the visualization server.
 *
 * @example
 * ```typescript
 * const options: ServerOptions = {
 *   graph: dependencyGraph,
 *   port: 8080,
 *   open: true,
 *   watch: true,
 * };
 * ```
 */
export interface ServerOptions {
  /**
   * Port to listen on.
   * @default 3000
   */
  readonly port?: number;

  /**
   * Whether to open the browser automatically.
   * @default true
   */
  readonly open?: boolean;

  /**
   * The dependency graph to visualize.
   */
  readonly graph: DependencyGraph;

  /**
   * Enable watch mode with Server-Sent Events (SSE) for live updates.
   */
  readonly watch?: boolean;

  /**
   * Include patterns for filtering (passed to the UI).
   */
  readonly include?: readonly string[];

  /**
   * Exclude patterns for filtering (passed to the UI).
   */
  readonly exclude?: readonly string[];

  /**
   * Target project path for saving layout data.
   */
  readonly targetPath?: string;
}

/**
 * Server instance returned by startServer.
 *
 * Provides methods to update the graph and close the server.
 */
export interface ServerInstance {
  /**
   * Updates the graph and notifies all connected SSE clients.
   *
   * @param graph - The new dependency graph
   */
  updateGraph: (graph: DependencyGraph) => void;

  /**
   * Closes the server and all SSE connections.
   *
   * @returns A promise that resolves when the server is closed
   */
  close: () => Promise<void>;
}

/**
 * MIME types for static file serving.
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
 * Starts a local HTTP server for visualizing the dependency graph.
 *
 * The server provides:
 * - Static file serving for the visualization UI
 * - `GET /api/graph` - Returns the current graph as JSON
 * - `GET /api/config` - Returns include/exclude filter patterns
 * - `GET /api/events` - SSE endpoint for live updates (watch mode only)
 *
 * @param options - Configuration options for the server
 * @returns A promise that resolves with the server instance
 *
 * @example
 * ```typescript
 * const server = await startServer({
 *   graph: dependencyGraph,
 *   port: 3000,
 *   watch: true,
 * });
 *
 * // Later, update the graph
 * server.updateGraph(newGraph);
 *
 * // Close when done
 * await server.close();
 * ```
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

      // API endpoint for loading saved layout
      if (url === '/api/layout' && req.method === 'GET') {
        if (!options.targetPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target path not configured' }));
          return;
        }

        const layoutPath = path.join(
          options.targetPath,
          '.chizuts',
          'layout.json'
        );
        fs.readFile(layoutPath, 'utf-8', (err, content) => {
          if (err) {
            if (err.code === 'ENOENT') {
              // No saved layout exists
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ positions: {} }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to read layout file' }));
            }
            return;
          }

          try {
            const layoutData = JSON.parse(content) as Record<string, unknown>;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(layoutData));
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid layout file format' }));
          }
        });
        return;
      }

      // API endpoint for saving layout
      if (url === '/api/layout' && req.method === 'POST') {
        if (!options.targetPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target path not configured' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const layoutData = JSON.parse(body) as Record<string, unknown>;
            const chizutsDir = path.join(options.targetPath!, '.chizuts');
            const layoutPath = path.join(chizutsDir, 'layout.json');

            // Create .chizuts directory if it doesn't exist
            fs.mkdir(chizutsDir, { recursive: true }, (mkdirErr) => {
              if (mkdirErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'Failed to create .chizuts directory',
                  })
                );
                return;
              }

              // Write layout file
              fs.writeFile(
                layoutPath,
                JSON.stringify(layoutData, null, 2),
                (writeErr) => {
                  if (writeErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(
                      JSON.stringify({ error: 'Failed to write layout file' })
                    );
                    return;
                  }

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, path: layoutPath }));
                }
              );
            });
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
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
