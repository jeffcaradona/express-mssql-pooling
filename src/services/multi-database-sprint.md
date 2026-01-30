# Multi-Database Connection Support Sprint

> **Status:** Planning  
> **Target:** Future Sprint  
> **Last Updated:** January 29, 2026

## Overview

Refactor the database service to support multiple named database connections (e.g., "core" database server and "app" database server) while maintaining clean separation of concerns, testability, and backward compatibility.

---

## Problem Statement

The current `database.js` implementation uses a module-level singleton pattern:

```javascript
let pool = null;
let poolConnect = null;
```

This limits the application to a single database connection. As the application grows, we need to support:

- Separate database servers for different concerns (core infrastructure vs application data)
- Different connection configurations per database
- Independent lifecycle management for each connection pool

---

## Architectural Decision: Class + Functional Facade (Hybrid)

### Recommendation

Use a **class-based core** with a **functional facade** on top.

### Why Class-Based for the Core

| Benefit                    | Explanation                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| **Natural encapsulation**  | Each instance manages its own `pool`, `poolConnect`, `isShuttingDown` state |
| **Independent lifecycles** | Database A can be restarted without affecting Database B                    |
| **Constructor injection**  | Clean dependency injection for configs (improves testability)               |
| **Scalable**               | Easy to add N databases without module-level variable proliferation         |

### Why Functional Facade on Top

| Benefit                    | Explanation                                          |
| -------------------------- | ---------------------------------------------------- |
| **Backward compatibility** | Existing code continues to work with minimal changes |
| **Clean API**              | `getConnectionPool('core')` is intuitive             |
| **Registry pattern**       | Central management of named instances                |
| **Gradual migration**      | Can adopt incrementally                              |

---

## Implementation Tasks

### Phase 1: Core Infrastructure

- [ ] **Task 1.1:** Create `DatabaseConnection` class
  - Encapsulates: `pool`, `poolConnect`, `isShuttingDown`, `config`
  - Methods: `connect()`, `getPool()`, `executeQuery()`, `isHealthy()`, `close()`
  - Constructor accepts config object (dependency injection)

- [ ] **Task 1.2:** Create `DatabaseRegistry` module
  - Holds `Map<string, DatabaseConnection>` of named instances
  - Exports: `registerDatabase(name, config)`, `getDatabase(name)`, `getConnectionPool(name)`, `initializeDatabases(configs)`, `shutdownAll()`
  - Supports `'default'` alias for backward compatibility

- [ ] **Task 1.3:** Create config builder utility
  - `buildConfigFromEnv(prefix)` - builds config from prefixed env vars
  - Validation helper for required fields

### Phase 2: Integration

- [ ] **Task 2.1:** Update `server.js` initialization
  - Build config objects from environment variables
  - Call `initializeDatabases({ core: coreConfig, app: appConfig })`
  - Update graceful shutdown to call `shutdownAll()`

- [ ] **Task 2.2:** Update controllers
  - Modify `getConnectionPool()` calls to specify database name
  - Or rely on `'default'` for single-database scenarios

- [ ] **Task 2.3:** Update health check endpoint
  - Report health status for each registered database
  - Aggregate health for overall system status

### Phase 3: Testing & Documentation

- [ ] **Task 3.1:** Unit tests for `DatabaseConnection` class
  - Test with mock configs (no env vars needed)
  - Test error handling and pool recovery

- [ ] **Task 3.2:** Integration tests for multi-database scenarios
  - Test independent lifecycle management
  - Test graceful shutdown of multiple pools

- [ ] **Task 3.3:** Update documentation
  - [database.md](database.md) - Update with new architecture
  - [api_endpoints.md](../../docs/api_endpoints.md) - Update health endpoint docs
  - [SETUP_GUIDE.md](../../SETUP_GUIDE.md) - Add multi-database configuration

---

## Current Exports & Impact Analysis

