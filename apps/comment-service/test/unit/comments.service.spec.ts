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
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ yidun_moderation_enabled: false }] })
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
    const page = await listService.list('app', 'article', 'member', 'relevant', undefined, 1);
    expect(query.mock.calls[0][0]).toContain('ORDER BY heat DESC');
    expect(page).toMatchObject({ items: [rows[0]], nextCursor: expect.any(String) });
  });

  it('US-9a: returns at most three root comment previews per requested article', async () => {
    const row = { id: 'comment', articleKey: 'article', rootCommentId: null, authorId: 'author', authorName: 'Author', authorAvatarUrl: 'avatar', body: 'Comment', status: 'published', createdAt: '2026-01-01T00:00:00.000Z', replyCount: 0, heat: 0, commentCount: '1', laughCount: '2', cryCount: '0', cheerCount: '1', rank: '1' };
    const batchService = new CommentsService({ query: vi.fn().mockResolvedValue({ rows: [row] }) } as never);
    await expect(batchService.batch('app', 'member', ['article'])).resolves.toMatchObject({ items: [{ articleKey: 'article', commentCount: 1, reactionCounts: { laugh: 2, cry: 0, cheer: 1 }, comments: [expect.objectContaining({ id: 'comment' })] }] });
  });

  it('US-9b: ranks hot articles by visible comments and reactions', async () => {
    const getHotArticles = vi.fn().mockResolvedValue(undefined);
    const setHotArticles = vi.fn();
    const hotService = new CommentsService({ query: vi.fn().mockResolvedValue({ rows: [{ articleKey: 'article', commentCount: 2, reactionCount: 3, heat: 5 }] }) } as never, { getHotArticles, setHotArticles } as never);
    await expect(hotService.hotArticles('app')).resolves.toEqual({ items: [{ articleKey: 'article', commentCount: 2, reactionCount: 3, heat: 5 }] });
    expect(setHotArticles).toHaveBeenCalledWith('app', 20, [{ articleKey: 'article', commentCount: 2, reactionCount: 3, heat: 5 }]);
  });

  it('US-9b: returns a hot-article cache hit without querying PostgreSQL', async () => {
    const query = vi.fn();
    const hotService = new CommentsService({ query } as never, { getHotArticles: vi.fn().mockResolvedValue([{ articleKey: 'article', commentCount: 2, reactionCount: 3, heat: 5 }]) } as never);
    await expect(hotService.hotArticles('app')).resolves.toEqual({ items: [{ articleKey: 'article', commentCount: 2, reactionCount: 3, heat: 5 }] });
    expect(query).not.toHaveBeenCalled();
  });

  it('US-10a: replays an idempotent submission before consuming quota', async () => {
    const replay = { id: 'comment', articleKey: 'article', rootCommentId: null, authorId: 'member', authorName: 'Member', authorAvatarUrl: 'avatar', body: 'Comment', status: 'published', rejectionCode: null, createdAt: '2026-01-01T00:00:00.000Z', replyCount: 0, heat: 0 };
    const query = vi.fn().mockResolvedValue({ rows: [replay] });
    const idempotentService = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never);
    await expect(idempotentService.create('app', 'article', 'Comment', { accountId: 'member', name: 'Member', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' }, 'key')).resolves.toEqual(replay);
    expect(query).toHaveBeenCalledTimes(1);
  });
});