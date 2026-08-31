import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ModerationService } from '../../src/moderation.service.js';

describe('ModerationService', () => {
  it('US-34: approves only a pending comment in the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(new ModerationService({ query } as never).approve('application-key', 'comment-id')).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[1]).toEqual(['application-key', 'comment-id', 'published', null]);
  });

  it('US-34: rejects unknown or already transitioned comments', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(new ModerationService({ query } as never).reject('application-key', 'comment-id', 'spam')).rejects.toBeInstanceOf(NotFoundException);
  });
});