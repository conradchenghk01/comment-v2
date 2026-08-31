import { describe, expect, it, vi } from 'vitest';
import { AutoBanService } from '../../src/auto-ban.service.js';
describe('AutoBanService', () => {
  it('US-15a: applies a one-day normal auto block after five reports', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '5' }] }).mockResolvedValueOnce({ rows: [{ trigger_count: 0, threshold_one: 5, threshold_two: 10, threshold_three: 20 }] }).mockResolvedValueOnce({ rows: [{ trigger_count: 1 }] }).mockResolvedValueOnce({ rows: [] });
    await new AutoBanService().evaluate({ query } as never, 'app', 'member');
    expect(query.mock.calls[4]?.[0]).toContain("interval '1 day'");
    expect(query.mock.calls[4]?.[1]).toEqual(['app', 'member', 'normal']);
  });

  it('US-15b: waits for the next configured threshold before escalating again', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '9' }] }).mockResolvedValueOnce({ rows: [{ trigger_count: 1, threshold_one: 5, threshold_two: 10, threshold_three: 20 }] });
    await new AutoBanService().evaluate({ query } as never, 'app', 'member');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('US-15c: makes the fourth escalation a permanent full auto block', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '20' }] }).mockResolvedValueOnce({ rows: [{ trigger_count: 3, threshold_one: 5, threshold_two: 10, threshold_three: 20 }] }).mockResolvedValueOnce({ rows: [{ trigger_count: 4 }] }).mockResolvedValueOnce({ rows: [] });
    await new AutoBanService().evaluate({ query } as never, 'app', 'member');
    expect(query.mock.calls[4]?.[0]).toContain("'auto', NULL");
    expect(query.mock.calls[4]?.[1]).toEqual(['app', 'member', 'full']);
  });
});