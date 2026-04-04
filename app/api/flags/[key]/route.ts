import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  const result = await sql`
    DELETE FROM flags WHERE key = ${key} RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
