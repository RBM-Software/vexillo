# REST vs. Streaming

> Scale context: ~1M visits/month, e-commerce storefront.

---

## TL;DR

Use **REST** by default. Switch to **Streaming** only where flag latency is business-critical (checkout, flash sales, kill switches).

In a **multi-region** deployment, the calculus shifts: streaming eliminates the need for a secondary database, while REST does not. At two regions, streaming is cheaper overall.

---

## Comparison

| | REST `GET /api/sdk/flags` | Streaming `GET /api/sdk/flags/stream` |
|---|---|---|
| Flag freshness (single-region) | Up to ~6 min (CDN + snapshot cache) | ~5–20 ms after toggle |
| Flag freshness (multi-region) | Up to ~6 min (CloudFront TTL unaffected by fan-out) | <5 s (fan-out → pub/sub → SSE clients) |
| CDN-cacheable | Yes — `s-maxage=300, swr=60` | No |
| Server connections | Stateless | ~1,150 persistent at 1M visits/month peak |
| Redis required | No | Yes (multi-instance deployments) |
| Secondary DB required (multi-region) | Yes — REST cache misses hit RDS cross-region (~80–100 ms) | No — fan-out keeps snapshotCache warm; DB only on cold starts |
| Est. AWS cost/month (single-region) | ~$12–25 | ~$47–95 |
| Est. AWS cost/month (two regions) | ~$55–115 | ~$94–190 |
| Use for | Catalog, PDPs, SSR, SEO | Checkout, flash sales, kill switches |

---

## Cost Breakdown

### REST (~$12–25/month, single region)

CloudFront caches responses per API key, not per user. At 1M visits/month, >95% of requests are served from edge cache — fewer than 1 req/s reaches your origin.

| | Est./month |
|---|---|
| CloudFront (1M requests + ~10 GB transfer) | $2–5 |
| ECS (one small task covers origin load) | $10–20 |

### Streaming (~$47–95/month, single region)

Every tab holds an open connection to your origin — no CDN buffering. At 1M visits/month with ~5-min avg sessions, expect ~1,150 concurrent connections at peak.

| | Est./month |
|---|---|
| CloudFront | $2–5 |
| ECS (more tasks for persistent connections) | $30–60 |
| ElastiCache Redis (required for multi-instance) | $15–30 |

---

## Multi-Region Cost

### REST (two regions, ~$55–115/month)

Fan-out propagates the snapshot to the secondary's in-memory cache, but CloudFront's edge cache is independent — REST clients in the secondary still see stale responses for up to 5 minutes after a toggle. To avoid cross-region DB latency on cache misses, a second database is needed.

| | Est./month |
|---|---|
| REST costs × 2 regions | $24–50 |
| RDS in secondary region (cache misses hit DB) | $15–30 |
| Cross-region data transfer | $5–10 |
| Fan-out infra (SSM, minimal ECS overhead) | <$5 |

> Without a secondary DB, REST cache misses in eu-west-1 fall through to RDS in us-east-1 (~80–100 ms). Acceptable for low-traffic paths; noticeable at scale.

### Streaming (two regions, ~$94–190/month)

The fan-out keeps each secondary's `snapshotCache` warm after every toggle. SSE clients in the secondary receive updates in under 5 seconds. No secondary database is needed — the DB is only touched on cold starts.

| | Est./month |
|---|---|
| Streaming costs × 2 regions | $94–190 |
| Secondary DB | $0 — not required |
| Cross-region data transfer (fan-out payloads) | <$2 |

**At two regions, streaming costs less than REST** once you account for the secondary database REST requires. The gap widens with each additional region.

---

## When to Use Each

**REST** — anything where a 5-minute flag lag is acceptable:
- Product catalog, PDPs, homepage
- SSR pages (`fetchFlags()` at request time, pass as `initialFlags`)
- Gradual rollouts, UI experiments
- Single-region deployments

**Streaming** — when the lag is not acceptable, or you're running multi-region:
- Flash sales toggled at an exact time
- Kill switches on a broken payment flow
- Checkout funnel A/B tests that must apply mid-session
- Any multi-region deployment where you want <5 s propagation without a secondary DB

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

**Multi-region fan-out:** Fire-and-forget — if the primary cannot reach a secondary at toggle time, the event is lost. The secondary falls back to serving its cached snapshot until the 30 s TTL expires and it refetches from the primary's RDS. No retry queue; missed events are bounded by cache TTL, not indefinite.
