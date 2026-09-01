import { describe, expect, it, vi } from 'vitest';
import { SensitiveWordsModerationAdapter } from '../../src/content-moderation.js';
import { CommentsService } from '../../src/comments.service.js';

describe('SensitiveWordsModerationAdapter', () => {
  it('US-14: flags a body containing a configured sensitive word case-insensitively', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ flagged: true }] });
    const adapter = new SensitiveWordsModerationAdapter({ query } as never);
    await expect(adapter.review('app', 'This contains a BAD word')).resolves.toEqual({ flagged: true });
    expect(query.mock.calls[0][0]).toContain('ILIKE');
  });

  it('US-14: passes a clean body', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ flagged: false }] });
    const adapter = new SensitiveWordsModerationAdapter({ query } as never);
    await expect(adapter.review('app', 'Clean comment')).resolves.toEqual({ flagged: false });
  });
});

describe('CommentsService initial status', () => {
  const member = { accountId: 'member', name: 'Member', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' };

  it('US-14: creates a pending comment when moderation is enabled and the body is flagged', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 20, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ yidun_moderation_enabled: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'comment', status: 'pending', rejectionCode: null }] });
    const moderation = { review: vi.fn().mockResolvedValue({ flagged: true }) };
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never, undefined, moderation);
    await expect(service.create('app', 'article', 'Flagged body', member)).resolves.toMatchObject({ status: 'pending' });
    expect(moderation.review).toHaveBeenCalledWith('app', 'Flagged body');
    expect(query.mock.calls.at(-1)?.[0]).toContain('$8');
  });

  it('US-14: creates a published comment when moderation is disabled', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 20, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ yidun_moderation_enabled: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'comment', status: 'published', rejectionCode: null }] });
    const moderation = { review: vi.fn() };
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never, undefined, moderation);
    await expect(service.create('app', 'article', 'Any body', member)).resolves.toMatchObject({ status: 'published' });
    expect(moderation.review).not.toHaveBeenCalled();
  });

  it('US-14: creates a published comment when the adapter returns clean', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ application_id: 'app-id', comment_interval_seconds: 0, daily_comment_limit: 20, new_user_cooldown_hours: 0 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ yidun_moderation_enabled: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'comment', status: 'published', rejectionCode: null }] });
    const moderation = { review: vi.fn().mockResolvedValue({ flagged: false }) };
    const service = new CommentsService({ query, transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never, undefined, moderation);
    await expect(service.create('app', 'article', 'Clean body', member)).resolves.toMatchObject({ status: 'published' });
  });
});
