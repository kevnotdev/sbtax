export interface AuditLogEntry {
  id: string;
  timestamp: string;
  corporationBN: string;
  userId: string;
  action: 'RETURN_CREATED' | 'EXPENSE_UPDATED' | 'BALANCE_SHEET_RECONCILED' | 'CRA_SUBMITTED' | 'CPA_REVIEWED';
  details: Record<string, unknown>;
  ipAddress?: string;
  payloadHash?: string; // SHA-256 hash of submitted .COR payload for legal non-repudiation
}

const auditLogStore: AuditLogEntry[] = [];

export function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const record: AuditLogEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  auditLogStore.push(record);
  console.log(`[AUDIT LOG] [${record.action}] Corp: ${record.corporationBN} at ${record.timestamp}`);
  return record;
}

export function getAuditLogsForCorp(corporationBN: string): AuditLogEntry[] {
  return auditLogStore.filter(log => log.corporationBN === corporationBN);
}
