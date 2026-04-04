# Plan: MVP Feature Flag Management System

> Source PRD: [bipinrajbhar/togglr#1](https://github.com/bipinrajbhar/togglr/issues/1)

## Architectural decisions

- **Framework**: Next.js (App Router) — dashboard UI + API routes in one repo
- **Database**: PostgreSQL via Neon
- **Schema**:
  - `flags` — `id, name, key (unique, immutable), description, created_at`
  - `environments` — `id, name, slug, created_at`
  - `flag_states` — `flag_id, environment_id, enabled` (unique on both FKs; defaults to `false`)
  - `api_keys` — `id, environment_id, key_hash, created_at`
- **Key models**: Flag, Environment, FlagState, ApiKey
- **Routes**:
  - `GET /api/flags` — list flags; when called with `Authorization: Bearer sdk-xxx` returns states scoped to that environment; when called from dashboard (no auth) returns states for all environments
  - `POST /api/flags` — create flag, auto-slugify name → key
  - `PUT /api/flags/:key/toggle` — toggle enabled in one environment
  - `DELETE /api/flags/:key` — delete flag and all its states
  - `GET /api/environments` — list environments (no auth required)
  - `POST /api/environments` — create environment, generate API key, seed flag_states
  - `POST /api/environments/:id/rotate-key` — regenerate API key
- **Flag keys**: immutable after creation; used as the stable reference in consuming code
- **API key storage**: stored as SHA-256 hash; plaintext shown only once at creation
- **Default environments**: `production`, `staging`, `development` seeded on first run
- **Dashboard auth**: none (internal network tool)
- **SDK distribution**: TypeScript package published to GitHub Packages

---

## Phase 1: Project scaffold + Flags list (create & delete)

**User stories**: 1, 2, 3, 4, 5, 8, 9, 22, 23

### What to build

Scaffold a Next.js app connected to a Neon PostgreSQL database. Apply the full schema (all four tables) and seed the three default environments (`production`, `staging`, `development`) with their `flag_states` rows on startup. Build `POST /api/flags` (accepts name, optional key override, description; auto-slugifies name; initializes `flag_states` as disabled for all existing environments) and `DELETE /api/flags/:key`. Build an unauthenticated `GET /api/flags` that returns all flags with their enabled state per environment. Build the flags list page: a table of flags with per-environment enabled/disabled badges and a create-flag form (name input, auto-generated key shown inline and editable, description field). New flags always start disabled in all environments.

### Acceptance criteria

- [ ] Visiting the app shows a flags list (empty state handled gracefully)
- [ ] Creating a flag auto-generates a slug key from the name; key field is editable before submission
- [ ] Newly created flag appears in the list with "disabled" badge for each of the 3 default environments
- [ ] Deleting a flag removes it and all its `flag_states` rows
- [ ] `POST /api/flags` with a duplicate key returns a 409 error
- [ ] `GET /api/flags` (no auth) returns all flags with per-environment states

---

## Phase 2: Flag detail page + per-environment toggles

**User stories**: 6, 7, 8

### What to build

Build the flag detail page, accessible by clicking a flag in the list. The page shows the flag's name, key, description, and creation date, plus a toggle switch for each environment. Wire `PUT /api/flags/:key/toggle` (body: `{ environmentId }`) to flip the `enabled` column in `flag_states`. The flags list page should already show per-environment badges from Phase 1 — this phase makes those states writable from the detail view.

### Acceptance criteria

- [ ] Clicking a flag in the list navigates to its detail page
- [ ] Detail page shows flag metadata and one toggle per environment
- [ ] Toggling a switch updates the state immediately (optimistic UI or refetch)
- [ ] Toggling from the detail page is reflected in the list page badges on next visit
- [ ] `PUT /api/flags/:key/toggle` with an unknown key returns 404

---

## Phase 3: Environment management dashboard + API key lifecycle

**User stories**: 10, 11, 12, 13

### What to build

Build the environments page. It lists all environments with their masked API keys (e.g., `sdk-xxxx…xxxx`). Creating a new environment via `POST /api/environments` generates a raw API key (display it once, store only the hash), creates the environment row, and seeds `flag_states` (disabled) for every existing flag. `POST /api/environments/:id/rotate-key` invalidates the old key and generates a new one, showing the plaintext once. The environments page has a create form and a "Rotate key" button per environment.

### Acceptance criteria

- [ ] Environments page lists all environments with masked keys
- [ ] Creating an environment shows the full plaintext API key exactly once in the UI
- [ ] After creation, the new environment appears in the flag detail toggle list (seeded as disabled)
- [ ] Rotating a key shows the new plaintext key once and replaces the old hash in the DB
- [ ] Old API key is rejected immediately after rotation
- [ ] `POST /api/environments` seeds `flag_states` rows for all existing flags

---

## Phase 4: API key authentication for SDK endpoint

**User stories**: 11, 15 (server-side prerequisite)

### What to build

Gate `GET /api/flags` with `Authorization: Bearer sdk-xxx` when called from the SDK. Hash the incoming key, look it up in `api_keys`, and resolve the associated environment. Return only the `enabled` state for that environment (not all environments). Requests with an invalid or missing key return 401. Dashboard calls (no auth header) continue to return all-environment states — distinguish these by the absence of the `Authorization` header.

### Acceptance criteria

- [ ] `GET /api/flags` with a valid API key returns flags with a single `enabled` boolean scoped to that environment
- [ ] `GET /api/flags` with an invalid or missing key returns 401
- [ ] `GET /api/flags` with no `Authorization` header (dashboard path) returns per-environment states for all environments
- [ ] Rotated (old) API keys are rejected with 401
- [ ] Key comparison uses the stored hash, never the plaintext

---

## Phase 5: SDK package

**User stories**: 14, 15, 16, 17, 18, 19, 20, 21

### What to build

Build a TypeScript npm package (published to GitHub Packages as a private package under the `@bipinrajbhar` or org scope). Export a `FeatureFlagsClient` class whose constructor takes `{ apiKey: string, baseUrl: string, ttl?: number }` (default TTL: 30 seconds). `isEnabled(flagKey: string): Promise<boolean>` checks an in-memory `Map<string, boolean>` cache with a `fetchedAt` timestamp. On cache miss or TTL expiry, it calls `GET /api/flags` (single batch request) and repopulates the cache. If the API is unreachable and the cache is empty, `isEnabled()` returns `false`. The package has no React dependency and works in any Node.js service.

### Acceptance criteria

- [ ] `npm install` of the package works in a plain Node.js project
- [ ] `new FeatureFlagsClient({ apiKey, baseUrl })` initializes without errors
- [ ] `client.isEnabled('flag-key')` returns `true` or `false` matching the environment's state
- [ ] A second call within the TTL window does not make a second HTTP request
- [ ] A call after TTL expiry triggers a fresh fetch and repopulates the cache
- [ ] `isEnabled('nonexistent-flag')` returns `false` without throwing
- [ ] When the API is unreachable and cache is cold, `isEnabled()` returns `false` without throwing
- [ ] A single `GET /api/flags` call fetches all flags (no per-flag HTTP requests)
