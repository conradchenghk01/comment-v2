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
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const replyService = new CommentsService({ query } as never);
    await expect(replyService.reply('app', 'child-or-missing', 'Reply', { accountId: 'user', name: 'User', avatarUrl: 'avatar', createdAt: '2026-01-01T00:00:00Z' })).rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls[0][0]).toContain('parent.root_comment_id IS NULL');
  });
});