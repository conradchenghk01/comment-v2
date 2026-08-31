import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from '../../src/applications.service.js';

describe('ApplicationsService', () => {
  it('US-0b: returns applications ordered by the database query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ key: 'key-1', slug: 'news', name: 'News', status: 'active' }] });
    const service = new ApplicationsService({ query } as never);
    await expect(service.list()).resolves.toEqual([{ key: 'key-1', slug: 'news', name: 'News', status: 'active' }]);
    expect(query).toHaveBeenCalledOnce();
  });

  it('US-0c/0d: rejects updates to an unknown application key', async () => {
    const service = new ApplicationsService({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) } as never);
    await expect(service.update('missing-key', 'Renamed')).rejects.toBeInstanceOf(NotFoundException);
  });
});