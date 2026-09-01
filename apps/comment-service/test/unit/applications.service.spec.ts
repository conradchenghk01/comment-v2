import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from '../../src/applications.service.js';

function databaseWith(query: ReturnType<typeof vi.fn>) {
  return { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
}

describe('ApplicationsService', () => {
  it('US-0b: returns applications ordered by the database query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ key: 'key-1', slug: 'news', name: 'News', status: 'active' }] });
    const service = new ApplicationsService({ query } as never, {} as never);
    await expect(service.list()).resolves.toEqual([{ key: 'key-1', slug: 'news', name: 'News', status: 'active' }]);
    expect(query).toHaveBeenCalledOnce();
  });

  it('US-0c/0d: rejects updates to an unknown application key', async () => {
    const service = new ApplicationsService(databaseWith(vi.fn().mockResolvedValue({ rowCount: 0, rows: [] })) as never, {} as never);
    await expect(service.update('missing-key', 'Renamed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('US-0d: audits a disable transition with the operator identity', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'News', status: 'active' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ key: 'key-1', slug: 'news', name: 'News', status: 'disabled', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }] });
    const recordForApplicationKey = vi.fn().mockResolvedValue(undefined);
    const service = new ApplicationsService(databaseWith(query) as never, { recordForApplicationKey } as never);
    await expect(service.update('key-1', undefined, 'disabled', 'operator-1')).resolves.toMatchObject({ key: 'key-1', status: 'disabled' });
    expect(recordForApplicationKey).toHaveBeenCalledWith(expect.anything(), 'key-1', 'application.disabled', 'application', 'key-1', { status: 'disabled' }, 'operator-1');
  });

  it('US-0c: audits a rename only when the name actually changes', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'News', status: 'active' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ key: 'key-1', slug: 'news', name: 'Renamed', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }] });
    const recordForApplicationKey = vi.fn().mockResolvedValue(undefined);
    const service = new ApplicationsService(databaseWith(query) as never, { recordForApplicationKey } as never);
    await expect(service.update('key-1', 'Renamed', undefined, 'operator-1')).resolves.toMatchObject({ name: 'Renamed' });
    expect(recordForApplicationKey).toHaveBeenCalledWith(expect.anything(), 'key-1', 'application.renamed', 'application', 'key-1', { name: 'Renamed' }, 'operator-1');
    recordForApplicationKey.mockClear();
    const unchangedQuery = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'Renamed', status: 'active' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ key: 'key-1', slug: 'news', name: 'Renamed', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }] });
    const unchangedService = new ApplicationsService(databaseWith(unchangedQuery) as never, { recordForApplicationKey } as never);
    await expect(unchangedService.update('key-1', 'Renamed', undefined, 'operator-1')).resolves.toMatchObject({ name: 'Renamed' });
    expect(recordForApplicationKey).not.toHaveBeenCalled();
  });
});