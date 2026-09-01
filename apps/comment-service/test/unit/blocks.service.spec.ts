import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BlocksService } from '../../src/blocks.service.js';

function databaseWith(query: ReturnType<typeof vi.fn>) {
  return { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
}

describe('BlocksService', () => {
  it('US-36/37: upserts the selected application block mode and audits it', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new BlocksService(databaseWith(query) as never, { record } as never);
    await expect(service.set('app', 'member', 'full', 'operator', 'repeat offender')).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[1]).toEqual(['app', 'member', 'full']);
    expect(record).toHaveBeenCalledWith(expect.anything(), 'app', 'user.blocked', 'user', 'member', { mode: 'full', note: 'repeat offender' }, 'operator');
  });
  it('US-38: rejects an unblock with no scoped block', async () => {
    const service = new BlocksService(databaseWith(vi.fn().mockResolvedValue({ rowCount: 0, rows: [] })) as never, { record: vi.fn() } as never);
    await expect(service.remove('app', 'member', 'operator')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('US-38: audits an unblock with an optional note', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new BlocksService(databaseWith(query) as never, { record } as never);
    await expect(service.remove('app', 'member', 'operator', 'false positive')).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledWith(expect.anything(), 'app', 'user.unblocked', 'user', 'member', { note: 'false positive' }, 'operator');
  });
});