import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ModerationService } from '../../src/moderation.service.js';

describe('ModerationService', () => {
  it('US-34: approves only a pending comment in the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const database = { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
    const record = vi.fn().mockResolvedValue(undefined);
    await expect(new ModerationService(database as never, { record } as never).approve('application-key', 'comment-id', 'operator-id')).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[1]).toEqual(['application-key', 'comment-id', 'published', null]);
    expect(record).toHaveBeenCalledWith(expect.anything(), 'application-key', 'comment.approved', 'comment', 'comment-id', {}, 'operator-id');
  });

  it('US-34: rejects unknown or already transitioned comments', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const database = { query, transaction: async (work: (executor: never) => Promise<unknown>) => work({ query } as never) };
    const record = vi.fn();
    await expect(new ModerationService(database as never, { record } as never).reject('application-key', 'comment-id', 'spam', 'operator-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(record).not.toHaveBeenCalled();
  });
});