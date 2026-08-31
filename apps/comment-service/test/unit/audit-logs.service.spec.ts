import { describe, expect, it, vi } from 'vitest';
import { AuditLogsService } from '../../src/audit-logs.service.js';

describe('AuditLogsService', () => {
  it('US-35: lists immutable logs scoped to the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'audit-id', operatorId: 'local-operator', action: 'comment.approved', targetType: 'comment', targetId: 'comment-id', metadata: {}, createdAt: '2026-01-01T00:00:00.000Z', total: '1' }] });
    await expect(new AuditLogsService({ query } as never).list('application-key', 2, 10)).resolves.toMatchObject({ items: [expect.objectContaining({ id: 'audit-id' })], page: 2, pageSize: 10, total: 1 });
    expect(query.mock.calls[0]?.[1]).toEqual(['application-key', 10, 10]);
  });
});