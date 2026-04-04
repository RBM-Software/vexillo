import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const { environmentId } = await req.json();

  if (!environmentId) {
    return NextResponse.json({ error: 'environmentId is required' }, { status: 400 });
  }

  const [flag] = await sql`SELECT id FROM flags WHERE key = ${key}`;
  if (!flag) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  const [state] = await sql`
    INSERT INTO flag_states (flag_id, environment_id, enabled)
    VALUES (${flag.id}, ${environmentId}, true)
    ON CONFLICT (flag_id, environment_id) DO UPDATE
      SET enabled = NOT flag_states.enabled
    RETURNING enabled
  `;

  return NextResponse.json({ enabled: state.enabled });
}
