import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  const rows = await sql`
    SELECT
      f.id, f.name, f.key, f.description, f.created_at,
      e.id   AS env_id,
      e.slug AS env_slug,
      COALESCE(fs.enabled, false) AS enabled
    FROM flags f
    CROSS JOIN environments e
    LEFT JOIN flag_states fs
      ON fs.flag_id = f.id AND fs.environment_id = e.id
    ORDER BY f.created_at DESC, e.name
  `;

  const environments = await sql`
    SELECT id, name, slug FROM environments ORDER BY name
  `;

  const flagMap = new Map<string, {
    id: string; name: string; key: string; description: string;
    createdAt: string; states: Record<string, boolean>;
  }>();

  for (const row of rows) {
    if (!flagMap.has(row.key)) {
      flagMap.set(row.key, {
        id: row.id,
        name: row.name,
        key: row.key,
        description: row.description,
        createdAt: row.created_at,
        states: {},
      });
    }
    flagMap.get(row.key)!.states[row.env_slug] = row.enabled;
  }

  return NextResponse.json({
    flags: Array.from(flagMap.values()),
    environments,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name: string = body.name?.trim() ?? '';
  const description: string = body.description?.trim() ?? '';
  const key: string = body.key?.trim() || slugify(name);

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    const [flag] = await sql`
      INSERT INTO flags (name, key, description)
      VALUES (${name}, ${key}, ${description})
      RETURNING *
    `;

    await sql`
      INSERT INTO flag_states (flag_id, environment_id, enabled)
      SELECT ${flag.id}, id, false FROM environments
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ flag }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Flag key already exists' }, { status: 409 });
    }
    throw err;
  }
}
