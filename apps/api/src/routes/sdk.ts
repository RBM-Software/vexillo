import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiKeys, environments, organizations, flags, flagStates, queryEnvironmentFlagStates } from '@vexillo/db';
import type { DbClient } from '@vexillo/db';
import { hashKey } from '../lib/api-key';

// ── Stream registry ───────────────────────────────────────────────────────────

type FlagEvent = { flags: { key: string; enabled: boolean }[] };

export class StreamRegistry {
  private streams = new Map<string, Set<(event: FlagEvent) => void>>();

  register(environmentId: string, send: (event: FlagEvent) => void): () => void {
    let set = this.streams.get(environmentId);
    if (!set) { set = new Set(); this.streams.set(environmentId, set); }
    set.add(send);
    return () => {
      set!.delete(send);
      if (set!.size === 0) this.streams.delete(environmentId);
    };
  }

  broadcast(environmentId: string, event: FlagEvent): void {
    const set = this.streams.get(environmentId);
    if (!set) return;
    for (const send of set) send(event);
  }
}

// CORS headers used on pre-env-lookup error responses (401, env-not-found 403).
// We use * here because we don't yet know the environment's allowedOrigins, but
// browsers still need to read the error body (e.g. to surface "Unauthorized").
const SDK_ERROR_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
} as const;

/**
 * Compute the CORS origin value to echo back for a successful response.
 *
 * Rules (matches security plan Phase 4):
 * - No `Origin` header → non-browser/server request; return '*' (harmless, SDK-friendly).
 * - `allowedOrigins` includes '*' → wildcard environment; return '*'.
 * - `allowedOrigins` includes the exact origin → return that origin.
 * - Otherwise → return null (caller must 403).
 */
function resolveAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: string[],
): string | null {
  if (!requestOrigin) return '*';
  if (allowedOrigins.includes('*')) return '*';
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return null;
}

// ── OpenAPI schemas ───────────────────────────────────────────────────────────

const ErrorSchema = z.object({ error: z.string() }).openapi('Error');

const FlagSchema = z
  .object({ key: z.string(), enabled: z.boolean() })
  .openapi('Flag');

const FlagsResponseSchema = z
  .object({ flags: z.array(FlagSchema) })
  .openapi('FlagsResponse');

// ── Route definitions ─────────────────────────────────────────────────────────

const getFlagsRoute = createRoute({
  method: 'get',
  path: '/flags',
  operationId: 'getFlags',
  summary: 'Get feature flags for an environment',
  description:
    'Returns all flag states for the environment associated with the provided API key. ' +
    'Authentication is via `Authorization: Bearer <api-key>`.',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: FlagsResponseSchema } },
      description: 'Flag states for the environment',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Missing or invalid Bearer token',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description:
        'API key valid but environment not found, org suspended, or Origin not in the allowlist',
    },
  },
});

const getFlagsStreamRoute = createRoute({
  method: 'get',
  path: '/flags/stream',
  operationId: 'getFlagsStream',
  summary: 'Feature flag SSE stream',
  security: [{ BearerAuth: [] }],
  description:
    'Server-sent events stream. Emits the full flag snapshot immediately on connect, ' +
    'then pushes a new snapshot whenever a flag is toggled. Keepalive comments are sent ' +
    'every 25 seconds to prevent the CloudFront read timeout (60 s) from closing the connection.',
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ example: 'data: {"flags":[{"key":"my-flag","enabled":true}]}' }),
        },
      },
      description:
        'SSE stream. Each event is a JSON object: data: {"flags":[{"key":string,"enabled":boolean}]}',
    },
  },
});

// ── Router factory ────────────────────────────────────────────────────────────

