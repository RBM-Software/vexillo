# Architecture

> Scale context: ~1M visits/month, e-commerce storefront.

---

## System Overview

```mermaid
graph TD
    subgraph Clients
        Dashboard["Dashboard UI\n(React SPA)"]
        SDK_REST["SDK — REST mode\ncreateVexilloClient()"]
        SDK_SSE["SDK — Streaming mode\ncreateVexilloClient()"]
    end

    subgraph Edge
        CF["CloudFront\n(global CDN)"]
        S3["S3\n(SPA assets)"]
    end

    subgraph Primary["Primary Region (us-east-1)"]
        ALB_P["ALB"]
        ECS_P["ECS Fargate\n(2–4 tasks)"]
        Redis_P["ElastiCache Redis\n(optional)"]
        RDS["RDS Postgres"]
    end

    subgraph Secondary["Secondary Region (eu-west-1, …)"]
        ALB_S["ALB"]
        ECS_S["ECS Fargate\n(2–4 tasks)"]
        Redis_S["ElastiCache Redis\n(optional)"]
    end

    Dashboard -->|"GET /"| CF
    CF -->|SPA assets| S3
    CF -->|"/api/dashboard/*\n(no cache)"| ALB_P
    CF -->|"/api/sdk/flags\n(300s cache)"| ALB_P
    CF -->|"/api/sdk/flags/stream\n(no cache)"| ALB_P

    SDK_REST -->|"GET /api/sdk/flags"| CF
    SDK_SSE -->|"GET /api/sdk/flags (race)"| CF
    SDK_SSE -->|"GET /api/sdk/flags/stream"| CF

    ALB_P --> ECS_P
    ECS_P --> RDS
    ECS_P <-->|"pub/sub"| Redis_P

    ECS_P -->|"POST /internal/flag-change\n(fire-and-forget)"| ALB_S
    ALB_S --> ECS_S
    ECS_S -->|"cross-region read"| RDS
    ECS_S <-->|"pub/sub"| Redis_S
```

---

## Flag Toggle — Propagation Flow

When an admin toggles a flag in the dashboard, updates reach all connected clients within seconds.

```mermaid
sequenceDiagram
    participant Admin as Dashboard UI
    participant API as ECS (primary)
    participant DB as RDS
    participant Cache as snapshotCache
    participant Redis as Redis (primary)
    participant SSE_P as SSE clients (primary)
    participant Sec as ECS (secondary)
    participant Redis_S as Redis (secondary)
    participant SSE_S as SSE clients (secondary)

    Admin->>API: POST /api/dashboard/.../toggle
    API->>DB: UPDATE flagStates SET enabled = …
    API->>Cache: snapshotCache.set(envId, payload)
    API-->>Sec: POST /internal/flag-change (fire-and-forget)
    API->>Redis: PUBLISH flags:env:{envId}
    Redis-->>SSE_P: broadcast snapshot
    SSE_P-->>Admin: SSE event (if streaming)

    Sec->>Cache: snapshotCache.set(envId, payload)
    Sec->>Redis_S: PUBLISH flags:env:{envId}
    Redis_S-->>SSE_S: broadcast snapshot
```

The fan-out to secondary regions is fire-and-forget — it does not block the primary's response. If the secondary misses an event, its `snapshotCache` expires after 30 s and the next request re-queries RDS in us-east-1 as a fallback.

---

## REST Request — Cache Layers

A REST client hitting `/api/sdk/flags` passes through three cache layers before touching the database.

```mermaid
flowchart LR
    Client["SDK\nGET /api/sdk/flags"]
    CF["CloudFront\n300s TTL\n+60s stale-while-revalidate"]
    Auth["authCache\n30s LRU\nAPI key → env lookup"]
    Snap["snapshotCache\n30s LRU\nflag snapshot per env"]
    DB["RDS Postgres"]

    Client --> CF
    CF -->|"cache miss (<5% of requests)"| Auth
    Auth --> Snap
    Snap -->|"cache miss"| DB
    DB -->|"result cached immediately"| Snap
```

At 1M visits/month, over 95% of requests are served from CloudFront without reaching ECS.

---

## Streaming — Connection Lifecycle

```mermaid
sequenceDiagram
    participant SDK as SDK (streaming mode)
    participant CF as CloudFront
    participant ECS as ECS
    participant Redis as Redis

    SDK->>CF: GET /api/sdk/flags (REST race)
    SDK->>CF: GET /api/sdk/flags/stream (SSE)
    CF-->>ECS: /api/sdk/flags (cache hit, ~50ms)
    ECS-->>SDK: {flags: […]} → isReady = true

    CF-->>ECS: /api/sdk/flags/stream (no cache)
    ECS->>Redis: SUBSCRIBE flags:env:{envId}
    ECS-->>SDK: SSE: initial snapshot (overwrites REST)

    loop on flag toggle
        Redis-->>ECS: message: new snapshot
        ECS-->>SDK: SSE: updated snapshot
    end

    loop every 25s
        ECS-->>SDK: SSE: ": keepalive"
    end

    SDK->>ECS: disconnect / reconnect
    ECS->>Redis: UNSUBSCRIBE (if last client for env)
```

The REST race on connect means `isReady` is `true` and components render with real values before the SSE handshake completes. The SSE snapshot then overwrites the cached REST value once it arrives.

---

## Infrastructure Summary

| Component               | Detail                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CloudFront              | Global CDN; caches `/api/sdk/flags` at edge (300 s + 60 s SWR); no cache for dashboard or SSE                      |
| ECS Fargate             | 256 CPU / 512 MB per task; 2 min, 4 max; scales at 65% CPU; 120 s idle timeout (SSE kept alive by 25 s keepalives) |
| RDS Postgres            | t4g.micro; primary region only; isolated VPC subnet; 7-day backup retention                                        |
| ElastiCache Redis       | Optional; required for multi-container SSE fan-out; one channel per environment (`flags:env:{envId}`)              |
| Secondary regions       | No RDS — read primary's DB via `DATABASE_URL`; local Redis for in-region SSE fan-out                               |
| `/internal/flag-change` | ALB-only route (not exposed via CloudFront); protected by `X-Internal-Secret` header                               |
