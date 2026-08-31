import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BlocksService } from '../../src/blocks.service.js';
describe('BlocksService', () => {
  it('US-36/37: upserts the selected application block mode', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }); const service = new BlocksService({ query } as never);
    await expect(service.set('app', 'member', 'full')).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[1]).toEqual(['app', 'member', 'full']);
  });
  it('US-38: rejects an unblock with no scoped block', async () => {
    const service = new BlocksService({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) } as never);
    await expect(service.remove('app', 'member')).rejects.toBeInstanceOf(NotFoundException);
  });
});