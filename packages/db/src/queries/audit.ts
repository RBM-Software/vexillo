import type { DbClient } from '../client';
import { auditLogs } from '../schema';

export interface AuditEntry {
  orgId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function insertAuditLog(db: DbClient, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values(entry);
}
