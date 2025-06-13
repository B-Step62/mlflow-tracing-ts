# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Building and Testing
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run test` - Run Jest tests
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Single Test Execution
Use Jest's pattern matching: `npm test -- --testNamePattern="<test name>"` or `npm test <test-file-path>`

## Architecture

This is a TypeScript SDK for MLflow Tracing that provides LLM observability using OpenTelemetry as the underlying tracing infrastructure.

### Core Components

**Configuration System** (`src/core/config.ts`):
- `configure()` function must be called before using tracing APIs
- Supports Databricks tracking URIs with profile-based authentication
- Reads from `~/.databrickscfg` for Databricks credentials

**Tracing APIs** (`src/core/api.ts`):
- `startSpan(options)` - Manual span creation (requires explicit `end()`)
- `withSpan(options?, callback)` - Automatic span lifecycle management
- Both create MLflow spans backed by OpenTelemetry spans

**Span Architecture** (`src/core/entities/span.ts`):
- `LiveSpan` - Active spans with full functionality
- `NoOpSpan` - Fallback when tracing fails
- MLflow spans wrap OpenTelemetry spans and add MLflow-specific metadata

**Trace Management** (`src/core/trace_manager.ts`):
- `InMemoryTraceManager` - Singleton managing active traces and spans
- Maps OpenTelemetry trace IDs to MLflow trace IDs
- Handles span registration and trace lifecycle

**Export Pipeline** (`src/exporters/mlflow.ts`):
- `MlflowSpanProcessor` - Processes span lifecycle events
- `MlflowSpanExporter` - Exports completed traces (currently stores in memory for testing)
- Only root spans trigger trace export

**Databricks Client** (`src/clients/DatabricksClient.ts`):
- Complete REST API client for Databricks MLflow backend
- Trace lifecycle: `startTrace()`, `endTrace()`, batch operations
- Trace retrieval: `getTrace()`, `searchTraces()` with filtering
- Tag management: `setTraceTag()`, `deleteTraceTag()`
- Health checking and error handling

### Key Patterns

- All spans are backed by OpenTelemetry spans for context propagation
- MLflow trace IDs are generated from OpenTelemetry trace IDs with prefix
- Configuration is required before any tracing operations
- Error handling falls back to NoOp patterns to avoid breaking user code
- Span deduplication is performed before export

### Testing

Tests are located in `tests/` mirroring the `src/` structure. Uses Jest with ts-jest preset.