| Export                | Current Signature                     | Change Required                                  |
| --------------------- | ------------------------------------- | ------------------------------------------------ |
| `getConnectionPool`   | `async () => Pool`                    | Add optional `name` parameter                    |
| `executeQuery`        | `async (queryFn, operationName) => T` | Add optional `dbName` parameter or keep on class |
| `initializeDatabase`  | `async () => void`                    | Replace with `initializeDatabases(configs)`      |
| `gracefulShutdown`    | `async (timeout) => void`             | Replace with `shutdownAll(timeout)`              |
| `initial_test`        | `async (recQy) => Array`              | Move to class method or remove from public API   |
| `testBadRecord`       | `async () => void`                    | Move to class method or test utilities           |
| `isPoolHealthy`       | `async () => boolean`                 | Add `name` parameter or move to class            |
| `resetConnectionPool` | `async () => void`                    | Move to class method                             |
| `closeConnectionPool` | `async () => void`                    | Move to class method                             |
| `closeAndResetPool`   | `async () => void`                    | Internal to class                                |

### Backward Compatibility Strategy

```javascript
// Old code (still works)
const pool = await getConnectionPool();

// New code (explicit database)
const corePool = await getConnectionPool("core");
const appPool = await getConnectionPool("app");
```

When `name` is omitted, use `'default'` database.

---

## Open Considerations

> **These questions must be answered before implementation begins.**

### 1. Environment Variable Strategy

**Question:** How should we configure multiple databases via environment variables?

| Option                    | Example                       | Pros                                 | Cons                                      |
| ------------------------- | ----------------------------- | ------------------------------------ | ----------------------------------------- |
| **A: Prefix-based**       | `CORE_DB_HOST`, `APP_DB_HOST` | Simple, explicit, easy to understand | Verbose, many env vars                    |
| **B: JSON config file**   | `config/databases.json`       | Clean, all in one place              | Another file to manage, secrets in files  |
| **C: JSON env var**       | `DATABASES='{"core":{...}}'`  | Single env var                       | Hard to read/edit, escaping issues        |
| **D: Connection strings** | `CORE_DB_URL=mssql://...`     | Standard format                      | Parsing complexity, less flexible options |

**Recommendation:** Option A (Prefix-based) for simplicity and explicitness.

**Decision:** `[ ] Pending`

---

### 2. executeQuery Location

**Question:** Should `executeQuery` be a class method or a standalone function?

| Option                      | Usage                            | Pros                                         | Cons                        |
| --------------------------- | -------------------------------- | -------------------------------------------- | --------------------------- |
| **A: Class method**         | `coreDb.executeQuery(fn, name)`  | Tied to specific connection, clear ownership | Requires instance reference |
| **B: Standalone with name** | `executeQuery(fn, name, 'core')` | Familiar API, backward compatible            | Extra parameter everywhere  |
| **C: Both**                 | Support either pattern           | Maximum flexibility                          | More code to maintain       |

**Recommendation:** Option A (class method) with Option B as a facade wrapper.

**Decision:** `[ ] Pending`

---

### 3. Health Check Granularity

**Question:** How should health endpoints report multi-database status?

| Option                | Response Shape                         | Pros             | Cons                            |
| --------------------- | -------------------------------------- | ---------------- | ------------------------------- |
| **A: Aggregate only** | `{ healthy: true/false }`              | Simple           | Loses detail on which DB failed |
| **B: Per-database**   | `{ core: true, app: false }`           | Detailed         | More complex response           |
| **C: Both**           | `{ healthy: false, databases: {...} }` | Complete picture | Larger payload                  |

**Recommendation:** Option C for production observability.

**Decision:** `[ ] Pending`

---

### 4. Default Database Behavior

**Question:** When only one database is configured, should it auto-register as `'default'`?

