import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../../src/reports.service.js';

describe('ReportsService', () => {
  it('US-21a: rejects reporting a member\'s own comment', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ application_id: 'app', author_id: 'member', status: 'published' }] });
    const service = new ReportsService({ query } as never);
    await expect(service.create('key', 'member', 'comment', 'spam')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('US-21a: maps a duplicate report to conflict', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app', author_id: 'author', status: 'published' }] })
      .mockRejectedValueOnce({ code: '23505' });
    const service = new ReportsService({ query } as never);
    await expect(service.create('key', 'reporter', 'comment', 'spam')).rejects.toBeInstanceOf(ConflictException);
  });
});