# graphts

A TypeScript codebase analyzer that visualizes dependencies between modules, functions, variables, and components as a graph.

## Features

- Analyze TypeScript project dependencies
- Detect relationships between modules, functions, variables, and components
- Generate visual dependency graphs
- CLI tool for easy integration

## Installation & Usage

```bash
# Using npx (no installation required)
npx graphts

# Or install as a dev dependency
npm install --save-dev graphts
npm run graphts
```

## Requirements

- Node.js >= 18.0.0
- TypeScript project with `tsconfig.json`

## How It Works

graphts uses the TypeScript Compiler API to parse and analyze your codebase, extracting:

- **Module dependencies** - import/export relationships between files
- **Function calls** - which functions call which other functions
- **Variable references** - how variables are used across the codebase
- **Component hierarchies** - parent-child relationships in React/Vue components

The extracted data is then rendered as an interactive graph visualization.

## Development

```bash
# Clone the repository
git clone https://github.com/krzmknt/graphts.git
cd graphts

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## License

[MIT](LICENSE)

## Author

krzmknt
