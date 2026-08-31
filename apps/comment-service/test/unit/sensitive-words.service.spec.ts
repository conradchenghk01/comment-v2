import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SensitiveWordsService } from '../../src/sensitive-words.service.js';

describe('SensitiveWordsService', () => {
  it('US-34: normalizes a word and writes an audit event when adding it', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'word-id', word: 'example', createdAt: '2026-01-01T00:00:00.000Z' }] });
    const record = vi.fn();
    const service = new SensitiveWordsService({ transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never, { record } as never);
    await expect(service.add('app', ' Example ')).resolves.toMatchObject({ word: 'example' });
    expect(query.mock.calls[0]?.[1]?.[2]).toBe('example');
    expect(record).toHaveBeenCalledWith(expect.anything(), 'app', 'sensitive_word.added', 'sensitive_word', 'word-id', { word: 'example' });
  });

  it('US-34: rejects duplicate words in the selected application', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }).mockResolvedValueOnce({ rows: [{ exists: 1 }] });
    const service = new SensitiveWordsService({ transaction: async (work: (database: never) => Promise<unknown>) => work({ query } as never) } as never, { record: vi.fn() } as never);
    await expect(service.add('app', 'example')).rejects.toBeInstanceOf(ConflictException);
  });
});