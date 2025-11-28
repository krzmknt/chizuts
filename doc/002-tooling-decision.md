# ADR-002: Development Tooling Decision

Date: 2025-11-28

## Status

Accepted

## Context

We need to select development tools for:

1. Linting - Static code analysis
2. Formatting - Code style consistency
3. Testing - Unit and integration tests

## Decision

### Linter: ESLint

| Tool | Characteristics | Recommendation |
| -------- | ---------------------------------------- | -------------- |
| **ESLint** | De facto standard, rich rule ecosystem | ◎ Selected |
| Biome | Fast (Rust), combines linter + formatter | ○ Emerging |
| TSLint | Deprecated (merged into ESLint) | ✗ |

**Decision: ESLint**

Reasons:

1. Industry standard with largest ecosystem
2. Extensive TypeScript support via `@typescript-eslint`
3. Rich plugin availability (import sorting, etc.)
4. Wide IDE/editor integration

### Formatter: Prettier

| Tool | Characteristics | Recommendation |
| ------------ | ----------------------------------- | -------------- |
| **Prettier** | De facto standard, opinionated | ◎ Selected |
| Biome | Integrated with linter, fast | ○ |
| dprint | Rust-based, fast | △ |

**Decision: Prettier**

Reasons:

1. Most widely adopted formatter
2. Minimal configuration needed (opinionated)
3. Excellent ESLint integration via `eslint-config-prettier`
4. Supports multiple file types (JSON, MD, YAML, etc.)

### Test Framework: Vitest

| Tool | Characteristics | Recommendation |
| -------------------- | ----------------------------------------- | -------------- |
| **Vitest** | Fast, ESM native, Jest-compatible API | ◎ Selected |
| Jest | Battle-tested, large ecosystem | ○ |
| Node.js test runner | Built-in, minimal features | △ |

**Decision: Vitest**

Reasons:

1. Native ESM support (important for modern TypeScript)
2. Fast execution with smart caching
3. Jest-compatible API (easy migration if needed)
4. Built-in TypeScript support without additional config
5. Watch mode with HMR-like speed
6. Built-in coverage reporting

## Configuration

### ESLint

Using flat config format (`eslint.config.js`):

- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-config-prettier` (disables formatting rules)

### Prettier

Minimal configuration in `.prettierrc`:

- Semi-colons: enabled
- Single quotes: enabled
- Tab width: 2

### Vitest

Configuration in `vitest.config.ts`:

- TypeScript support
- Coverage with v8

## Package Versions

```json
{
  "devDependencies": {
    "eslint": "^9.x",
    "@typescript-eslint/eslint-plugin": "^8.x",
    "@typescript-eslint/parser": "^8.x",
    "eslint-config-prettier": "^9.x",
    "prettier": "^3.x",
    "vitest": "^2.x"
  }
}
```

## Consequences

### Positive

- Well-established tools with strong community support
- Consistent code style across the project
- Fast test execution with Vitest
- Easy onboarding for contributors familiar with these tools

### Negative

- Two separate tools for linting and formatting (vs Biome all-in-one)
- ESLint can be slower than Biome for large codebases

### Scripts

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

## References

- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)
- [Vitest](https://vitest.dev/)
- [typescript-eslint](https://typescript-eslint.io/)
