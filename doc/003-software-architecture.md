# ADR-003: Software Architecture

Date: 2025-11-28

## Status

Accepted

## Context

As graphts grows, we need a clear architecture to:

- Maintain code quality and testability
- Enable future extensibility (VS Code extension, Neovim plugin)
- Prevent the codebase from becoming tangled
- Make onboarding easier for contributors

## Decision

### Architecture Pattern: Clean Architecture

We adopt Clean Architecture with strict boundaries between layers.

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry Points (CLI, Web)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│              (Use cases, orchestration)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│    Domain Layer     │   │  Infrastructure     │
│   (Core, Pure)      │◄──│    (Adapters)       │
│                     │   │                     │
└─────────────────────┘   └─────────────────────┘
```

### Directory Structure

```
src/
├── domain/                  # Domain layer (PURE - no external deps)
│   ├── models/              # Domain entities
│   │   ├── node.ts          # Node entity
│   │   ├── edge.ts          # Edge entity
│   │   ├── graph.ts         # DependencyGraph aggregate
│   │   └── index.ts
│   ├── services/            # Domain services (pure business logic)
│   │   ├── graph-builder.ts # Builds graph from parsed data
│   │   └── index.ts
│   └── ports/               # Interfaces (contracts for adapters)
│       ├── parser.port.ts   # IParser interface
│       ├── file-reader.port.ts
│       └── index.ts
│
├── application/             # Application layer (use cases)
│   ├── analyze-project/     # Main use case
│   │   ├── analyze-project.usecase.ts
│   │   └── index.ts
│   └── index.ts
│
├── infrastructure/          # Infrastructure layer (adapters)
│   ├── typescript-parser/   # TS Compiler API implementation
│   │   ├── typescript-parser.adapter.ts
│   │   └── index.ts
│   ├── file-system/         # Node.js fs implementation
│   │   ├── file-reader.adapter.ts
│   │   └── index.ts
│   └── index.ts
│
├── cli/                     # CLI entry point
│   ├── index.ts             # Main entry
│   ├── commands/            # Command handlers
│   │   └── analyze.command.ts
│   └── output/              # Output formatters
│       ├── json.formatter.ts
│       └── table.formatter.ts
│
└── web/                     # Web UI entry point
    ├── server/
    │   └── index.ts
    └── public/
        └── index.html
```

### Layer Rules

#### Domain Layer (`src/domain/`)

- **MUST** be pure (no side effects)
- **MUST NOT** import from `application/`, `infrastructure/`, `cli/`, `web/`
- **MUST NOT** import external packages (except type-only imports)
- **MAY** define interfaces in `ports/` for external dependencies
- **SHOULD** be fully unit testable without mocks

#### Application Layer (`src/application/`)

- **MAY** import from `domain/`
- **MUST NOT** import from `infrastructure/`, `cli/`, `web/`
- **MUST** receive adapters via dependency injection
- **SHOULD** contain use case orchestration logic

#### Infrastructure Layer (`src/infrastructure/`)

- **MAY** import from `domain/` (to implement ports)
- **MUST NOT** import from `application/`, `cli/`, `web/`
- **MAY** import external packages (typescript, fs, etc.)
- **MUST** implement interfaces defined in `domain/ports/`

#### Entry Points (`src/cli/`, `src/web/`)

- **MAY** import from all layers
- **MUST** wire up dependency injection
- **SHOULD** be thin (delegate to application layer)

### Dependency Direction

```
cli/web → application → domain ← infrastructure
                           ↑
                      implements ports
```

The `domain` layer is at the center and has NO outward dependencies.
`infrastructure` depends on `domain` only to implement its interfaces.

### Dependency Injection

Entry points are responsible for wiring dependencies:

```typescript
// cli/index.ts
import { AnalyzeProjectUseCase } from '@/application';
import { TypeScriptParserAdapter } from '@/infrastructure/typescript-parser';
import { FileReaderAdapter } from '@/infrastructure/file-system';

const parser = new TypeScriptParserAdapter();
const fileReader = new FileReaderAdapter();
const analyzeProject = new AnalyzeProjectUseCase(parser, fileReader);

const graph = analyzeProject.execute({ rootDir: process.cwd() });
```

### Naming Conventions

| Layer | Suffix | Example |
|-------|--------|---------|
| Domain models | (none) | `Node`, `Edge`, `Graph` |
| Domain services | (none) | `GraphBuilder` |
| Ports | `.port.ts` | `parser.port.ts` |
| Use cases | `.usecase.ts` | `analyze-project.usecase.ts` |
| Adapters | `.adapter.ts` | `typescript-parser.adapter.ts` |
| Commands | `.command.ts` | `analyze.command.ts` |
| Formatters | `.formatter.ts` | `json.formatter.ts` |

### Enforcement

Architecture rules are enforced using ESLint's built-in `no-restricted-imports` rule:

```javascript
// eslint.config.js
// Domain layer: no imports from other layers
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/application/**', '**/infrastructure/**', '**/cli/**', '**/web/**'],
            message: 'Domain layer cannot import from application, infrastructure, cli, or web layers.',
          },
        ],
      },
    ],
  },
},
// Application layer: can only import from domain
{
  files: ['src/application/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/infrastructure/**', '**/cli/**', '**/web/**'],
            message: 'Application layer can only import from domain layer.',
          },
        ],
      },
    ],
  },
},
// Infrastructure layer: can only import from domain
{
  files: ['src/infrastructure/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/application/**', '**/cli/**', '**/web/**'],
            message: 'Infrastructure layer can only import from domain layer.',
          },
        ],
      },
    ],
  },
},
```

This approach uses relative imports (`../../domain/index.js`) which work natively with
Node.js ESM and `moduleResolution: "NodeNext"` without requiring additional tooling.

## Consequences

### Positive

- Clear boundaries prevent spaghetti code
- Domain logic is fully testable without mocks
- Easy to swap implementations (e.g., different parsers)
- VS Code/Neovim extensions can reuse `domain` + `application`
- ESLint enforces rules automatically

### Negative

- More files and directories
- Boilerplate for simple changes
- Learning curve for contributors unfamiliar with Clean Architecture

### Trade-offs

- We accept more structure for better maintainability
- Small features may feel over-engineered initially
- Worth it for long-term project health

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
