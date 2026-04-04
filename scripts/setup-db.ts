import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.');
}

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log('Setting up database schema...');

  await sql`
    CREATE TABLE IF NOT EXISTS environments (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT        NOT NULL,
      slug        TEXT        NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS flags (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT        NOT NULL,
      key         TEXT        NOT NULL UNIQUE,
      description TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS flag_states (
      flag_id        UUID    NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
      environment_id UUID    NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
      enabled        BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (flag_id, environment_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      environment_id UUID        NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
      key_hash       TEXT        NOT NULL UNIQUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  console.log('Seeding default environments...');

  for (const [name, slug] of [['Production', 'production'], ['Staging', 'staging'], ['Development', 'development']]) {
    await sql`
      INSERT INTO environments (name, slug)
      VALUES (${name}, ${slug})
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  console.log('Done.');
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
