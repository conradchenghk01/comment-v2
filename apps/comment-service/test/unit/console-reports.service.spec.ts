import { describe, expect, it, vi } from 'vitest';
import { ConsoleReportsService } from '../../src/console-reports.service.js';

describe('ConsoleReportsService', () => {
  it('US-21b: lists reports scoped to an application', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'report-id', reporterId: 'reporter', commentId: 'comment-id', reportedAuthorId: 'author', reasonCategory: 'spam', createdAt: '2026-01-01T00:00:00.000Z', total: '1' }] });
    await expect(new ConsoleReportsService({ query } as never).reports('application-key', 2, 10)).resolves.toMatchObject({ items: [expect.objectContaining({ id: 'report-id' })], page: 2, pageSize: 10, total: 1 });
    expect(query.mock.calls[0]?.[1]).toEqual(['application-key', 10, 10]);
  });

  it('US-15d: lists automatic ban status and escalation count', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ memberId: 'author', mode: 'normal', expiresAt: '2026-01-02T00:00:00.000Z', triggerCount: 1, total: '1' }] });
    await expect(new ConsoleReportsService({ query } as never).autoBans('application-key', 1, 20)).resolves.toMatchObject({ items: [expect.objectContaining({ memberId: 'author', triggerCount: 1 })], total: 1 });
  });
});