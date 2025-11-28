# ADR-004: Supported File Types

Date: 2025-11-28

## Status

Accepted

## Context

graphts analyzes TypeScript/JavaScript codebases. We need to document which file types are supported by the TypeScript Compiler API and our file discovery mechanism.

## Decision

### Supported File Types

| File Type | Support | Description |
|-----------|---------|-------------|
| `.ts` | ✅ | Standard TypeScript |
| `.tsx` | ✅ | TypeScript + JSX (React, etc.) |
| `.js` | ✅ | JavaScript (requires `allowJs` in tsconfig) |
| `.jsx` | ✅ | JavaScript + JSX |
| `.mts` | ✅ | ES Module TypeScript |
| `.cts` | ✅ | CommonJS TypeScript |
| `.d.ts` | ❌ | Type declaration files (excluded from analysis) |

### JSX Support

For `.tsx` and `.jsx` files, the TypeScript Compiler API handles JSX syntax natively. This enables:

- React component detection
- JSX element dependency tracking
- Props type analysis

### File Discovery

The `FileReaderAdapter` discovers files with the following logic:

```typescript
private isTypeScriptFile(fileName: string): boolean {
  return (
    (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) &&
    !fileName.endsWith('.d.ts')
  );
}
```

### Default Exclusions

The following paths are excluded by default:

- `**/node_modules/**`
- `**/dist/**`

## Consequences

### Positive

- Full support for modern TypeScript/React projects
- JSX components are treated as first-class citizens
- Declaration files are excluded to avoid noise

### Negative

- JavaScript files require explicit `allowJs` configuration
- Vue/Svelte single-file components are not supported (would require additional parsers)

## Future Considerations

- Add support for `.vue` files (Vue single-file components)
- Add support for `.svelte` files
- Add configurable file extensions via CLI options
