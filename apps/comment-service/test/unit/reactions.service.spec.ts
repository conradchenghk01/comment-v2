import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReactionsService } from '../../src/reactions.service.js';

describe('ReactionsService', () => {
  it('US-15/16: adds then removes an emoji reaction for its member', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 3, rows: [{ emoji: 'laugh', count: '1', active: true, triple_used: false }, { emoji: 'cry', count: '0', active: false, triple_used: false }, { emoji: 'cheer', count: '0', active: false, triple_used: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 3, rows: [{ emoji: 'laugh', count: '0', active: false, triple_used: false }, { emoji: 'cry', count: '0', active: false, triple_used: false }, { emoji: 'cheer', count: '0', active: false, triple_used: false }] });
    const service = new ReactionsService({ query } as never);

    await expect(service.toggle('app', 'comment', 'member', 'laugh')).resolves.toEqual({ counts: { laugh: 1, cry: 0, cheer: 0 }, active: ['laugh'], tripleUsed: false });
    await expect(service.toggle('app', 'comment', 'member', 'laugh')).resolves.toEqual({ counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false });
    expect(query.mock.calls[2]?.[0]).toContain('INSERT INTO comment_reactions');
    expect(query.mock.calls[5]?.[0]).toContain('DELETE FROM comment_reactions');
  });

  it('US-18: rejects a triple reaction for an unavailable comment', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const service = new ReactionsService({ query } as never);
    await expect(service.triple('app', 'missing', 'member')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('US-19: rejects a second triple reaction by the same member', async () => {
    const query = vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    const service = new ReactionsService({ query } as never);
    await expect(service.triple('app', 'comment', 'member')).rejects.toBeInstanceOf(ConflictException);
  });
});