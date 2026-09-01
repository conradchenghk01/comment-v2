import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleCommentsService } from '../../src/console-comments.service.js';

describe('ConsoleCommentsService', () => {
  it('US-26/27/28/29: scopes a paged search to its application and filters', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'comment', total: '1' }] });
    const service = new ConsoleCommentsService({ query } as never);
    await expect(service.list('app', { keyword: 'term', articleKey: 'article', status: 'published', from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', page: 2, pageSize: 20 })).resolves.toMatchObject({ page: 2, pageSize: 20, total: 1, items: [{ id: 'comment' }] });
    expect(query.mock.calls[0]?.[0]).toContain('application.key = $1');
    expect(query.mock.calls[0]?.[1]).toEqual(['app', '%term%', 'article', 'published', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', 20, 20]);
  });

  it('US-30: rejects deletion outside the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const database = { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
    const service = new ConsoleCommentsService(database as never, { record: vi.fn() } as never);
    await expect(service.delete('app', 'other-app-comment')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('US-30a: bulk-deletes only active article comments and audits the action', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3, rows: [] });
    const database = { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new ConsoleCommentsService(database as never, { record } as never);
    await expect(service.bulkDeleteByArticle('app', 'article', 'operator-id')).resolves.toEqual({ deletedCount: 3 });
    expect(record).toHaveBeenCalledWith(expect.anything(), 'app', 'comments.bulk_deleted_by_article', 'article', 'article', { deletedCount: 3 }, 'operator-id');
  });

  it('US-28f: finds a single comment by ID within the selected application', async () => {
    const row = { id: 'comment', articleKey: 'article', rootCommentId: null, authorId: 'author', authorName: 'Author', authorAvatarUrl: 'avatar', body: 'Comment', status: 'published', rejectionCode: null, createdAt: '2026-01-01T00:00:00.000Z', replyCount: 0, heat: 0 };
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [row] });
    const service = new ConsoleCommentsService({ query } as never);
    await expect(service.find('app', 'comment')).resolves.toEqual(row);
    expect(query.mock.calls[0]?.[0]).toContain('comment.id = $2');
  });

  it('US-28f: returns 404 when the comment belongs to another application', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const service = new ConsoleCommentsService({ query } as never);
    await expect(service.find('app', 'other-app-comment')).rejects.toBeInstanceOf(NotFoundException);
  });
});