export function createSdkRouter(db: DbClient, streamRegistry: StreamRegistry) {
  const sdk = new OpenAPIHono();

  // Register Bearer auth security scheme so it appears in the generated spec.
  sdk.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
  });

  // Preflight — we can't check allowedOrigins without an API key, so we return
  // * here. The actual GET will enforce origin restrictions before returning data.
  sdk.options('*', (c) => {
    return c.body(null, 204, SDK_ERROR_CORS_HEADERS);
  });

  sdk.openapi(getFlagsRoute, async (c) => {
    const authHeader = c.req.header('authorization');
    const token =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401, SDK_ERROR_CORS_HEADERS);
    }

    const hash = await hashKey(token);

    // Single query: resolve API key → environment → org in one round-trip.
    const [auth] = await db
      .select({
        environmentId: apiKeys.environmentId,
        orgId: environments.orgId,
        allowedOrigins: environments.allowedOrigins,
        orgStatus: organizations.status,
      })
      .from(apiKeys)
      .innerJoin(environments, eq(environments.id, apiKeys.environmentId))
      .innerJoin(organizations, eq(organizations.id, environments.orgId))
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401, SDK_ERROR_CORS_HEADERS);
    }

    if (auth.orgStatus === 'suspended') {
      return c.json({ error: 'Forbidden' }, 403, SDK_ERROR_CORS_HEADERS);
    }

    const requestOrigin = c.req.header('origin');
    const allowedOrigin = resolveAllowedOrigin(requestOrigin, auth.allowedOrigins);

    if (allowedOrigin === null) {
      return c.json({ error: 'Forbidden' }, 403, SDK_ERROR_CORS_HEADERS);
    }

    const flagRows = await queryEnvironmentFlagStates(db, auth.orgId, auth.environmentId);

    const headers = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
    };

    return c.json(
      { flags: flagRows.map((r) => ({ key: r.key, enabled: r.enabled })) },
      200,
      headers,
    );
  });

  sdk.openapi(getFlagsStreamRoute, async (c) => {
    const authHeader = c.req.header('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return c.json({ error: 'Unauthorized' }, 401, SDK_ERROR_CORS_HEADERS);

    const hash = await hashKey(token);
    const [auth] = await db
      .select({
        environmentId: apiKeys.environmentId,
        orgId: environments.orgId,
        allowedOrigins: environments.allowedOrigins,
        orgStatus: organizations.status,
      })
      .from(apiKeys)
      .innerJoin(environments, eq(environments.id, apiKeys.environmentId))
      .innerJoin(organizations, eq(organizations.id, environments.orgId))
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    if (!auth) return c.json({ error: 'Unauthorized' }, 401, SDK_ERROR_CORS_HEADERS);
    if (auth.orgStatus === 'suspended') return c.json({ error: 'Forbidden' }, 403, SDK_ERROR_CORS_HEADERS);

    const requestOrigin = c.req.header('origin');
    const allowedOrigin = resolveAllowedOrigin(requestOrigin, auth.allowedOrigins);
    if (allowedOrigin === null) return c.json({ error: 'Forbidden' }, 403, SDK_ERROR_CORS_HEADERS);

    const initialFlags = await queryEnvironmentFlagStates(db, auth.orgId, auth.environmentId);

    const encoder = new TextEncoder();
    let deregister: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval>;

    const body = new ReadableStream({
      start(controller) {
        const send = (event: FlagEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch { /* stream already closed */ }
        };

        send({ flags: initialFlags });
        deregister = streamRegistry.register(auth.environmentId, send);
        interval = setInterval(() => {
          try { controller.enqueue(encoder.encode(': keepalive\n\n')); }
          catch { clearInterval(interval); }
        }, 25_000);

        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(interval);
          deregister?.();
          try { controller.close(); } catch { /* already closed */ }
        });
      },
      cancel() {
        clearInterval(interval);
        deregister?.();
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin,
      },
    });
  });

  return sdk;
}

// OpenAPI document config — shared between index.ts and tests.
// Note: `components` (incl. securitySchemes) cannot go here; they are
// registered via openAPIRegistry inside createSdkRouter.
//
// APP_URL controls the server origin shown in Scalar's "Try it out" panel.
// Set it to the CloudFront domain in production so requests hit AWS directly.
// Falls back to a relative path so local dev works without configuration.
const appUrl = process.env.APP_URL?.replace(/\/$/, '') ?? '';

export const SDK_OPENAPI_CONFIG = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Togglr SDK API',
    version: '1.0.0',
    description:
      'Feature flag SDK API. Authenticate via `Authorization: Bearer <api-key>`.',
  },
  servers: [{ url: `${appUrl}/api/sdk` }],
};
