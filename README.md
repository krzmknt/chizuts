# graphts

A TypeScript codebase analyzer that visualizes dependencies between modules, functions, variables, and components as a graph.

[![CI](https://github.com/krzmknt/graphts/actions/workflows/ci.yml/badge.svg)](https://github.com/krzmknt/graphts/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/graphts.svg)](https://www.npmjs.com/package/graphts)

## Features

- Analyze TypeScript project dependencies
- Detect relationships between modules, functions, variables, and components
- Generate interactive visual dependency graphs
- CLI tool for easy integration
- Web-based visualization with Cytoscape.js

## Installation & Usage

```bash
# Using npx (no installation required)
npx graphts

# Or install globally
npm install -g graphts
graphts

# Or install as a dev dependency
npm install --save-dev graphts
npx graphts
```

## CLI Options

```bash
graphts [options] [directory]

Options:
  -h, --help              Show help message
  -v, --version           Show version number
  -p, --port <port>       Server port (default: 3000)
  --include <pattern>     Include files matching pattern (can be used multiple times)
  --exclude <pattern>     Exclude files matching pattern (can be used multiple times)
  --tsconfig <path>       Path to tsconfig.json

Examples:
  graphts                           # Analyze current directory
  graphts ./src                     # Analyze specific directory
  graphts -p 8080                   # Use custom port
  graphts --exclude "**/*.test.ts"  # Exclude test files
```

## Requirements

- Node.js >= 20.0.0
- TypeScript project with `tsconfig.json`

## How It Works

graphts uses the TypeScript Compiler API to parse and analyze your codebase, extracting:

- **Module dependencies** - import/export relationships between files
- **Function declarations** - exported and internal functions
- **Class declarations** - classes and their inheritance hierarchies
- **Interface and Type definitions** - type system structures
- **React components** - both functional and class-based components

The extracted data is rendered as an interactive graph visualization in your browser.

## Development

```bash
# Clone the repository
git clone https://github.com/krzmknt/graphts.git
cd graphts

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run locally
pnpm start
```

## License

[MIT](LICENSE)

## Author

krzmknt
