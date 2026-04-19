# REST vs. Streaming

> Scale context: ~1M visits/month, e-commerce storefront.

---

## TL;DR

Use **REST** by default. Switch to **Streaming** only where flag latency is business-critical (checkout, flash sales, kill switches).

---

## Comparison

| | REST `GET /api/sdk/flags` | Streaming `GET /api/sdk/flags/stream` |
|---|---|---|
| Flag freshness | Up to ~6 min (CDN + snapshot cache) | ~5–20 ms after toggle |
| CDN-cacheable | Yes — `s-maxage=300, swr=60` | No |
| Server connections | Stateless | ~1,150 persistent at 1M visits/month peak |
| Redis required | No | Yes (multi-instance deployments) |
| Est. AWS cost/month | ~$12–25 | ~$47–95 |
| Use for | Catalog, PDPs, SSR, SEO | Checkout, flash sales, kill switches |

---

## Cost Breakdown

### REST (~$12–25/month)

CloudFront caches responses per API key, not per user. At 1M visits/month, >95% of requests are served from edge cache — fewer than 1 req/s reaches your origin.

| | Est./month |
|---|---|
| CloudFront (1M requests + ~10 GB transfer) | $2–5 |
| ECS (one small task covers origin load) | $10–20 |

### Streaming (~$47–95/month)

Every tab holds an open connection to your origin — no CDN buffering. At 1M visits/month with ~5-min avg sessions, expect ~1,150 concurrent connections at peak.

| | Est./month |
|---|---|
| CloudFront | $2–5 |
| ECS (more tasks for persistent connections) | $30–60 |
| ElastiCache Redis (required for multi-instance) | $15–30 |

---

## When to Use Each

**REST** — anything where a 5-minute flag lag is acceptable:
- Product catalog, PDPs, homepage
- SSR pages (`fetchFlags()` at request time, pass as `initialFlags`)
- Gradual rollouts, UI experiments

**Streaming** — when the lag is not acceptable:
- Flash sales toggled at an exact time
- Kill switches on a broken payment flow
- Checkout funnel A/B tests that must apply mid-session

---

## Usage

```tsx
// REST (default)
<VexilloClientProvider client={client}>
  <CatalogPage />
</VexilloClientProvider>

// Streaming
<VexilloClientProvider client={client} streaming>
  <CheckoutFlow />
</VexilloClientProvider>
```

For SSR, pre-fetch to avoid a loading flash:
```ts
const initialFlags = await fetchFlags(baseUrl, apiKey)
const client = createVexilloClient({ apiKey, baseUrl, initialFlags })
// client.isReady === true before first render
```

---

## Resilience

**REST:** CDN serves stale on origin failure up to the `stale-while-revalidate` window. After that, SDK falls back to defaults (`false` for all flags).

**Streaming:** SDK auto-reconnects with exponential backoff (1 s → 30 s max). On connect, it races a REST request in parallel — flags are never blank even if the SSE handshake is slow.