| Option                  | Behavior                            | Pros                        | Cons                       |
| ----------------------- | ----------------------------------- | --------------------------- | -------------------------- |
| **A: Auto-default**     | Single DB becomes `'default'`       | Zero config for simple apps | Magic behavior             |
| **B: Explicit only**    | Must specify `default: config`      | Clear intent                | More verbose               |
| **C: First-registered** | First DB registered becomes default | Convenient                  | Order-dependent, confusing |

**Recommendation:** Option A with Option B as override.

**Decision:** `[ ] Pending`

---

### 5. Error Handling Isolation

**Question:** Should a connection error in one database affect others?

| Option              | Behavior                                       | Pros            | Cons                             |
| ------------------- | ---------------------------------------------- | --------------- | -------------------------------- |
| **A: Isolated**     | Each pool handles its own errors independently | Fault isolation | Must check each DB separately    |
| **B: Cascading**    | Fatal error triggers app-wide shutdown         | Fail-fast       | One bad DB takes down everything |
| **C: Configurable** | `{ critical: true }` flag per database         | Flexible        | More configuration complexity    |

**Recommendation:** Option A (isolated) with Option C for critical databases.

**Decision:** `[ ] Pending`

---

## Proposed Class Structure

```javascript
// DatabaseConnection class (conceptual)
class DatabaseConnection {
  #pool = null;
  #poolConnect = null;
  #isShuttingDown = false;
  #config;
  #name;

  constructor(name, config) {
    this.#name = name;
    this.#config = config;
  }

  async connect() {
    /* ... */
  }
  async getPool() {
    /* ... */
  }
  async executeQuery(queryFn, operationName) {
    /* ... */
  }
  async isHealthy() {
    /* ... */
  }
  async close(drainTimeout) {
    /* ... */
  }
}

// Registry (conceptual)
const databases = new Map();

export function registerDatabase(name, config) {
  /* ... */
}
export function getDatabase(name = "default") {
  /* ... */
}
export function getConnectionPool(name = "default") {
  /* ... */
}
export async function initializeDatabases(configs) {
  /* ... */
}
export async function shutdownAll(drainTimeout) {
  /* ... */
}
```

---

## Files to Modify

| File                               | Changes                                 |
| ---------------------------------- | --------------------------------------- |
| `src/services/database.js`         | Major refactor - add class and registry |
| `src/server.js`                    | Update initialization and shutdown      |
| `src/controllers/apiController.js` | Specify database name in queries        |
| `src/routes/healthRoutes.js`       | Multi-database health reporting         |
| `docs/api_endpoints.md`            | Document new health response            |
| `SETUP_GUIDE.md`                   | Multi-database configuration guide      |
| `.env.example`                     | Add prefixed environment variables      |

---

## Acceptance Criteria

- [ ] Multiple databases can be configured and initialized
- [ ] Each database has independent connection pool lifecycle
- [ ] Graceful shutdown closes all pools properly
- [ ] Health endpoint reports status of all databases
- [ ] Backward compatible - existing single-database code works unchanged
- [ ] Unit tests pass with mock configurations
- [ ] Documentation updated for new architecture

---

## Dependencies

- None - this is an internal refactor with no new packages required

---

## Risks & Mitigations

| Risk                            | Impact | Mitigation                                            |
| ------------------------------- | ------ | ----------------------------------------------------- |
| Breaking existing API           | High   | Maintain backward compatibility with default database |
| Connection leak during refactor | Medium | Comprehensive testing, staged rollout                 |
| Configuration complexity        | Low    | Clear documentation, sensible defaults                |
| Performance overhead            | Low    | Map lookup is O(1), negligible impact                 |

---

## Notes

- This sprint can be broken into smaller PRs:
  1. PR1: Add `DatabaseConnection` class (no behavior change)
  2. PR2: Add `DatabaseRegistry` with backward-compatible exports
  3. PR3: Update `server.js` initialization
  4. PR4: Update controllers (can be done incrementally)
  5. PR5: Update health endpoints and documentation
