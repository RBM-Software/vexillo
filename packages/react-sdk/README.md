# @vexillo/react-sdk

React bindings for [Vexillo](https://vexillo-web.vercel.app) — a self-hosted feature flag service.

## Requirements

- React 18 or 19
- A running Vexillo deployment

## Installation

```sh
npm install @vexillo/react-sdk
```

## Usage

Create a client once and pass it to `<VexilloClientProvider>`. Flags are fetched on mount; components read them with `useFlag`.

```tsx
// vexillo.ts — create once, import anywhere
import { createVexilloClient } from "@vexillo/react-sdk";

export const client = createVexilloClient({
  baseUrl: "https://your-vexillo.example.com",
  apiKey: "your-api-key",
  fallbacks: { "new-checkout": false },
});
```

```tsx
// App.tsx
import { VexilloClientProvider } from "@vexillo/react-sdk";
import { client } from "./vexillo";

export default function App() {
  return (
    <VexilloClientProvider client={client}>
      <MyApp />
    </VexilloClientProvider>
  );
}
```

```tsx
// CheckoutButton.tsx
import { useFlag } from "@vexillo/react-sdk";

export function CheckoutButton() {
  const [newCheckout, isLoading] = useFlag("new-checkout");
  if (isLoading) return null;
  return newCheckout ? <NewCheckout /> : <OldCheckout />;
}
```

---

## API

### `createVexilloClient(config)`

Creates a feature flag client. Use the returned instance as the single source of truth for your app.

```ts
const client = createVexilloClient({
  baseUrl: "https://your-vexillo.example.com", // required
  apiKey: "your-api-key",                       // required
  initialFlags: { "new-checkout": false },      // optional — skip initial fetch
  fallbacks: { "new-checkout": false },         // optional — defaults for unknown keys
  onError: (err) => console.error(err),         // optional — called on load() failure
});
```

#### `client.load(): Promise<void>`

Fetches flags from the API and notifies all subscribers. Called automatically by `<VexilloClientProvider>` on mount if the client is not already ready.

#### `client.getFlag(key): boolean`

Synchronous read. Resolution order: overrides → remote → fallbacks → `false`.

#### `client.getAllFlags(): Record<string, boolean>`

Snapshot of all resolved flags (overrides + remote + fallbacks merged).

#### `client.override(flags): void`

Imperatively set flag values and notify subscribers immediately. Use `clearOverride` or `clearOverrides` to undo.

```ts
client.override({ "new-checkout": true });
// ... later:
client.clearOverride("new-checkout");
```

#### `client.clearOverride(key): void`

Remove the override for a specific key and notify subscribers.

#### `client.clearOverrides(): void`

Remove all overrides and notify subscribers.

#### `client.subscribe(key, listener): () => void`

Subscribe to changes on a specific flag key. Returns an unsubscribe function.

#### `client.subscribeAll(listener): () => void`

Subscribe to any flag change. Returns an unsubscribe function.

#### `client.isReady: boolean`

`true` once `load()` has resolved (or `initialFlags` was provided at creation).

#### `client.lastError: Error | null`

The error from the most recent failed `load()`, or `null`.

---

### `<VexilloClientProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `client` | `VexilloClient` | required | The client instance to provide |
| `children` | `ReactNode` | required | |

---

### `useFlag(key): [value, isLoading]`

Returns `[boolean, boolean]` — the current flag value and a loading indicator.

- `value` — current flag value. Falls back to `fallbacks[key]` then `false` for unknown keys or while the client is loading.
- `isLoading` — `true` until the client has loaded at least once. Use this to suppress flag-gated UI until flags are known, avoiding flash-of-wrong-content.
- Re-renders only when this specific key's value changes.
- Must be called inside a `<VexilloClientProvider>`.

```tsx
const [newCheckout, isLoading] = useFlag("new-checkout");
if (isLoading) return null; // or a skeleton
return newCheckout ? <NewCheckout /> : <OldCheckout />;
```

---

### `useVexilloClient(): VexilloClient`

Returns the nearest client from context. Use this escape hatch for imperative access in components (e.g. calling `override()` or `getAllFlags()` directly).

---

### `fetchFlags(baseUrl, apiKey): Promise<Record<string, boolean>>`

Low-level fetch helper. Returns a flat flag map, or an empty object on error — never throws. Useful when you need flags outside of a client instance.

---

### `createMockVexilloClient(options?)`

Creates a pre-seeded client for tests. `isReady` is `true` immediately — no network call, no setup.

```ts
const client = createMockVexilloClient({
  flags: { "new-checkout": true },
  fallbacks: { "dark-mode": false },
});
```

---

## Testing

Use `createMockVexilloClient` to avoid any network calls and set exact flag values per test:

```tsx
import { render, screen } from "@testing-library/react";
import { VexilloClientProvider, createMockVexilloClient } from "@vexillo/react-sdk";
import { CheckoutButton } from "./CheckoutButton";

function renderWithFlags(flags: Record<string, boolean>) {
  const client = createMockVexilloClient({ flags });
  return render(
    <VexilloClientProvider client={client}>
      <CheckoutButton />
    </VexilloClientProvider>,
  );
}

it("shows new checkout when flag is on", () => {
  renderWithFlags({ "new-checkout": true });
  expect(screen.getByTestId("new-checkout")).toBeInTheDocument();
});
```

For per-test overrides on a shared client, use `client.override()` and `client.clearOverrides()` in `afterEach`:

```ts
beforeEach(() => {
  client.override({ "new-checkout": true });
});

afterEach(() => {
  client.clearOverrides();
});
```

---

## Error handling

`load()` failures (network errors, non-2xx responses) are caught silently. `useFlag` falls back to `fallbacks[key] ?? false`. Flags will never crash your app. Errors are surfaced via `client.lastError` and the optional `onError` config callback.

## Bundler compatibility

| File | Format | Used by |
|---|---|---|
| `dist/index.js` | CJS | webpack 4, AEM, and legacy bundlers (via `main`) |
| `dist/index.mjs` | ESM | Vite, webpack 5, Rollup (via `module` / `exports.import`) |

No configuration needed — your bundler picks the right file automatically.
