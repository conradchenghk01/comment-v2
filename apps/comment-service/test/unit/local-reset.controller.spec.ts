import { describe, expect, it, vi } from 'vitest';
import { LocalResetController } from '../../src/local-reset.controller.js';

describe('LocalResetController', () => {
  it('US-local-reset: truncates data, flushes cache, and reapplies schema', async () => {
    const query = vi.fn();
    const transaction = vi.fn(async (work: (database: { query: typeof query }) => Promise<void>) => work({ query }));
    const database = { transaction, applySchema: vi.fn() };
    const cache = { flushAll: vi.fn() };
    const controller = new LocalResetController(database as never, cache as never);
    const result = await controller.reset({ confirm: 'RESET' });
    expect(transaction).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('TRUNCATE'));
    expect(cache.flushAll).toHaveBeenCalledOnce();
    expect(database.applySchema).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 'reset' });
  });
});
