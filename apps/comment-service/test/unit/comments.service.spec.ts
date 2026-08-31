import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommentsService } from '../../src/comments.service.js';

describe('CommentsService', () => {
  const service = new CommentsService({} as never);
  const validate = (body: string) => (service as unknown as { validateBody(value: string): void }).validateBody(body);

  it('US-10: rejects whitespace-only comments', () => {
    expect(() => validate(' \n\t ')).toThrow(BadRequestException);
  });

  it('US-10: accepts 1,000 grapheme clusters and rejects 1,001', () => {
    expect(() => validate('a'.repeat(1000))).not.toThrow();
    expect(() => validate('a'.repeat(1001))).toThrow(BadRequestException);
  });

  it('US-11: creates replies only with the root-comment constrained query', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 20, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const replyService = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never);
    await expect(replyService.reply('app', 'child-or-missing', 'Reply', { accountId: 'user', name: 'User', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' })).rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls.at(-1)?.[0]).toContain('parent.root_comment_id IS NULL');
  });

  it('US-12: rejects posting during the configured new-user cooldown', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 20, new_user_cooldown_hours: 24 }] });
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never);
    await expect(service.create('app', 'article', 'Comment', { accountId: 'new', name: 'New', avatarUrl: 'avatar', createdAt: new Date().toISOString() })).rejects.toMatchObject({ response: { code: 'new_user_cooldown_active' } });
  });

  it('US-12: returns a retry delay while the comment interval is active', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 60, daily_comment_limit: 20, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ created_at: new Date() }] });
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never);
    await expect(service.create('app', 'article', 'Comment', { accountId: 'member', name: 'Member', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' })).rejects.toMatchObject({ response: { code: 'comment_interval_active', details: { retryAfterSeconds: expect.any(Number) } } });
  });

  it('US-13: rejects posts after the configured UTC+8 daily quota is exhausted', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 1, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] });
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never);
    await expect(service.create('app', 'article', 'Comment', { accountId: 'member', name: 'Member', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' })).rejects.toMatchObject({ response: { code: 'daily_comment_limit_exceeded', details: { remainingDailyQuota: 0 } } });
  });

  it('US-1/1a/2: defaults to relevance and emits a cursor after a full page', async () => {
    const rows = [{ id: 'first', createdAt: '2026-01-01T00:00:00.000Z', replyCount: 1, heat: 3 }, { id: 'second', createdAt: '2026-01-01T00:00:01.000Z', replyCount: 0, heat: 2 }];
    const query = vi.fn().mockResolvedValue({ rows });
    const listService = new CommentsService({ query } as never);
    const page = await listService.list('app', 'article', 'relevant', undefined, 1);
    expect(query.mock.calls[0][0]).toContain('ORDER BY heat DESC');
    expect(page).toMatchObject({ items: [rows[0]], nextCursor: expect.any(String) });
  });
});