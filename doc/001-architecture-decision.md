# ADR-001: Architecture Decision for chizuts

Date: 2025-11-28

## Status

Accepted

## Context

chizuts is a tool that analyzes TypeScript codebases and visualizes dependencies between modules, functions, variables, and components as a graph. We needed to decide:

1. How to render and display the dependency graph
2. Which programming language(s) to use
3. Which graph visualization library to use

### Future Requirements

- VS Code extension support
- Neovim plugin support
- Handle complex/large-scale graphs (codebase analysis generates many nodes)

## Decision

### 1. Visualization Approach

We evaluated the following approaches:

| Approach               | Technology           | Pros                                     | Cons                             |
| ---------------------- | -------------------- | ---------------------------------------- | -------------------------------- |
| Browser (local server) | D3.js / Cytoscape.js | Interactive, zoom/pan, click for details | Requires browser                 |
| Static image           | Graphviz (DOT)       | Simple, CI/CD friendly, SVG/PNG output   | Not interactive                  |
| Terminal display       | ASCII art            | No dependencies, lightweight             | Hard to read complex graphs      |
| Electron app           | React + D3.js        | Desktop app distribution                 | Large bundle size, high dev cost |
| VS Code extension      | Webview + D3.js      | Editor integration, code navigation      | VS Code only                     |

**Decision: Browser-based visualization with local server**

- Primary: Browser display via local server
- Future: VS Code extension (Webview), Neovim plugin (browser + Telescope)

### 2. Architecture

```
┌────────────────────────────────────────────────────┐
│                    chizuts (Core)                  │
│  TypeScript: Code analysis → JSON dependency data  │
└────────────────────────────────────────────────────┘
                         │
                         ▼ JSON
        ┌────────────────┼──────────────────┐
        ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌────────────────┐
│  CLI + Web   │  │ VS Code Ext  │  │ Neovim Plugin  │
│  (Browser)   │  │  (Webview)   │  │  (Browser)     │
│              │  │              │  │  + Telescope   │
│ Cytoscape.js │  │ Cytoscape.js │  │ Cytoscape.js   │
└──────────────┘  └──────────────┘  └────────────────┘
```

Key design decisions:

- **Separate core logic**: Analysis engine as independent npm package
- **Shared Web UI**: Same HTML/JS/CSS reusable across all platforms
- **JSON as interchange format**: Core outputs JSON, UI consumes it

### 3. Language Selection

| Layer             | Language              | Reason                       |
| ----------------- | --------------------- | ---------------------------- |
| Core (analysis)   | TypeScript            | Uses TypeScript Compiler API |
| Web UI            | TypeScript + HTML/CSS | Cytoscape.js integration     |
| VS Code extension | TypeScript            | VS Code API                  |
| Neovim plugin     | Lua                   | Neovim native                |

### 4. Graph Visualization Library

We evaluated the following libraries:

| Library          | Characteristics                 | Large-scale Support          | Learning Curve | Best For                       |
| ---------------- | ------------------------------- | ---------------------------- | -------------- | ------------------------------ |
| D3.js            | Low-level, maximum flexibility  | △ Manual optimization needed | High           | Custom visualizations          |
| **Cytoscape.js** | Graph-specialized, rich layouts | ◎ Handles 10k+ nodes         | Medium         | Network diagrams, dependencies |
| vis.js           | Easy, physics simulation        | ○ Thousands of nodes         | Low            | Medium-scale networks          |
| ECharts          | General charting                | ○                            | Low            | Dashboards                     |
| Sigma.js         | WebGL, ultra-fast               | ◎◎ 100k+ nodes               | Medium         | Massive graphs                 |
| React Flow       | React-only, node-based UI       | ○                            | Low            | Flowcharts, editors            |
| Mermaid          | Text-based                      | △ Small-scale only           | Lowest         | Documentation                  |

**Decision: Cytoscape.js**

Reasons:

1. **Graph-specialized**: Designed specifically for network/graph visualization
2. **Rich layout algorithms**: Built-in support for dagre (hierarchical), elk, cola, etc.
3. **Graph operations API**: Node selection, path finding, filtering
4. **Performance**: Handles large graphs well out of the box
5. **Extension ecosystem**: Many plugins available (e.g., cytoscape-dagre, cytoscape-elk)
6. **Future-proof**: Can migrate to Sigma.js if graphs become extremely large

#### D3.js vs Cytoscape.js

| Aspect               | D3.js               | Cytoscape.js                         |
| -------------------- | ------------------- | ------------------------------------ |
| Abstraction level    | Low (DIY)           | High (graph-focused)                 |
| Layout algorithms    | force-directed only | dagre, elk, cola, breadthfirst, etc. |
| Large graph handling | Manual optimization | Built-in optimizations               |
| Learning curve       | Steep               | Moderate                             |
| Flexibility          | Maximum             | Graph-specific                       |
| Use case             | Any visualization   | Network/dependency graphs            |

D3.js is a general-purpose visualization library that can create anything, but requires more work for graph-specific features. Cytoscape.js is purpose-built for exactly our use case.

## Consequences

### Positive

- Single language (TypeScript) for core + web UI + VS Code extension
- Reusable UI components across platforms
- Cytoscape.js handles complex layout algorithms automatically
- Clear separation between analysis and visualization

### Negative

- Neovim plugin requires Lua (different language)
- Browser dependency for visualization
- Cytoscape.js has smaller community than D3.js

### Risks

- If graphs become extremely large (100k+ nodes), may need to migrate to Sigma.js
- VS Code Webview has some limitations compared to regular browser

## References

- [Cytoscape.js](https://js.cytoscape.org/)
- [D3.js](https://d3js.org/)
- [Sigma.js](https://www.sigmajs.org/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
