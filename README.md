# Vexillo

A self-hosted feature flag service with a React SDK.

## Monorepo structure

| Package | Description |
|---|---|
| `apps/web` | Next.js dashboard — manage flags, API keys, and users |
| `packages/react-sdk` | `@vexillo/react-sdk` — React bindings for consuming flags |

## Prerequisites

- Node.js 18+
- pnpm 10+
- A [Neon](https://neon.tech) Postgres database

## Getting started

```sh
pnpm install
```

### Web app

Copy the env template and fill in your values:

```sh
cp apps/web/.env.local.example apps/web/.env.local
```

Set up the database and seed initial data:

```sh
pnpm --filter @vexillo/web db:setup
```

Start the dev server:

```sh
pnpm dev
```

The dashboard runs at [http://localhost:3000](http://localhost:3000).

## React SDK

See [`packages/react-sdk/README.md`](packages/react-sdk/README.md) for installation and usage.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages and apps |
| `pnpm --filter @vexillo/react-sdk test` | Run SDK tests |
| `pnpm --filter @vexillo/web db:studio` | Open Drizzle Studio |
