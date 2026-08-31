import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OriginsService } from '../../src/origins.service.js';

describe('OriginsService', () => {
  it('US-38: lists origins scoped to the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ origin: 'https://example.test' }] });
    await expect(new OriginsService({ query } as never).list('app')).resolves.toEqual(['https://example.test']);
    expect(query.mock.calls[0]?.[1]).toEqual(['app']);
  });

  it('US-38: distinguishes a duplicate origin from an unknown application', async () => {
    const duplicate = new OriginsService({ query: vi.fn().mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 1 }) } as never);
    await expect(duplicate.add('app', 'https://example.test')).rejects.toBeInstanceOf(ConflictException);
    const unknown = new OriginsService({ query: vi.fn().mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 0 }) } as never);
    await expect(unknown.add('app', 'https://example.test')).rejects.toBeInstanceOf(NotFoundException);
  });
});